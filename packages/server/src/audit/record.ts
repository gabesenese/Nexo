import type { FastifyRequest } from "fastify";
import { prisma } from "../db/client.js";

/**
 * The record of who changed what, for the actions where the answer matters
 * afterwards. `PHILOSOPHY.md` §9 calls the audit trail architecture rather than
 * an afterthought, on the grounds that liability, not cleverness, is the real
 * enterprise problem.
 *
 * Scope is deliberately narrow: administrative changes to the workspace, not
 * ordinary support work. Every reply and resolution is already recoverable from
 * the conversation itself, so logging those twice would bury the handful of
 * events someone actually goes looking for.
 */
export type AuditAction =
  | "member.role_changed"
  | "member.removed"
  | "invite.created"
  | "invite.revoked"
  | "workspace.renamed"
  | "widget.config_changed"
  | "widget.key_rotated"
  | "webhook.configured"
  | "webhook.removed"
  | "knowledge.source_removed"
  | "password.reset_completed"
  | "retention.policy_changed"
  | "retention.applied"
  | "data.exported";

export interface AuditEntry {
  organizationId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** Human-readable name of the thing acted on, copied so it survives deletion. */
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The actor is resolved from the session and copied onto the row rather than
 * joined. An audit log is read most often after somebody has been removed, and
 * a trail that says "deleted user" at exactly that moment is not worth keeping.
 */
export async function recordAudit(req: FastifyRequest, entry: AuditEntry): Promise<void> {
  try {
    const actorId = req.auth?.userId;
    const actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId }, select: { email: true, name: true } })
      : null;

    await prisma.auditEvent.create({
      data: {
        organizationId: entry.organizationId,
        actorUserId: actorId ?? null,
        actorEmail: actor?.email ?? null,
        actorName: actor?.name ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        targetLabel: entry.targetLabel ?? null,
        metadata: (entry.metadata ?? {}) as object,
        ip: req.ip ?? null,
      },
    });
  } catch (error) {
    /**
     * Logged loudly and swallowed. The alternative is failing a change the
     * caller already made, which would leave the workspace and the response
     * disagreeing about what happened. A gap in the trail is recoverable from
     * the application log; a rolled-back role change the operator was told
     * succeeded is not.
     */
    req.log.error({ err: error, action: entry.action }, "failed to record audit event");
  }
}

/** How each action reads in the console, so the log is legible without a key. */
export const AUDIT_LABELS: Record<AuditAction, string> = {
  "member.role_changed": "changed a teammate's role",
  "member.removed": "removed a teammate",
  "invite.created": "invited someone",
  "invite.revoked": "revoked an invitation",
  "workspace.renamed": "renamed the workspace",
  "widget.config_changed": "changed the widget",
  "widget.key_rotated": "rotated the widget key",
  "webhook.configured": "set the handoff webhook",
  "webhook.removed": "removed the handoff webhook",
  "knowledge.source_removed": "removed a knowledge source",
  "password.reset_completed": "completed a password reset",
  "retention.policy_changed": "changed the retention policy",
  "retention.applied": "applied the retention policy",
  "data.exported": "exported the workspace data",
};
