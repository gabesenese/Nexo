import { describe, expect, it } from "vitest";
import { corsFor, effectiveMethod, isPublicEndpoint } from "../src/http/security.js";

describe("effectiveMethod", () => {
  /**
   * The bug this prevents is total rather than partial: classify preflights by
   * their own verb and every widget on every customer domain stops working,
   * while everything looks fine in same-origin development.
   */
  it("reads a preflight's real method out of the request header", () => {
    expect(effectiveMethod("OPTIONS", "post")).toBe("POST");
    expect(effectiveMethod("OPTIONS", "GET")).toBe("GET");
  });

  it("falls back to a method that matches nothing when a preflight names none", () => {
    expect(effectiveMethod("OPTIONS", undefined)).toBe("");
  });

  it("passes a normal request's method through", () => {
    expect(effectiveMethod("post")).toBe("POST");
  });
});

describe("isPublicEndpoint", () => {
  it("recognises the endpoints the embedded widget calls", () => {
    expect(isPublicEndpoint("POST", "/api/chat")).toBe(true);
    expect(isPublicEndpoint("GET", "/api/widget/config?orgKey=wk_x")).toBe(true);
    expect(isPublicEndpoint("GET", "/api/chat/messages?orgKey=wk_x&sessionId=s")).toBe(true);
    expect(isPublicEndpoint("GET", "/api/chat/events?orgKey=wk_x&sessionId=s")).toBe(true);
    expect(isPublicEndpoint("GET", "/widget.js")).toBe(true);
  });

  it("treats everything carrying a session as private", () => {
    expect(isPublicEndpoint("GET", "/api/conversations")).toBe(false);
    expect(isPublicEndpoint("POST", "/api/auth/login")).toBe(false);
    expect(isPublicEndpoint("GET", "/api/overview")).toBe(false);
    expect(isPublicEndpoint("GET", "/api/events")).toBe(false);
  });

  /** Same path, two audiences: the landing site posts one, the console reads them all. */
  it("separates posting a lead from listing leads", () => {
    expect(isPublicEndpoint("POST", "/api/leads")).toBe(true);
    expect(isPublicEndpoint("GET", "/api/leads")).toBe(false);
  });

  it("does not let a query string or a prefix smuggle a private path in", () => {
    expect(isPublicEndpoint("GET", "/api/chat/messages/../../api/conversations")).toBe(false);
    expect(isPublicEndpoint("POST", "/api/chatter")).toBe(false);
    expect(isPublicEndpoint("GET", "/widget.js.map")).toBe(false);
  });
});

describe("corsFor", () => {
  /**
   * The invariant worth protecting: an any-origin response must never also
   * offer credentials, because that combination hands a session to any site
   * that asks.
   */
  it("never offers credentials to a reflected origin", () => {
    const decision = corsFor("POST", "/api/chat");
    expect(decision.origin).toBe(true);
    expect(decision.credentials).toBe(false);
  });

  it("offers credentials only to the configured origins", () => {
    const decision = corsFor("GET", "/api/conversations");
    expect(decision.credentials).toBe(true);
    expect(Array.isArray(decision.origin)).toBe(true);
    expect(decision.origin).not.toBe(true);
  });

  it("classifies a widget preflight by the method it is asking about", () => {
    expect(corsFor("OPTIONS", "/api/chat", "POST").origin).toBe(true);
    expect(corsFor("OPTIONS", "/api/conversations", "GET").origin).not.toBe(true);
  });
});
