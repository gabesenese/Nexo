const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
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
  login: (email: string, password: string) =>
    request<{ email: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: async (): Promise<{ email: string } | null> => {
    const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  },
};
