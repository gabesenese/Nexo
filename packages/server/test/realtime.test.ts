import { describe, expect, it } from "vitest";
import {
  notifyOrg,
  notifySession,
  orgChannel,
  sessionChannel,
  subscribe,
  subscriberCount,
} from "../src/realtime/bus.js";

describe("realtime bus", () => {
  it("delivers org topics only to that org's subscribers", () => {
    const mine: string[] = [];
    const theirs: string[] = [];
    const stopMine = subscribe(orgChannel("org-a"), (p) => mine.push(p));
    const stopTheirs = subscribe(orgChannel("org-b"), (p) => theirs.push(p));

    notifyOrg("org-a", ["conversations", "attention"]);

    expect(mine).toEqual([JSON.stringify({ topics: ["conversations", "attention"] })]);
    expect(theirs).toEqual([]);

    stopMine();
    stopTheirs();
  });

  it("keeps one visitor's session stream separate from another's", () => {
    const first: string[] = [];
    const second: string[] = [];
    const stopFirst = subscribe(sessionChannel("org-a", "session-1"), (p) => first.push(p));
    const stopSecond = subscribe(sessionChannel("org-a", "session-2"), (p) => second.push(p));

    notifySession("org-a", "session-1");

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    stopFirst();
    stopSecond();
  });

  it("does not confuse a session id reused across two organizations", () => {
    const received: string[] = [];
    const stop = subscribe(sessionChannel("org-a", "shared"), (p) => received.push(p));

    notifySession("org-b", "shared");
    expect(received).toHaveLength(0);

    notifySession("org-a", "shared");
    expect(received).toHaveLength(1);

    stop();
  });

  it("fans out to every listener on a channel", () => {
    let calls = 0;
    const stops = [0, 1, 2].map(() => subscribe(orgChannel("org-fan"), () => calls++));

    notifyOrg("org-fan", ["notifications"]);

    expect(calls).toBe(3);
    stops.forEach((stop) => stop());
  });

  /**
   * Every widget open/close and every dashboard tab is a subscribe/unsubscribe
   * pair, so a channel that outlives its last listener would grow the map for
   * the life of the process.
   */
  it("forgets a channel once its last listener leaves", () => {
    const channel = orgChannel("org-leak");
    const stopFirst = subscribe(channel, () => {});
    const stopSecond = subscribe(channel, () => {});
    expect(subscriberCount(channel)).toBe(2);

    stopFirst();
    expect(subscriberCount(channel)).toBe(1);

    stopSecond();
    expect(subscriberCount(channel)).toBe(0);
  });

  it("tolerates an unsubscribe being called twice", () => {
    const channel = orgChannel("org-twice");
    const stop = subscribe(channel, () => {});
    stop();
    expect(() => stop()).not.toThrow();
    expect(subscriberCount(channel)).toBe(0);
  });

  it("publishing to a channel nobody watches is a no-op", () => {
    expect(() => notifyOrg("org-nobody", ["conversations"])).not.toThrow();
    expect(subscriberCount(orgChannel("org-nobody"))).toBe(0);
  });
});
