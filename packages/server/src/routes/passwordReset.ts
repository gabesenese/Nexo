import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { sendQuietly } from "../email/provider.js";
import { passwordResetEmail } from "../email/messages.js";

/**
 * How many reset emails one account can trigger before we stop sending. The
 * per-IP limiter cannot cover this: an attacker spraying one victim's address
 * from many addresses is not a volume problem, it is a mailbox-flooding problem
 * aimed at a single person, and the budget has to follow the account.
 */
const MAX_REQUESTS_PER_ACCOUNT = 3;
const ACCOUNT_WINDOW_MINUTES = 15;

/**
 * The token is a bearer credential: whoever holds it becomes the account. It is
 * therefore stored only as a hash, so that read access to the database is not
 * the same as the ability to take over every account in it.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

const forgotSchema = z.object({ email: z.string().trim().email() });
const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function passwordResetRoutes(app: FastifyInstance) {
  /**
   * Always answers the same way, whether or not the address belongs to an
   * account. Anything else turns this endpoint into a directory of who has a
   * Nexo account, which is exactly what an attacker wants before they start
   * guessing passwords.
   */
  app.post("/api/auth/forgot-password", async (req, reply) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "A valid email address is required." });
    }
    /**
     * Looked up exactly as typed, because that is how signup stores it and how
     * login finds it. Lowercasing here instead would mean anyone who signed up
     * with a capital letter silently never receives a reset, and the endpoint
     * cannot report that without also revealing who has an account.
     *
     * Normalising addresses at signup would be better than matching case
     * sensitively, but that changes how existing accounts are found and belongs
     * in its own change rather than hidden inside password reset.
     */
    const email = parsed.data.email;
    const acknowledgement = { ok: true };

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return acknowledgement;

    const since = new Date(Date.now() - ACCOUNT_WINDOW_MINUTES * 60 * 1000);
    const recent = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recent >= MAX_REQUESTS_PER_ACCOUNT) return acknowledgement;

    const token = newToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${env.APP_URL.replace(/\/$/, "")}/reset-password/${token}`;
    await sendQuietly(passwordResetEmail(user.email, resetUrl, env.PASSWORD_RESET_TTL_MINUTES));

    return acknowledgement;
  });

  /**
   * Lets the reset screen tell someone their link has expired before they type
   * a new password, rather than after. Returns only whether the token is
   * usable: saying which account it belongs to would leak an address to whoever
   * found the link.
   */
  app.get<{ Params: { token: string } }>("/api/auth/reset-password/:token", async (req) => {
    const record = await findUsableToken(req.params.token);
    return { valid: record !== null };
  });

  app.post("/api/auth/reset-password", async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid reset request." });
    }

    const record = await findUsableToken(parsed.data.token);
    if (!record) {
      return reply.status(400).send({ error: "This reset link is no longer valid. Request a new one." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const changedAt = new Date();

    /**
     * `passwordChangedAt` is what makes the reset mean something. Sessions are
     * stateless JWTs, so without it whoever compromised the account keeps their
     * existing session for up to a week after the owner locks them out.
     * requireAuth rejects any token issued before this moment.
     *
     * Every other outstanding token for the account is consumed too: if someone
     * requested three links, using one must retire the rest.
     */
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: changedAt },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: changedAt },
      }),
    ]);

    return { ok: true };
  });
}

/**
 * Lookup is by hash, so a wrong token simply finds nothing. There is
 * deliberately no constant-time comparison here: the row is fetched *by* the
 * hash, so any comparison afterwards would be checking a value against itself,
 * which is theatre rather than protection.
 */
async function findUsableToken(token: string) {
  if (!token) return null;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) return null;
  return record;
}
