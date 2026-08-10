import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { trialEndDate } from "../billing/trial.js";

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

export function setSession(app: FastifyInstance, reply: FastifyReply, claims: SessionClaims) {
  const token = app.jwt.sign(claims, { expiresIn: "7d" });
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
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
      const claims = app.jwt.verify<SessionClaims>(token);
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: claims.sub, organizationId: claims.orgId } },
        include: { user: true, organization: true },
      });
      if (!membership) return reply.status(401).send({ error: "Not authenticated" });
      return {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
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

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
  try {
    const claims = req.server.jwt.verify<SessionClaims>(token);
    req.auth = { userId: claims.sub, organizationId: claims.orgId };
  } catch {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}
