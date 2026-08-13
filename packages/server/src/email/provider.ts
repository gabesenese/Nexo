import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(message: OutgoingEmail): Promise<void>;
}

/**
 * SMTP rather than a specific vendor's HTTP API, for the same reason the
 * escalation handoff is a signed webhook rather than a Zendesk client: choosing
 * the vendor is a decision we do not have to make yet, and every candidate
 * (Resend, Postmark, SES, Mailgun) speaks SMTP. Swapping providers becomes a
 * change of SMTP_URL rather than a change of code.
 */
export const smtpEmailProvider: EmailProvider = {
  async send(message: OutgoingEmail): Promise<void> {
    if (!env.SMTP_URL) {
      throw new Error("SMTP_URL is not set (required when EMAIL_TRANSPORT=smtp)");
    }
    /**
     * A connection per message rather than a pooled transport. Nexo sends a
     * handful of emails a day, so pooling buys nothing measurable, and a
     * long-lived connection that a provider has quietly dropped is a way to
     * lose a password reset that a fresh one cannot.
     */
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  },
};

/**
 * The default, so a fresh clone can exercise the whole password-reset journey
 * with no account anywhere and no network. The link is printed because the
 * point of the log transport is to let a developer finish the flow, and a
 * developer who cannot reach the link cannot finish it.
 *
 * Deliberately never the production transport: env.ts refuses to boot a
 * production process still using it, because "password reset appears to work
 * and no email arrives" is indistinguishable from success from the outside.
 */
export const logEmailProvider: EmailProvider = {
  async send(message: OutgoingEmail): Promise<void> {
    console.info(
      `\n──────── email (EMAIL_TRANSPORT=log, not sent) ────────\nto:      ${message.to}\nsubject: ${message.subject}\n\n${message.text}\n───────────────────────────────────────────────────────\n`,
    );
  },
};

export const emailProvider: EmailProvider =
  env.EMAIL_TRANSPORT === "smtp" ? smtpEmailProvider : logEmailProvider;

/**
 * Delivery must never decide whether the surrounding action succeeded. A reset
 * token is already written and an invite already exists by the time we try to
 * send; failing the request would tell the caller nothing happened when
 * something did, and would invite them to retry into a duplicate.
 */
export async function sendQuietly(message: OutgoingEmail): Promise<boolean> {
  try {
    await emailProvider.send(message);
    return true;
  } catch (error) {
    console.error(`Email to ${message.to} failed: ${(error as Error).message}`);
    return false;
  }
}
