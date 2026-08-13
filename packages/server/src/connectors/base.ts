export interface RawDocument {
  /** Human-readable heading path, e.g. ["Billing", "Refunds"], used for heading-aware chunking. */
  headingPath: string[];
  text: string;
}

export interface FetchedSource {
  name: string;
  origin: string;
  documents: RawDocument[];
  /**
   * Pages that yielded content, for connectors that crawl. An operator judging
   * whether a source really covers their help centre needs to see how much of
   * it was reached, which a chunk count alone does not tell them.
   */
  pageCount?: number;
}

/**
 * Common interface every ingestion connector implements, so new sources
 * (Notion, Confluence, Slack, ...) are cheap to add later without touching
 * the pipeline that consumes them.
 */
export interface Connector {
  type: "help_center" | "pdf";
  /**
   * The signal carries the pipeline's deadline. A connector that reaches over
   * the network should stop when it aborts; one that doesn't may ignore it.
   */
  fetch(input: unknown, signal?: AbortSignal): Promise<FetchedSource>;
}
