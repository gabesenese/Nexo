import { describe, expect, it } from "vitest";
import { inviteEmail, passwordResetEmail } from "../src/email/messages.js";

describe("inviteEmail", () => {
  /**
   * A workspace is named by whoever signed up, and that name is rendered into a
   * message delivered to somebody else. Without escaping, the sender chooses
   * markup in the recipient's inbox.
   */
  it("escapes a workspace name before putting it in the markup", () => {
    const message = inviteEmail("someone@example.com", '<script>alert(1)</script>Acme & Co "quoted"', "https://app.nexo.test/invite/abc");

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("Acme &amp; Co");
    expect(message.html).toContain("&quot;quoted&quot;");
  });

  it("carries the accept link in both parts", () => {
    const url = "https://app.nexo.test/invite/abc123";
    const message = inviteEmail("someone@example.com", "Acme", url);
    expect(message.text).toContain(url);
    expect(message.html).toContain(url);
  });

  it("names the workspace in the subject so the recipient knows what it is", () => {
    expect(inviteEmail("a@b.test", "Acme", "https://x.test/invite/1").subject).toContain("Acme");
  });
});

describe("passwordResetEmail", () => {
  it("states the expiry and single use in both parts", () => {
    const message = passwordResetEmail("a@b.test", "https://app.nexo.test/reset-password/tok", 60);
    for (const part of [message.text, message.html]) {
      expect(part).toContain("60 minutes");
      expect(part).toMatch(/once/i);
    }
  });

  it("tells someone who did not ask for it that ignoring it is safe", () => {
    const message = passwordResetEmail("a@b.test", "https://app.nexo.test/reset-password/tok", 60);
    expect(message.text).toMatch(/did not ask/i);
  });

  it("includes the link as text, for clients that strip the button", () => {
    const url = "https://app.nexo.test/reset-password/deadbeef";
    expect(passwordResetEmail("a@b.test", url, 60).html).toContain(`Or paste this into your browser`);
    expect(passwordResetEmail("a@b.test", url, 60).html.split(url).length - 1).toBeGreaterThanOrEqual(2);
  });
});
