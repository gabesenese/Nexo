import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { newWidgetKey, requireAuth, requirePermission, roleOf, setSession } from "./auth.js";
import { env } from "../config/env.js";
import { sendQuietly } from "../email/provider.js";
import { inviteEmail } from "../email/messages.js";
import { recordAudit } from "../audit/record.js";

/** True when removing or demoting this owner would leave the workspace with none. */
async function lastOwner(organizationId: string): Promise<boolean> {
  return (await prisma.membership.count({ where: { organizationId, role: "owner" } })) <= 1;
}

function newToken() {
  return (randomUUID() + randomUUID()).replace(/-/g, "");
}

export async function orgRoutes(app: FastifyInstance) {
  app.get("/api/org", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req) => {
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
      widgetKey: org.widgetKey,
      members: org.memberships.map((m) => ({ id: m.user.id, email: m.user.email, name: m.user.name, role: m.role })),
      invites: org.invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, createdAt: i.createdAt })),
    };
  });

  app.patch("/api/org", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req, reply) => {
    const { organizationId } = req.auth!;
    const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "A workspace name is required." });
    }
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { name: parsed.data.name },
    });
    await recordAudit(req, {
      organizationId, action: "workspace.renamed", targetType: "organization",
      targetId: org.id, targetLabel: org.name, metadata: { from: before.name, to: org.name },
    });
    return { id: org.id, name: org.name };
  });

  app.post("/api/org/invites", { preHandler: [requireAuth, requirePermission("team:manage")] }, async (req, reply) => {
    const { organizationId } = req.auth!;
    const parsed = z
      /**
       * Owner is absent on purpose: it is the role that can rotate the widget
       * key and, later, end the subscription, so it is transferred rather than
       * handed out at invite time. Agent is the default because most people
       * joining a support workspace are there to answer customers.
       */
      .object({ email: z.string().trim().email(), role: z.enum(["admin", "agent", "viewer"]).default("agent") })
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

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });
    const inviteUrl = `${env.APP_URL.replace(/\/$/, "")}/invite/${invite.token}`;
    const delivered = await sendQuietly(inviteEmail(invite.email, org.name, inviteUrl));

    /**
     * The link is still returned so the inviter can pass it on by hand, which
     * is the only thing that worked before email existed and is still the
     * answer when a delivery fails. `delivered` tells the UI which of the two
     * it is looking at, rather than leaving it to claim an email was sent.
     */
    await recordAudit(req, {
      organizationId, action: "invite.created", targetType: "invite",
      targetId: invite.id, targetLabel: invite.email, metadata: { role: invite.role, delivered },
    });

    return { id: invite.id, email: invite.email, role: invite.role, token: invite.token, delivered };
  });

  app.delete<{ Params: { id: string } }>("/api/org/invites/:id", { preHandler: [requireAuth, requirePermission("team:manage")] }, async (req, reply) => {
    const { organizationId } = req.auth!;
    const invite = await prisma.invite.findFirst({ where: { id: req.params.id, organizationId } });
    await prisma.invite.deleteMany({ where: { id: req.params.id, organizationId } });
    if (invite) {
      await recordAudit(req, {
        organizationId, action: "invite.revoked", targetType: "invite",
        targetId: invite.id, targetLabel: invite.email,
      });
    }
    return { ok: true };
  });

  /**
   * Changing an existing teammate's role.
   *
   * Two rules beyond the team:manage permission that guards the route.
   *
   * Only an owner may grant or revoke owner. Otherwise an admin could promote
   * themselves, and the distinction between the two roles would be a formality
   * anyone could step over.
   *
   * A workspace must keep at least one owner. Without that, demoting the last
   * one leaves nobody who can rotate the widget key or, once billing exists,
   * manage the subscription, and no way back short of us editing the database.
   */
  app.patch<{ Params: { userId: string }; Body: { role: string } }>(
    "/api/org/members/:userId",
    { preHandler: [requireAuth, requirePermission("team:manage")] },
    async (req, reply) => {
      const { organizationId, userId: callerId } = req.auth!;
      const parsed = z.object({ role: z.enum(["owner", "admin", "agent", "viewer"]) }).safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Choose a role: owner, admin, agent or viewer." });
      }
      const nextRole = parsed.data.role;

      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: req.params.userId, organizationId } },
      });
      if (!membership) {
        return reply.status(404).send({ error: "That person is not a member of this workspace." });
      }
      if (membership.role === nextRole) {
        return { id: membership.userId, role: membership.role };
      }

      const callerRole = await roleOf(callerId, organizationId);
      if ((nextRole === "owner" || membership.role === "owner") && callerRole !== "owner") {
        return reply.status(403).send({ error: "Only an owner can grant or remove the owner role." });
      }

      if (membership.role === "owner" && (await lastOwner(organizationId))) {
        return reply.status(400).send({
          error: "This is the only owner. Make someone else an owner first.",
        });
      }

      const updated = await prisma.membership.update({
        where: { userId_organizationId: { userId: req.params.userId, organizationId } },
        data: { role: nextRole },
        include: { user: { select: { email: true } } },
      });
      await recordAudit(req, {
        organizationId, action: "member.role_changed", targetType: "user",
        targetId: updated.userId, targetLabel: updated.user.email,
        metadata: { from: membership.role, to: nextRole },
      });
      return { id: updated.userId, role: updated.role };
    },
  );

  /**
   * Removing someone.
   *
   * Their notes and replies stay, because removing a teammate must not rewrite
   * the workspace's record of who said what to a customer.
   *
   * Their open assignments do not. The `SET NULL` on the foreign key only fires
   * when the *user* is deleted, and this deletes a membership, so without the
   * explicit unassign below a departed teammate stays the owner of live
   * conversations in a workspace they can no longer open, and the inbox's Mine
   * and Unassigned filters both quietly lie.
   */
  app.delete<{ Params: { userId: string } }>(
    "/api/org/members/:userId",
    { preHandler: [requireAuth, requirePermission("team:manage")] },
    async (req, reply) => {
      const { organizationId, userId: callerId } = req.auth!;

      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: req.params.userId, organizationId } },
      });
      if (!membership) {
        return reply.status(404).send({ error: "That person is not a member of this workspace." });
      }

      const callerRole = await roleOf(callerId, organizationId);
      if (membership.role === "owner" && callerRole !== "owner") {
        return reply.status(403).send({ error: "Only an owner can remove another owner." });
      }
      if (membership.role === "owner" && (await lastOwner(organizationId))) {
        return reply.status(400).send({
          error: "This is the only owner. Make someone else an owner before removing this one.",
        });
      }

      const removed = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { email: true } });

      await prisma.$transaction([
        /** Scoped to this workspace: they may still hold assignments in another. */
        prisma.conversation.updateMany({
          where: { organizationId, assignedUserId: req.params.userId },
          data: { assignedUserId: null, assignedAt: null },
        }),
        prisma.membership.delete({
          where: { userId_organizationId: { userId: req.params.userId, organizationId } },
        }),
      ]);

      await recordAudit(req, {
        organizationId, action: "member.removed", targetType: "user",
        targetId: req.params.userId, targetLabel: removed?.email, metadata: { role: membership.role },
      });
      return { ok: true };
    },
  );

  app.post("/api/widget-key/rotate", { preHandler: [requireAuth, requirePermission("security:manage")] }, async (req, reply) => {
    const { organizationId } = req.auth!;
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { widgetKey: newWidgetKey() },
    });
    await recordAudit(req, { organizationId, action: "widget.key_rotated", targetType: "organization", targetId: org.id });
    return { widgetKey: org.widgetKey };
  });

  app.get("/api/widget-config", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req) => {
    const config = await prisma.widgetConfig.findUnique({ where: { organizationId: req.auth!.organizationId } });
    return {
      accentColor: config?.accentColor ?? "#204c40",
      welcomeMessage:
        config?.welcomeMessage ?? "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time.",
    };
  });

  app.patch("/api/widget-config", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req, reply) => {
    const { organizationId } = req.auth!;
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
    await recordAudit(req, {
      organizationId, action: "widget.config_changed", targetType: "organization",
      targetId: organizationId, metadata: { accentColor: config.accentColor },
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
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
        widgetKey: invite.organization.widgetKey,
      },
    };
  });
}
