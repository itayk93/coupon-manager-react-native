import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scraperDir = "/Users/itaykarkason/Python Projects/coupon_manager_project/scrape_multipass";
const startedAt = new Date();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function decode(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function keyBytes(rawKey) {
  const bytes = decode(rawKey);
  if (bytes.length !== 32) throw new Error("Invalid ENCRYPTION_KEY");
  return bytes;
}

function decrypt(value, rawKey) {
  if (!value?.startsWith("gAAAAA")) return value || "";
  const bytes = keyBytes(rawKey);
  const token = decode(value);
  const unsigned = token.subarray(0, -32);
  const signature = token.subarray(-32);
  const expected = crypto.createHmac("sha256", bytes.subarray(0, 16)).update(unsigned).digest();
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    throw new Error("Invalid encrypted coupon value");
  }
  const decipher = crypto.createDecipheriv("aes-128-cbc", bytes.subarray(16), token.subarray(9, 25));
  return Buffer.concat([decipher.update(token.subarray(25, -32)), decipher.final()]).toString("utf8");
}

function decryptWithAvailableKeys(value) {
  const keys = [process.env.ENCRYPTION_KEY, process.env.ENCRYPTION_KEY_PREVIOUS, process.env.OLD_ENCRYPTION_KEY].filter(Boolean);
  for (const rawKey of keys) {
    try {
      return decrypt(value, rawKey);
    } catch {
      // Try rollback key.
    }
  }
  throw new Error("Unable to decrypt coupon value");
}

async function fetchProductionDecryptedCodes(selected) {
  loadEnvFile(path.join(root, ".env.multipass.local"));
  if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL missing");
  if (!process.env.MULTIPASS_DAILY_CODES_TOKEN) throw new Error("MULTIPASS_DAILY_CODES_TOKEN missing");

  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/multipass-daily-codes`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MULTIPASS_DAILY_CODES_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action: "codes", coupon_ids: selected.map((coupon) => coupon.id) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Production decrypt failed: ${response.status} ${body.error || "unknown error"}`);
  }
  return body.coupons || [];
}

async function callProductionAction(action, payload) {
  loadEnvFile(path.join(root, ".env.multipass.local"));
  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/multipass-daily-codes`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.MULTIPASS_DAILY_CODES_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${action} failed: ${response.status} ${body.error || "unknown error"}`);
  return body.result || null;
}

function shouldUpdateCoupon(coupon) {
  if (coupon.status !== "פעיל") return false;
  if (coupon.auto_download_details !== "Multipass") return false;
  if (!coupon.last_scraped) return true;
  const views = [coupon.last_detail_view, coupon.last_company_view, coupon.last_code_view]
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return views.length > 0 && Math.max(...views) > Date.parse(coupon.last_scraped);
}

function parseAmount(value) {
  if (value == null) return 0;
  const normalized = String(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = "0", min = "0"] = match;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) - 2, Number(min))).toISOString();
}

function transactionTime(value) {
  const parsed = parseDate(value);
  return parsed ? Date.parse(parsed) : 0;
}

function normalizeCard(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildSummary(overrides) {
  const endedAt = new Date();
  return {
    subject: `סיכום עדכון Multipass יומי — ${endedAt.toLocaleDateString("he-IL")}`,
    run_date: endedAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    headless: process.env.HEADLESS !== "false",
    ...overrides,
  };
}

async function runNode(script, args, options = {}) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: options.cwd || root,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function runScraper(cardNumbers) {
  const inputPath = path.join(os.tmpdir(), `multipass-cards-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(inputPath, cardNumbers.join(","), "utf8");
  try {
    return await runNode("scrape.js", [], {
      cwd: scraperDir,
      env: {
        HEADLESS: "true",
        CARD_INPUT_FILE: inputPath,
        CARD_TIMEOUT_MS: process.env.CARD_TIMEOUT_MS || "90000",
        MAX_ATTEMPTS_PER_CARD: process.env.MAX_ATTEMPTS_PER_CARD || "2",
      },
    });
  } finally {
    fs.unlinkSync(inputPath);
  }
}

async function main() {
  loadEnvFile(path.join(root, ".env.supabase.local"));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const databaseUrl = new URL(process.env.DATABASE_URL.replace("postgresql+psycopg2:", "postgresql:"));
  databaseUrl.searchParams.delete("sslmode");
  const db = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
  await db.connect();

  let summary;
  try {
    const couponRows = (await db.query(`
      select id, user_id, company, code, value, used_value, status, auto_download_details,
             last_scraped, last_detail_view, last_company_view, last_code_view
      from public.coupon
      where status = 'פעיל' and auto_download_details = 'Multipass'
      order by id
    `)).rows;
    const requestedCouponId = Number(process.env.MULTIPASS_COUPON_ID || 0);
    const selected = couponRows
      .filter(shouldUpdateCoupon)
      .filter((coupon) => !requestedCouponId || coupon.id === requestedCouponId);

    if (selected.length === 0) {
      summary = buildSummary({
        selected: 0,
        scanned: 0,
        updated: 0,
        failed: 0,
        skipped: couponRows.length,
        email_required: false,
        no_change: true,
        items: [],
        failures: [],
      });
      return summary;
    }

    const productionCodes = await fetchProductionDecryptedCodes(selected);
    const selectedById = new Map(selected.map((coupon) => [coupon.id, coupon]));
    const initialFailures = [];
    const decryptedByCard = new Map();
    for (const item of productionCodes) {
      const coupon = selectedById.get(Number(item.id));
      if (!coupon || typeof item.code !== "string" || !item.code.trim()) continue;
      decryptedByCard.set(normalizeCard(item.code), coupon);
    }
    for (const coupon of selected) {
      if ([...decryptedByCard.values()].some((selectedCoupon) => selectedCoupon.id === coupon.id)) continue;
      try {
        const code = decryptWithAvailableKeys(coupon.code);
        decryptedByCard.set(normalizeCard(code), coupon);
      } catch {
        initialFailures.push(`${coupon.company}: production decrypt missing`);
      }
    }

    if (decryptedByCard.size === 0) {
      return buildSummary({
        selected: selected.length,
        scanned: 0,
        updated: 0,
        failed: initialFailures.length,
        skipped: Math.max(0, couponRows.length - selected.length),
        no_change: true,
        items: [],
        failures: initialFailures,
      });
    }

    const scraperResult = await runScraper([...decryptedByCard.keys()]);

    const txPath = path.join(scraperDir, "transactions.json");
    const failuresPath = path.join(scraperDir, "failures.json");
    const transactionsJson = fs.existsSync(txPath) ? JSON.parse(fs.readFileSync(txPath, "utf8")) : [];
    const failuresJson = fs.existsSync(failuresPath) ? JSON.parse(fs.readFileSync(failuresPath, "utf8")) : [];
    fs.writeFileSync(path.join(root, "multipass-transactions.json"), JSON.stringify(transactionsJson, null, 2), "utf8");
    fs.writeFileSync(path.join(root, "multipass-failures.json"), JSON.stringify(failuresJson, null, 2), "utf8");

    const failedCards = new Set((failuresJson || []).map((failure) => normalizeCard(failure.card_number)));
    const positiveItems = [];
    let updated = 0;
    const nowIso = new Date().toISOString();

    await db.query("begin");
    try {
      for (const cardResult of transactionsJson || []) {
        const coupon = decryptedByCard.get(normalizeCard(cardResult.card_number));
        if (!coupon || failedCards.has(normalizeCard(cardResult.card_number))) continue;

        const existingRefs = new Set((await db.query(
          "select reference_number from public.coupon_transaction where coupon_id = $1 and reference_number is not null",
          [coupon.id]
        )).rows.map((row) => row.reference_number));

        let inserted = 0;
        const newUsageTransactions = [];
        for (const tx of cardResult.transactions || []) {
          const reference = String(tx.reference_number || "").trim() || null;
          if (reference && existingRefs.has(reference)) continue;
          const usageAmount = parseAmount(tx.usage_amount);
          const rechargeAmount = parseAmount(tx.recharge_amount);
          await db.query(`
            insert into public.coupon_transaction
              (coupon_id, transaction_date, location, recharge_amount, usage_amount, reference_number, source)
            values ($1, $2, $3, $4, $5, $6, 'Multipass')
          `, [coupon.id, parseDate(tx.transaction_date), tx.location || null, rechargeAmount || null, usageAmount || null, reference]);
          if (reference) existingRefs.add(reference);
          if (usageAmount > 0) newUsageTransactions.push(tx);
          inserted += 1;
        }

        const totals = (await db.query(`
          select
            coalesce(sum(usage_amount), 0)::float8 as used,
            coalesce(sum(recharge_amount), 0)::float8 as recharged
          from public.coupon_transaction
          where coupon_id = $1 and source = 'Multipass'
        `, [coupon.id])).rows[0];
        const rechargeTotal = Number(totals.recharged || 0);
        const newValue = rechargeTotal > 0 ? rechargeTotal : Number(coupon.value || 0);
        const newUsed = Math.max(0, Math.min(newValue, Number(totals.used || 0)));
        const oldUsed = Number(coupon.used_value || 0);
        const delta = Math.max(0, newUsed - oldUsed);
        const status = newUsed >= newValue ? "נוצל" : "פעיל";

        await db.query(
          "update public.coupon set value = $1, used_value = $2, status = $3, last_scraped = $4 where id = $5",
          [newValue, newUsed, status, nowIso, coupon.id]
        );

        if (delta > 0) {
          const newestUsage = newUsageTransactions
            .filter((tx) => parseAmount(tx.usage_amount) > 0)
            .sort((a, b) => transactionTime(b.transaction_date) - transactionTime(a.transaction_date))[0];
          const locationText = String(newestUsage?.location || "").trim();
          let place = null;
          if (locationText) {
            place = await callProductionAction("geocode", { query: locationText }).catch(() => null);
          }
          await db.query(`
            insert into public.coupon_usage
              (coupon_id, used_amount, action, details, timestamp, place_name, place_address, latitude, longitude)
            values ($1, $2, 'Multipass', 'עדכון אוטומטי via Multipass daily flow', $3, $4, $5, $6, $7)
          `, [
            coupon.id,
            delta,
            nowIso,
            place?.place_name || locationText || null,
            place?.place_address || null,
            typeof place?.latitude === "number" ? place.latitude : null,
            typeof place?.longitude === "number" ? place.longitude : null,
          ]);
          await callProductionAction("notify", {
            user_id: coupon.user_id,
            coupon_id: coupon.id,
            company: coupon.company,
            delta,
          }).catch(() => null);
          positiveItems.push({
            coupon_id: coupon.id,
            company: coupon.company,
            old_usage: oldUsed,
            new_usage: newUsed,
            delta,
            value: newValue,
            remaining_value: Math.max(0, newValue - newUsed),
            place_name: place?.place_name || locationText || null,
            place_address: place?.place_address || null,
            latitude: typeof place?.latitude === "number" ? place.latitude : null,
            longitude: typeof place?.longitude === "number" ? place.longitude : null,
          });
        }

        if (inserted > 0 || delta > 0 || Number(coupon.value || 0) !== newValue) updated += 1;
      }
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }

    const failureMessages = [...initialFailures, ...(failuresJson || []).map((failure) => {
      const coupon = decryptedByCard.get(normalizeCard(failure.card_number));
      return `${coupon?.company || "קופון לא מזוהה"}: ${failure.error || "scraper failed"}`;
    })];
    if (scraperResult.code !== 0 && failureMessages.length === 0) {
      failureMessages.push("scraper exited with failure");
    }

    summary = buildSummary({
      selected: selected.length,
      scanned: (transactionsJson || []).length,
      updated: positiveItems.length,
      failed: failureMessages.length,
      skipped: Math.max(0, couponRows.length - selected.length),
      email_required: positiveItems.length > 0 || failureMessages.length > 0,
      no_change: positiveItems.length === 0,
      items: positiveItems,
      failures: failureMessages,
      processed_coupons: updated,
    });
    return summary;
  } finally {
    await db.end();
  }
}

const summary = await main();
const summaryPath = path.join(root, "multipass-summary.json");
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

let emailStatus = "skipped";
if (summary.email_required !== false) {
  loadEnvFile(path.join(root, ".env.brevo.local"));
  const emailResult = await runNode(path.join(root, "scripts/send-multipass-summary.mjs"), [summaryPath], { cwd: root });
  emailStatus = /^STATUS 201$/m.test(emailResult.stdout) ? "sent" : "failed";
}
console.log(JSON.stringify({
  selected: summary.selected,
  scanned: summary.scanned,
  updated: summary.updated,
  failed: summary.failed,
  skipped: summary.skipped,
  email_status: emailStatus,
}, null, 2));
if (emailStatus === "failed") process.exit(1);
