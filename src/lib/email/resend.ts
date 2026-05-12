/**
 * Optional transactional email via Resend (https://resend.com).
 * Used when an admin bans a user so they receive a notice.
 */
export async function sendBanNoticeEmail(opts: {
  to: string;
  displayName?: string | null;
  reason?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "MaaCare <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping ban notice email.");
    return { ok: true, skipped: true };
  }

  const name = opts.displayName?.trim() || "there";
  const reasonBlock =
    opts.reason?.trim() ?
      `<p><strong>Reason:</strong> ${escapeHtml(opts.reason.trim())}</p>`
    : "";

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your MaaCare account access has been restricted by an administrator. You will not be able to sign in until this is lifted.</p>
    ${reasonBlock}
    <p>If you believe this is a mistake, please contact support using the same email you used to register.</p>
    <p>— MaaCare</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: "Your MaaCare account has been restricted",
      html,
    }),
  });

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = j.message ?? `resend_http_${res.status}`;
    console.error("[email] Resend error:", msg);
    return { ok: false, error: msg };
  }

  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
