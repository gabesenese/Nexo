import { LEAD_ENDPOINT } from "./config";

export interface LeadInput {
  name: string;
  email: string;
  company: string;
}

export async function submitLead(input: LeadInput): Promise<void> {
  const res = await fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, source: "landing" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? "Something went wrong. Please try again.");
  }
}
