import { describe, expect, it } from "vitest";
import { can, permissionsFor, type Permission } from "../src/auth/policy.js";

const ROLES = ["owner", "admin", "agent", "viewer"] as const;

describe("policy", () => {
  it("lets every role read the workspace", () => {
    for (const role of ROLES) expect(can(role, "workspace:read")).toBe(true);
  });

  it("gives a viewer nothing but reading", () => {
    expect(permissionsFor("viewer")).toEqual(["workspace:read"]);
  });

  /** The role exists so a support person can run the inbox without reshaping the workspace. */
  it("lets an agent work conversations and nothing else", () => {
    expect(can("agent", "conversations:write")).toBe(true);
    for (const denied of ["knowledge:write", "settings:write", "team:manage", "security:manage"] as Permission[]) {
      expect(can("agent", denied), denied).toBe(false);
    }
  });

  it("lets owners and admins run the workspace", () => {
    for (const role of ["owner", "admin"] as const) {
      for (const permission of [
        "conversations:write",
        "knowledge:write",
        "settings:write",
        "team:manage",
        "security:manage",
      ] as Permission[]) {
        expect(can(role, permission), `${role}/${permission}`).toBe(true);
      }
    }
  });

  it("denies everything to someone who is not a member", () => {
    for (const permission of ["workspace:read", "conversations:write", "settings:write"] as Permission[]) {
      expect(can(null, permission)).toBe(false);
    }
  });

  /**
   * Permissions only ever widen as you go up. A regression here would mean a
   * more senior role losing something a junior one keeps, which is the kind of
   * mistake a table makes easy to introduce and hard to notice.
   */
  it("keeps the roles strictly nested", () => {
    const viewer = new Set(permissionsFor("viewer"));
    const agent = new Set(permissionsFor("agent"));
    const admin = new Set(permissionsFor("admin"));
    const owner = new Set(permissionsFor("owner"));

    for (const p of viewer) expect(agent.has(p), `agent missing ${p}`).toBe(true);
    for (const p of agent) expect(admin.has(p), `admin missing ${p}`).toBe(true);
    for (const p of admin) expect(owner.has(p), `owner missing ${p}`).toBe(true);
  });
});
