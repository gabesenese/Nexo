import type { OutgoingEmail } from "./provider.js";

/**
 * Every email Nexo sends, in one file, as plain data.
 *
 * Both are transactional and go to someone who just asked for them, so they are
 * short, say who they are from, and carry exactly one action. Anything longer
 * reads as marketing, which is what gets a sending domain a spam reputation
 * before it has one at all.
 */

/**
 * Anything a customer typed has to pass through this before it reaches the
 * markup. A workspace is named at signup, so the invite body would otherwise
 * carry whatever the sender put in that field straight into a message
 * delivered to someone else's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(heading: string, body: string, action: { label: string; url: string }, footer: string): string {
  /** Inline styles and a table-free layout, because email clients honour very little else. */
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#181b1d;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
    <div style="font-weight:600;font-size:15px;margin-bottom:24px;">Nexo</div>
    <h1 style="font-size:20px;margin:0 0 12px;">${heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#3d4145;margin:0 0 24px;">${body}</p>
    <a href="${action.url}" style="display:inline-block;background:#204c40;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;">${action.label}</a>
    <p style="font-size:12px;line-height:1.6;color:#6b7075;margin:24px 0 0;">${footer}</p>
    <p style="font-size:12px;line-height:1.6;color:#6b7075;margin:12px 0 0;word-break:break-all;">Or paste this into your browser:<br>${action.url}</p>
  </div>
</body></html>`;
}

export function passwordResetEmail(to: string, resetUrl: string, expiresInMinutes: number): OutgoingEmail {
  const footer = `This link expires in ${expiresInMinutes} minutes and can only be used once. If you did not ask to reset your password, you can ignore this email and nothing will change.`;
  return {
    to,
    subject: "Reset your Nexo password",
    text: `Someone asked to reset the password for your Nexo account.\n\nReset it here:\n${resetUrl}\n\n${footer}`,
    html: shell(
      "Reset your password",
      "Someone asked to reset the password for your Nexo account.",
      { label: "Reset password", url: resetUrl },
      footer,
    ),
  };
}

export function inviteEmail(to: string, workspaceName: string, inviteUrl: string): OutgoingEmail {
  const footer = "If you were not expecting this, you can ignore this email.";
  return {
    to,
    subject: `You have been invited to ${workspaceName} on Nexo`,
    text: `You have been invited to join ${workspaceName} on Nexo.\n\nAccept here:\n${inviteUrl}\n\n${footer}`,
    html: shell(
      "You have been invited",
      `You have been invited to join <strong>${escapeHtml(workspaceName)}</strong> on Nexo.`,
      { label: "Accept invitation", url: inviteUrl },
      footer,
    ),
  };
}
