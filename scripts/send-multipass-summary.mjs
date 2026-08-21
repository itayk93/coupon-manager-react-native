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
  const positiveItems = summary.items || [];
  const noChange = Boolean(summary.no_change) || positiveItems.length === 0;
  const updatedCount = Number(summary.updated || 0);
  const selectedCount = Number(summary.selected || 0);
  const scannedCount = Number(summary.scanned || 0);
  const failedCount = Number(summary.failed || 0);
  const skippedCount = Number(summary.skipped || 0);
  const totalDelta = positiveItems.reduce((sum, item) => sum + Number(item.delta || 0), 0);
  const dominantValue = positiveItems.reduce(
    (sum, item) => sum + Number(item.remaining_value || 0),
    0
  );
  const itemsHtml = (summary.items || [])
    .map((item) => {
      const couponId = item.coupon_id ? ` · קופון ${escapeHtml(item.coupon_id)}` : "";
      return `
        <div style="margin-bottom:16px;background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;overflow:hidden">
          <div style="background:${Number(item.remaining_value || 0) <= 0 ? "#98a2b3" : "#1f6fd1"};padding:14px 16px;color:#ffffff">
            <div style="font-family:'Heebo',Arial,sans-serif;font-size:12px;font-weight:700;opacity:0.9">שינויים עם שימוש חדש</div>
            <div style="margin-top:6px;font-family:'Heebo',Arial,sans-serif;font-size:18px;font-weight:800;line-height:1.35">${escapeHtml(item.company)}${couponId}</div>
          </div>
          <div style="padding:16px;background:#ffffff">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse" dir="rtl">
              <tr>
                <td style="padding:8px 0;color:#667085;font-size:14px;font-weight:600">שימוש קודם</td>
                <td style="padding:8px 0;color:#101828;font-size:16px;font-weight:800;text-align:left;direction:ltr">${escapeHtml(shekel(item.old_usage))} ₪</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#667085;font-size:14px;font-weight:600">שימוש חדש</td>
                <td style="padding:8px 0;color:#101828;font-size:16px;font-weight:800;text-align:left;direction:ltr">${escapeHtml(shekel(item.new_usage))} ₪</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#667085;font-size:14px;font-weight:600">דלתא</td>
                <td style="padding:8px 0;color:#16a34a;font-size:16px;font-weight:800;text-align:left;direction:ltr">+${escapeHtml(shekel(item.delta))} ₪</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#667085;font-size:14px;font-weight:600">ערך</td>
                <td style="padding:8px 0;color:#101828;font-size:16px;font-weight:800;text-align:left;direction:ltr">${escapeHtml(shekel(item.value))} ₪</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#667085;font-size:14px;font-weight:600">יתרה</td>
                <td style="padding:8px 0;color:${Number(item.remaining_value || 0) <= 0 ? "#b91c1c" : "#154a8f"};font-size:16px;font-weight:800;text-align:left;direction:ltr">${escapeHtml(shekel(item.remaining_value))} ₪</td>
              </tr>
            </table>
          </div>
        </div>`;
    })
    .join("");

  const noChangeHtml = noChange
    ? `<div style="margin:0 0 14px;padding:18px;background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;color:#101828;font-size:16px;line-height:1.7">לא זוהה שימוש חדש בקופוני Multipass בהרצה הזו.</div>`
    : "";

  const failuresHtml = summary.failures?.length
    ? `<div style="margin:0 0 14px;padding:16px;background:#fee2e2;border:1px solid #fecaca;border-radius:16px;color:#101828;font-size:15px;line-height:1.7">
        <div style="margin:0 0 8px;color:#b91c1c;font-size:13px;font-weight:800">כשלים / חסמים</div>
        ${summary.failures.map((failure) => `<div>${escapeHtml(failure)}</div>`).join("")}
      </div>`
    : "";

  return `
  <div dir="rtl" style="margin:0;background:#faf9f6;padding:32px 14px;font-family:'Heebo',Arial,'Helvetica Neue',sans-serif;color:#101828">
    <div style="max-width:640px;margin:0 auto">
      <div style="background:#ffffff;border:1px solid #e6e9ef;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,0.06)">
        <div style="padding:22px 22px 20px;background:#ffffff;border-bottom:1px solid #f0f1f4">
          <div style="display:inline-block;background:#e8f2fd;color:#154a8f;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;letter-spacing:0.1px">הארנק שלך</div>
          <h1 style="margin:14px 0 6px;color:#101828;font-size:28px;line-height:1.2;font-weight:800">סיכום עדכון Multipass יומי</h1>
          <div style="color:#667085;font-size:14px;line-height:1.6">${escapeHtml(summary.run_date || "")}</div>
        </div>

        <div style="padding:18px 22px 0;background:#ffffff">
          <div style="background:#ffffff;border:1px solid #e6e9ef;border-radius:18px;padding:18px;margin-bottom:16px">
            <div style="color:#667085;font-size:13px;font-weight:700;margin-bottom:4px">יתרה זמינה אחרי העדכון</div>
            <div style="color:#101828;font-size:30px;line-height:1.1;font-weight:800">${escapeHtml(shekel(dominantValue))} ₪</div>
            <div style="color:#98a2b3;font-size:12px;margin-top:4px">${noChange ? "בלי שימוש חדש" : `סה\"כ דלתא חדשה ${escapeHtml(shekel(totalDelta))} ₪`}</div>
          </div>
        </div>

        <div style="padding:0 22px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:12px 0;table-layout:fixed;margin-bottom:18px" dir="rtl">
            <tr>
              <td style="background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;padding:14px 10px;text-align:right;vertical-align:top">
                <div style="color:#667085;font-size:12px;font-weight:700">קופונים שנבחרו</div>
                <div style="color:#101828;font-size:24px;font-weight:800;margin-top:8px">${escapeHtml(selectedCount)}</div>
              </td>
              <td style="background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;padding:14px 10px;text-align:right;vertical-align:top">
                <div style="color:#667085;font-size:12px;font-weight:700">נסרקו</div>
                <div style="color:#101828;font-size:24px;font-weight:800;margin-top:8px">${escapeHtml(scannedCount)}</div>
              </td>
              <td style="background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;padding:14px 10px;text-align:right;vertical-align:top">
                <div style="color:#667085;font-size:12px;font-weight:700">עודכנו</div>
                <div style="color:#1f6fd1;font-size:24px;font-weight:800;margin-top:8px">${escapeHtml(updatedCount)}</div>
              </td>
              <td style="background:#ffffff;border:1px solid #e6e9ef;border-radius:16px;padding:14px 10px;text-align:right;vertical-align:top">
                <div style="color:#667085;font-size:12px;font-weight:700">נכשלו</div>
                <div style="color:${failedCount > 0 ? "#dc2626" : "#101828"};font-size:24px;font-weight:800;margin-top:8px">${escapeHtml(failedCount)}</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding:0 22px 22px">
          ${positiveItems.length ? `<div style="margin:0 0 10px;color:#667085;font-size:13px;font-weight:800">שינויים עם שימוש חדש</div>` : ""}
          ${positiveItems.length ? itemsHtml : ""}
          ${noChangeHtml}
          ${failuresHtml}
        </div>

        <div style="padding:18px 22px 22px;background:#f2f3fd;border-top:1px solid #e6e9ef">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;color:#475467;font-size:14px;line-height:1.6" dir="rtl">
            <tr><td style="padding:6px 0;font-weight:700;color:#344054">headless</td><td style="padding:6px 0;text-align:left;direction:ltr;color:#101828;font-weight:700">${escapeHtml(summary.headless ? "true" : "false")}</td></tr>
            <tr><td style="padding:6px 0;font-weight:700;color:#344054">דולגו</td><td style="padding:6px 0;text-align:left;direction:ltr;color:#101828;font-weight:700">${escapeHtml(skippedCount)}</td></tr>
            <tr><td style="padding:6px 0;font-weight:700;color:#344054">התחלה</td><td style="padding:6px 0;text-align:left;direction:ltr;color:#101828">${escapeHtml(summary.started_at || "")}</td></tr>
            <tr><td style="padding:6px 0;font-weight:700;color:#344054">סיום</td><td style="padding:6px 0;text-align:left;direction:ltr;color:#101828">${escapeHtml(summary.ended_at || "")}</td></tr>
          </table>
        </div>
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
