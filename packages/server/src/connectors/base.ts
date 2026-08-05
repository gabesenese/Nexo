export interface RawDocument {
  /** Human-readable heading path, e.g. ["Billing", "Refunds"], used for heading-aware chunking. */
  headingPath: string[];
  text: string;
}

export interface FetchedSource {
  name: string;
  origin: string;
  documents: RawDocument[];
}

/**
 * Common interface every ingestion connector implements, so new sources
 * (Notion, Confluence, Slack, ...) are cheap to add later without touching
 * the pipeline that consumes them.
 */
export interface Connector {
  type: "help_center" | "pdf";
  fetch(input: unknown): Promise<FetchedSource>;
}
