const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organization: { id: string; name: string; slug: string; widgetKey: string };
}

export interface ChatCitation {
  id: string;
  sourceName: string;
  headingPath: string[];
}

export interface ChatReply {
  conversationId: string;
  answer: string;
  confidence: number | null;
  citations: ChatCitation[];
  escalated: boolean;
}

export type MemberRole = "owner" | "admin" | "member";

export interface OrgMember {
  id: string;
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
  widgetKey: string;
  members: OrgMember[];
  invites: OrgInvite[];
}

export interface InviteInfo {
  email: string;
  organizationName: string;
  needsAccount: boolean;
}

export interface WidgetConfig {
  accentColor: string;
  welcomeMessage: string;
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

export type SourceStatus = "queued" | "fetching" | "chunking" | "embedding" | "ready" | "failed";

export interface SourceSummary {
  id: string;
  type: "help_center" | "pdf";
  name: string;
  origin: string;
  status: SourceStatus;
  errorMessage: string | null;
  notice: string | null;
  totalChunks: number | null;
  processedChunks: number;
  lastSyncedAt: string | null;
  createdAt: string;
  chunkCount: number;
  /** Distinct answers that cited this source. */
  answersCited: number;
}

export interface QueuedSource {
  sourceId: string;
  name: string;
}

export const IN_PROGRESS_STATUSES: SourceStatus[] = ["queued", "fetching", "chunking", "embedding"];

export function sourceStatusLabel(status: SourceStatus): string {
  switch (status) {
    case "queued":
      return "Queued…";
    case "fetching":
      return "Fetching…";
    case "chunking":
      return "Chunking…";
    case "embedding":
      return "Embedding…";
    case "ready":
      return "Ready";
    case "failed":
      return "Needs attention";
  }
}

export interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  summary: string;
  status: string;
  createdAt: string;
  /** The question that triggered the handoff. Null on escalations recorded before it was captured. */
  question: string | null;
}

export interface AnalyticsSummary {
  totalConversations: number;
  resolvedConversations: number;
  escalatedConversations: number;
  everEscalatedConversations: number;
  openConversations: number;
  reopenedConversations: number;
  resolutionRate: number;
  escalationRate: number;
  recentEscalations: Escalation[];
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: "succeeded" | "failed";
  statusCode: number | null;
  attempts: number;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export type WebhookConfig =
  | { configured: false }
  | { configured: true; url: string; secret: string; enabled: boolean; deliveries: WebhookDelivery[] };

export interface TrialStatus {
  state: "none" | "active" | "expired";
  endsAt: string | null;
  daysRemaining: number | null;
}

export interface PlanUsage {
  plan: { id: string; name: string; conversationsPerMonth: number; knowledgeSources: number | null };
  periodStart: string;
  conversations: { used: number; limit: number; remaining: number; overage: number; percentUsed: number };
  knowledgeSources: { used: number; limit: number | null; remaining: number | null; atLimit: boolean };
  trial: TrialStatus;
}

export interface ImpactSummary {
  windowDays: number;
  since: string;
  conversations: number;
  resolvedAutomatically: number;
  resolvedWithHuman: number;
  stillOpen: number;
  escalated: number;
  automationRate: number;
  assumptions: { averageHandleMinutes: number | null; supportHourlyCostCad: number | null };
  estimated: { hoursAvoided: number; costAvoidedCad: number } | null;
}

export interface ActivityEntry {
  id: string;
  type: "escalated" | "resolved" | "source_indexed";
  summary: string;
  conversationId: string | null;
  at: string;
}

export interface OverviewSummary {
  counts: { open: number; waitingOnHuman: number; resolvedToday: number; total: number };
  /** Null when there is nothing to divide, so the page says so rather than showing 0%. */
  rates: { resolution: number | null; escalation: number | null };
  knowledgeHealth: { total: number; uncovered: number; top: KnowledgeGap[] };
  activity: ActivityEntry[];
}

export interface GapCoverage {
  source: string | null;
  sourceId: string | null;
  similarity: number | null;
  covered: boolean;
}

export interface KnowledgeGapVariant {
  question: string;
  conversationId: string;
  createdAt: string;
}

export interface KnowledgeGap {
  id: string;
  question: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  averageConfidence: number | null;
  unanswered: number;
  coverage: GapCoverage;
  variants: KnowledgeGapVariant[];
}

export type AttentionType = "waiting_for_human" | "customer_replied" | "reopened";

export interface Assignee {
  id: string;
  name: string;
}

export interface AttentionItem {
  conversationId: string;
  sessionId: string;
  type: AttentionType;
  since: string;
  reason: string | null;
  preview: string;
  reopenCount: number;
  assignee: Assignee | null;
}

export interface Citation {
  id: string;
  sourceName: string;
  headingPath: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  citations: Citation[];
  confidence: number | null;
  createdAt: string;
}

/** An operator's note to their team. Never shown to the customer. */
export interface Note {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface Conversation {
  id: string;
  sessionId: string;
  status: "active" | "resolved" | "escalated";
  channel: string;
  createdAt: string;
  resolvedAt: string | null;
  reopenCount: number;
  lastReopenedAt: string | null;
  assignedUserId: string | null;
  assignedUser: (Assignee & { email: string }) | null;
  messages: Message[];
  notes: Note[];
  escalations: Escalation[];
}

export interface Notification {
  id: string;
  conversationId: string;
  type: "escalation";
  message: string;
  read: boolean;
  createdAt: string;
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
    request<QueuedSource>("/api/sources/help-center", { method: "POST", body: JSON.stringify({ url }) }),
  uploadPdf: async (file: File): Promise<QueuedSource> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/sources/pdf`, { method: "POST", body: form, credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Upload failed with ${res.status}`);
    }
    return res.json();
  },
  reindexSource: (id: string) => request<{ ok: true }>(`/api/sources/${id}/reindex`, { method: "POST" }),
  deleteSource: (id: string) => request<{ ok: true }>(`/api/sources/${id}`, { method: "DELETE" }),
  chat: (input: { orgKey: string; sessionId: string; message: string }) =>
    request<ChatReply>("/api/chat", { method: "POST", body: JSON.stringify(input) }),
  getAnalytics: () => request<AnalyticsSummary>("/api/analytics"),
  getOverview: () => request<OverviewSummary>("/api/overview"),
  getWebhook: () => request<WebhookConfig>("/api/webhook"),
  saveWebhook: (url: string, enabled: boolean) =>
    request<{ url: string; enabled: boolean; secret: string }>("/api/webhook", {
      method: "PUT",
      body: JSON.stringify({ url, enabled }),
    }),
  deleteWebhook: () => request<{ configured: boolean }>("/api/webhook", { method: "DELETE" }),
  testWebhook: () =>
    request<{ status: string; statusCode: number | null; attempts: number; error: string | null; durationMs: number }>(
      "/api/webhook/test",
      { method: "POST", body: JSON.stringify({}) },
    ),
  getPlan: () => request<PlanUsage>("/api/plan"),
  getImpact: () => request<ImpactSummary>("/api/impact"),
  setImpactAssumptions: (body: { averageHandleMinutes: number | null; supportHourlyCostCad: number | null }) =>
    request<{ averageHandleMinutes: number | null; supportHourlyCostCad: number | null }>("/api/impact/assumptions", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getKnowledgeGaps: () => request<KnowledgeGap[]>("/api/knowledge-gaps"),
  getAttention: () => request<AttentionItem[]>("/api/attention"),
  listConversations: () => request<Conversation[]>("/api/conversations"),
  replyToConversation: (id: string, message: string) =>
    request<Message>(`/api/conversations/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
  assignConversation: (id: string, userId: string | null) =>
    request<Conversation>(`/api/conversations/${id}/assign`, { method: "POST", body: JSON.stringify({ userId }) }),
  resolveConversation: (id: string) =>
    request<{ ok: true }>(`/api/conversations/${id}/resolve`, { method: "POST" }),
  escalateConversation: (id: string) =>
    request<{ ok: true; alreadyEscalated: boolean }>(`/api/conversations/${id}/escalate`, { method: "POST" }),
  reopenConversation: (id: string) =>
    request<{ ok: true; alreadyOpen: boolean }>(`/api/conversations/${id}/reopen`, { method: "POST" }),
  addNote: (id: string, body: string) =>
    request<Note>(`/api/conversations/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  listLeads: () => request<Lead[]>("/api/leads"),
  listNotifications: () => request<Notification[]>("/api/notifications"),
  markNotificationsRead: () => request<{ ok: true }>("/api/notifications/read-all", { method: "POST" }),
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
  rotateWidgetKey: () => request<{ widgetKey: string }>("/api/widget-key/rotate", { method: "POST" }),
  getWidgetConfig: () => request<WidgetConfig>("/api/widget-config"),
  updateWidgetConfig: (input: WidgetConfig) =>
    request<WidgetConfig>("/api/widget-config", { method: "PATCH", body: JSON.stringify(input) }),
  getInvite: (token: string) => request<InviteInfo>(`/api/invites/${token}`),
  acceptInvite: (token: string, body: { name?: string; password: string }) =>
    request<AuthUser>(`/api/invites/${token}/accept`, { method: "POST", body: JSON.stringify(body) }),
};
