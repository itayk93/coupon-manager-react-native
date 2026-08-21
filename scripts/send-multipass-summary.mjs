import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function shekel(value) {
  return new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSummaryArg() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: node scripts/send-multipass-summary.mjs <summary.json>");
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildHtml(summary) {
  const itemsHtml = (summary.items || [])
    .map((item) => {
      const couponId = item.coupon_id ? ` · קופון ${escapeHtml(item.coupon_id)}` : "";
      return `
        <div style="margin-bottom:14px">
          <strong>${escapeHtml(item.company)}</strong>${couponId}<br>
          שימוש קודם: ${escapeHtml(shekel(item.old_usage))} ₪<br>
          שימוש חדש: ${escapeHtml(shekel(item.new_usage))} ₪<br>
          דלתא: ${escapeHtml(shekel(item.delta))} ₪<br>
          ערך: ${escapeHtml(shekel(item.value))} ₪<br>
          יתרה: ${escapeHtml(shekel(item.remaining_value))} ₪
        </div>`;
    })
    .join("");

  const noChangeHtml = summary.no_change
    ? `<div style="margin:0 0 14px;padding:16px;background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;color:#171714;font-size:16px;line-height:1.7">לא זוהה שימוש חדש בקופוני Multipass בהרצה הזו.</div>`
    : "";

  const failuresHtml = summary.failures?.length
    ? `<div style="margin:0 0 14px;padding:16px;background:#fff4f2;border:1px solid #f1d0c9;border-radius:8px;color:#171714;font-size:15px;line-height:1.7">
        <div style="margin:0 0 8px;color:#9a3412;font-size:13px;font-weight:700">כשלים / חסמים</div>
        ${summary.failures.map((failure) => `<div>${escapeHtml(failure)}</div>`).join("")}
      </div>`
    : "";

  return `
  <div dir="rtl" style="margin:0;background:#f5f4ef;padding:24px 12px;font-family:Arial,'Helvetica Neue',sans-serif;color:#171714">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d6;border-radius:8px;overflow:hidden">
      <div style="padding:22px;border-bottom:1px solid #eee8dd">
        <div style="margin:0 0 10px;color:#687064;font-size:13px;font-weight:700;letter-spacing:.2px">Multipass daily summary</div>
        <h1 style="margin:0;color:#171714;font-size:26px;line-height:1.25;font-weight:800">סיכום עדכון Multipass יומי</h1>
        <div style="margin-top:10px;color:#5d6259;font-size:14px">${escapeHtml(summary.run_date || "")}</div>
      </div>
      <div style="padding:20px 22px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:10px 0;table-layout:fixed;margin-bottom:20px" dir="rtl">
          <tr>
            <td style="background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;padding:14px;text-align:center"><div style="font-size:12px;color:#687064">selected</div><div style="font-size:24px;font-weight:800">${escapeHtml(summary.selected)}</div></td>
            <td style="background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;padding:14px;text-align:center"><div style="font-size:12px;color:#687064">scanned</div><div style="font-size:24px;font-weight:800">${escapeHtml(summary.scanned)}</div></td>
            <td style="background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;padding:14px;text-align:center"><div style="font-size:12px;color:#687064">updated</div><div style="font-size:24px;font-weight:800">${escapeHtml(summary.updated)}</div></td>
            <td style="background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;padding:14px;text-align:center"><div style="font-size:12px;color:#687064">failed</div><div style="font-size:24px;font-weight:800">${escapeHtml(summary.failed)}</div></td>
          </tr>
        </table>
        ${summary.items?.length ? `<div style="margin:0 0 8px;color:#687064;font-size:13px;font-weight:700">שינויים עם שימוש חדש</div><div style="margin:0 0 14px;padding:16px;background:#faf8f3;border:1px solid #eee8dd;border-radius:8px;color:#171714;font-size:16px;line-height:1.7">${itemsHtml}</div>` : ""}
        ${noChangeHtml}
        ${failuresHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;color:#5d6259;font-size:14px;line-height:1.5" dir="rtl">
          <tr><td style="padding:6px 0;font-weight:700;color:#171714">headless</td><td style="padding:6px 0;text-align:left;direction:ltr">${escapeHtml(summary.headless ? "true" : "false")}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700;color:#171714">skipped</td><td style="padding:6px 0;text-align:left;direction:ltr">${escapeHtml(summary.skipped)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700;color:#171714">started</td><td style="padding:6px 0;text-align:left;direction:ltr">${escapeHtml(summary.started_at || "")}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700;color:#171714">ended</td><td style="padding:6px 0;text-align:left;direction:ltr">${escapeHtml(summary.ended_at || "")}</td></tr>
        </table>
      </div>
    </div>
  </div>`;
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(scriptPath), "..");
  loadEnvFile(path.join(root, ".env.brevo.local"));

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@itaykarkason.com";
  const senderName = process.env.BREVO_SENDER_NAME || "Coupon Master";
  const recipientEmail = process.env.MULTIPASS_SUMMARY_EMAIL_TO || "itayk93@gmail.com";
  if (!apiKey) throw new Error("BREVO_API_KEY missing");

  const summary = parseSummaryArg();
  const subject = summary.subject || `סיכום עדכון Multipass יומי — ${summary.run_date || ""}`.trim();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      replyTo: { name: senderName, email: recipientEmail },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent: buildHtml(summary),
    }),
  });

  const text = await response.text();
  console.log(`STATUS ${response.status}`);
  console.log(text);
  if (response.status !== 201) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
