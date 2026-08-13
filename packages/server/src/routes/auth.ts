import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { trialEndDate } from "../billing/trial.js";
import { can, deniedMessage, permissionsFor, type Permission } from "../auth/policy.js";

/** Opaque, unguessable public key a customer embeds as data-org-key. */
export function newWidgetKey(): string {
  return "wk_" + (randomUUID() + randomUUID()).replace(/-/g, "");
}

const COOKIE_NAME = "nexo_admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

declare module "fastify" {
  interface FastifyRequest {
    auth?: { userId: string; organizationId: string };
  }
}

export interface SessionClaims {
  sub: string;
  email: string;
  orgId: string;
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().trim().min(1, "Company name is required"),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "workspace";
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * `secure` follows APP_URL rather than being hardcoded, because a dev server on
 * plain http cannot set a secure cookie at all and production must never set a
 * cookie without one. env.ts refuses to boot a production process whose APP_URL
 * is not https, so this cannot silently stay false where it matters.
 *
 * `sameSite: "lax"` is load-bearing beyond CSRF: it means the admin console and
 * this API must share a registrable domain in production. Splitting them across
 * unrelated hosts would make every admin request cross-site, the cookie would
 * stop being sent, and the fix would be `SameSite=None`, which reopens exactly
 * what this closes.
 */
export function setSession(app: FastifyInstance, reply: FastifyReply, claims: SessionClaims) {
  const token = app.jwt.sign(claims, { expiresIn: "7d" });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_URL.startsWith("https://"),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid signup details" });
    }
    const { name, email, password, companyName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await uniqueSlug(companyName);

    const { user, organization } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: companyName, slug, widgetKey: newWidgetKey(), trialEndsAt: trialEndDate() },
      });
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: "owner" },
      });
      return { user, organization };
    });

    setSession(app, reply, { sub: user.id, email: user.email, orgId: organization.id });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "owner" as const,
      permissions: permissionsFor("owner"),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        widgetKey: organization.widgetKey,
      },
    };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "email and password are required" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { createdAt: "asc" }, take: 1, include: { organization: true } } },
    });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    const membership = user?.memberships[0];

    if (!user || !valid || !membership) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    setSession(app, reply, { sub: user.id, email: user.email, orgId: membership.organizationId });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      permissions: permissionsFor(membership.role),
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        widgetKey: membership.organization.widgetKey,
      },
    };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: "Not authenticated" });

    try {
      const claims = app.jwt.verify<SessionClaims & { iat?: number }>(token);
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: claims.sub, organizationId: claims.orgId } },
        include: { user: true, organization: true },
      });
      if (!membership) return reply.status(401).send({ error: "Not authenticated" });

      /**
       * The same revocation requireAuth applies, checked here too because this
       * endpoint verifies the cookie itself. Without it a reset leaves the
       * console half signed in: this call still returns a user, the dashboard
       * renders, and then every request behind it 401s.
       *
       * Free, since the user row is already loaded for the response.
       */
      if (isRevokedByPasswordChange(membership.user.passwordChangedAt, claims.iat)) {
        reply.clearCookie(COOKIE_NAME, { path: "/" });
        return reply.status(401).send({ error: "Not authenticated" });
      }

      return {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        /**
         * Sent so the console can hide actions this person cannot take. The
         * server remains the only thing enforcing them; this just stops the UI
         * offering a button whose only outcome is a 403.
         */
        role: membership.role,
        permissions: permissionsFor(membership.role),
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          widgetKey: membership.organization.widgetKey,
        },
      };
    } catch {
      return reply.status(401).send({ error: "Not authenticated" });
    }
  });
}

export async function roleOf(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return membership?.role ?? null;
}

/**
 * Guards a route with the permission it needs, rather than with a role check
 * written out by hand. Used as `preHandler: [requireAuth, requirePermission(...)]`
 * so the permission a route needs is visible in its declaration, and adding a
 * route without one is a visible omission instead of a silent open door.
 */
export function requirePermission(permission: Permission) {
  return async function checkPermission(req: FastifyRequest, reply: FastifyReply) {
    /** requireAuth runs first and answers already if there is no session. */
    if (!req.auth) return;
    const role = await roleOf(req.auth.userId, req.auth.organizationId);
    if (!can(role, permission)) {
      return reply.status(403).send({ error: deniedMessage(role, permission) });
    }
  };
}

/**
 * Sessions are stateless JWTs, so a password reset cannot revoke them by
 * deleting a row. Instead every request compares when its token was issued
 * against when the account's password last changed, and anything older is
 * refused. Without this, resetting a compromised password leaves the attacker
 * signed in for the remaining life of their cookie, which makes the reset
 * mostly theatre.
 *
 * The cost is one primary-key lookup on every authenticated request, not only
 * on accounts that have reset: the lookup is what tells us whether a reset ever
 * happened. That is the price of stateless sessions, and it is affordable at a
 * support team's request rate. If it ever stops being affordable, the answer is
 * a shared session store rather than dropping the check.
 */
export function isRevokedByPasswordChange(
  passwordChangedAt: Date | null,
  issuedAtSeconds: number | undefined,
): boolean {
  if (!passwordChangedAt) return false;
  /** A token with no issued-at claim cannot be shown to predate the change, so it is not trusted. */
  if (issuedAtSeconds === undefined) return true;
  /** `iat` is whole seconds, so a change within the same second as the issue must not revoke it. */
  return Math.floor(passwordChangedAt.getTime() / 1000) > issuedAtSeconds;
}

async function sessionOutlivesPasswordChange(userId: string, issuedAtSeconds: number | undefined): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  return isRevokedByPasswordChange(user?.passwordChangedAt ?? null, issuedAtSeconds);
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
  try {
    const claims = req.server.jwt.verify<SessionClaims & { iat?: number }>(token);
    if (await sessionOutlivesPasswordChange(claims.sub, claims.iat)) {
      reply.clearCookie(COOKIE_NAME, { path: "/" });
      return reply.status(401).send({ error: "Not authenticated" });
    }
    req.auth = { userId: claims.sub, organizationId: claims.orgId };
  } catch {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}
