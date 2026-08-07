const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface AuthUser {
  email: string;
  name: string;
  organization: { id: string; name: string };
}

export type MemberRole = "owner" | "admin" | "member";

export interface OrgMember {
  email: string;
  name: string;
  role: MemberRole;
}

export interface OrgInvite {
  id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  createdAt: string;
}

export interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  members: OrgMember[];
  invites: OrgInvite[];
}

export interface InviteInfo {
  email: string;
  organizationName: string;
  needsAccount: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed with ${res.status}`);
  }
  return res.json();
}

export interface SourceSummary {
  id: string;
  type: "help_center" | "pdf";
  name: string;
  origin: string;
  lastSyncedAt: string | null;
  chunkCount: number;
}

export interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  summary: string;
  status: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalConversations: number;
  resolvedConversations: number;
  escalatedConversations: number;
  resolutionRate: number;
  escalationRate: number;
  recentEscalations: Escalation[];
}

export interface Citation {
  id: string;
  sourceName: string;
  headingPath: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  confidence: number | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  status: "active" | "resolved" | "escalated";
  channel: string;
  createdAt: string;
  messages: Message[];
  escalations: Escalation[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  source: string;
  createdAt: string;
}

export const api = {
  listSources: () => request<SourceSummary[]>("/api/sources"),
  addHelpCenterUrl: (url: string) =>
    request("/api/sources/help-center", { method: "POST", body: JSON.stringify({ url }) }),
  uploadPdf: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/sources/pdf`, { method: "POST", body: form, credentials: "include" });
    if (!res.ok) throw new Error(`Upload failed with ${res.status}`);
    return res.json();
  },
  getAnalytics: () => request<AnalyticsSummary>("/api/analytics"),
  listConversations: () => request<Conversation[]>("/api/conversations"),
  listLeads: () => request<Lead[]>("/api/leads"),
  signup: (input: { name: string; email: string; password: string; companyName: string }) =>
    request<AuthUser>("/api/auth/signup", { method: "POST", body: JSON.stringify(input) }),
  login: (email: string, password: string) =>
    request<AuthUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: async (): Promise<AuthUser | null> => {
    const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  },
  getOrg: () => request<OrgDetails>("/api/org"),
  renameOrg: (name: string) =>
    request<{ id: string; name: string }>("/api/org", { method: "PATCH", body: JSON.stringify({ name }) }),
  createInvite: (email: string, role: "admin" | "member") =>
    request<OrgInvite>("/api/org/invites", { method: "POST", body: JSON.stringify({ email, role }) }),
  deleteInvite: (id: string) => request<{ ok: true }>(`/api/org/invites/${id}`, { method: "DELETE" }),
  getInvite: (token: string) => request<InviteInfo>(`/api/invites/${token}`),
  acceptInvite: (token: string, body: { name?: string; password: string }) =>
    request<AuthUser>(`/api/invites/${token}/accept`, { method: "POST", body: JSON.stringify(body) }),
};
