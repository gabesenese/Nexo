import type { Role } from "@prisma/client";

/**
 * Who is allowed to do what, in one table.
 *
 * Authorization used to be a `roleOf` call copy-pasted into nine handlers, which
 * meant the answer to "can an agent delete a knowledge source" was not written
 * down anywhere: it was the absence of a check in `sources.ts`. Absence is a bad
 * way to express a permission, because nothing about adding a route reminds you
 * to add the check, and nothing fails when you forget.
 *
 * Every authenticated mutation now names the permission it needs, and this file
 * is the only place that decides who holds it.
 */
export type Permission =
  /** Reading anything inside the workspace. Every role has it; a Viewer has only it. */
  | "workspace:read"
  /** Working the inbox: reply, resolve, reopen, escalate, assign, draft, note. */
  | "conversations:write"
  /** Teaching Nexo: adding, re-indexing and removing knowledge sources. */
  | "knowledge:write"
  /** Workspace name, widget appearance, handoff webhook, impact assumptions. */
  | "settings:write"
  /** Inviting and revoking teammates. */
  | "team:manage"
  /**
   * Rotating the widget key, which stops every installed widget answering until
   * the customer updates their snippet. Destructive in a way the other settings
   * are not, so it is held more narrowly.
   */
  | "security:manage";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ["workspace:read", "conversations:write", "knowledge:write", "settings:write", "team:manage", "security:manage"],
  admin: ["workspace:read", "conversations:write", "knowledge:write", "settings:write", "team:manage", "security:manage"],
  /** The support agent's role: they run the inbox, and do not reshape the workspace around it. */
  agent: ["workspace:read", "conversations:write"],
  /** Read-only. For the manager who wants the numbers without the ability to answer a customer. */
  viewer: ["workspace:read"],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role | null, permission: Permission): boolean {
  return role !== null && permissionsFor(role).includes(permission);
}

/**
 * Said in the second person and naming the role, because "Forbidden" tells an
 * operator nothing about whether they are doing something wrong or need someone
 * else to do it.
 */
export function deniedMessage(role: Role | null, permission: Permission): string {
  const what: Record<Permission, string> = {
    "workspace:read": "view this workspace",
    "conversations:write": "reply to or resolve conversations",
    "knowledge:write": "change knowledge sources",
    "settings:write": "change workspace settings",
    "team:manage": "invite or remove teammates",
    "security:manage": "rotate the widget key",
  };
  if (!role) return "You are not a member of this workspace.";
  return `Your role (${role}) cannot ${what[permission]}. Ask an owner or admin.`;
}
