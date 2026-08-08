import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, setSession } from "./auth.js";

async function roleOf(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return membership?.role ?? null;
}

function newToken() {
  return (randomUUID() + randomUUID()).replace(/-/g, "");
}

export async function orgRoutes(app: FastifyInstance) {
  app.get("/api/org", { preHandler: requireAuth }, async (req) => {
    const organizationId = req.auth!.organizationId;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
        invites: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      members: org.memberships.map((m) => ({ email: m.user.email, name: m.user.name, role: m.role })),
      invites: org.invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, createdAt: i.createdAt })),
    };
  });

  app.patch("/api/org", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can rename the workspace." });
    }
    const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "A workspace name is required." });
    }
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { name: parsed.data.name },
    });
    return { id: org.id, name: org.name };
  });

  app.post("/api/org/invites", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can invite teammates." });
    }
    const parsed = z
      .object({ email: z.string().trim().email(), role: z.enum(["admin", "member"]).default("member") })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "A valid email is required." });
    }
    const { email, role: inviteRole } = parsed.data;

    const alreadyMember = await prisma.membership.findFirst({
      where: { organizationId, user: { email } },
    });
    if (alreadyMember) {
      return reply.status(409).send({ error: "That person is already a member of this workspace." });
    }

    const invite = await prisma.invite.upsert({
      where: { organizationId_email: { organizationId, email } },
      update: { role: inviteRole, token: newToken(), acceptedAt: null, createdAt: new Date() },
      create: { organizationId, email, role: inviteRole, token: newToken() },
    });
    return { id: invite.id, email: invite.email, role: invite.role, token: invite.token };
  });

  app.delete<{ Params: { id: string } }>("/api/org/invites/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can revoke invites." });
    }
    await prisma.invite.deleteMany({ where: { id: req.params.id, organizationId } });
    return { ok: true };
  });

  app.get("/api/widget-config", { preHandler: requireAuth }, async (req) => {
    const config = await prisma.widgetConfig.findUnique({ where: { organizationId: req.auth!.organizationId } });
    return {
      accentColor: config?.accentColor ?? "#204c40",
      welcomeMessage:
        config?.welcomeMessage ?? "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time.",
    };
  });

  app.patch("/api/widget-config", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can change widget settings." });
    }
    const parsed = z
      .object({
        accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a hex value like #204c40."),
        welcomeMessage: z.string().trim().min(1).max(300),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid widget settings." });
    }
    const config = await prisma.widgetConfig.upsert({
      where: { organizationId },
      update: parsed.data,
      create: { organizationId, ...parsed.data },
    });
    return { accentColor: config.accentColor, welcomeMessage: config.welcomeMessage };
  });

  app.get<{ Params: { token: string } }>("/api/invites/:token", async (req, reply) => {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt) {
      return reply.status(404).send({ error: "This invite is no longer valid." });
    }
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    return { email: invite.email, organizationName: invite.organization.name, needsAccount: !existingUser };
  });

  app.post<{ Params: { token: string } }>("/api/invites/:token/accept", async (req, reply) => {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt) {
      return reply.status(404).send({ error: "This invite is no longer valid." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    let userId: string;

    if (existingUser) {
      const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Enter your password to join." });
      }
      const ok = await bcrypt.compare(parsed.data.password, existingUser.passwordHash);
      if (!ok) {
        return reply.status(401).send({ error: "Incorrect password." });
      }
      userId = existingUser.id;
    } else {
      const parsed = z
        .object({ name: z.string().trim().min(1, "Name is required"), password: z.string().min(8, "Password must be at least 8 characters") })
        .safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Name and password are required." });
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const user = await prisma.user.create({
        data: { email: invite.email, name: parsed.data.name, passwordHash },
      });
      userId = user.id;
    }

    await prisma.$transaction([
      prisma.membership.upsert({
        where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
        update: { role: invite.role },
        create: { userId, organizationId: invite.organizationId, role: invite.role },
      }),
      prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);

    setSession(app, reply, { sub: userId, email: invite.email, orgId: invite.organizationId });
    return {
      email: invite.email,
      name: existingUser?.name,
      organization: { id: invite.organization.id, name: invite.organization.name, slug: invite.organization.slug },
    };
  });
}
