import pdfParse from "pdf-parse";
import type { Connector, FetchedSource, RawDocument } from "./base.js";

export interface PdfInput {
  filename: string;
  buffer: Buffer;
}

/**
 * Extracts text from an uploaded PDF and splits it into documents on
 * blank-line paragraph breaks. PDFs don't carry semantic heading markup,
 * so unlike the help-center connector we can't reliably detect headings.
 * chunking.ts re-groups these paragraphs into token-bounded chunks.
 */
export const pdfConnector: Connector = {
  type: "pdf",
  async fetch(input: unknown): Promise<FetchedSource> {
    const { filename, buffer } = input as PdfInput;
    const parsed = await pdfParse(buffer);

    const paragraphs = parsed.text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);

    const documents: RawDocument[] = paragraphs.map((text, i) => ({
      headingPath: [filename, `Section ${i + 1}`],
      text,
    }));

    return { name: filename, origin: filename, documents };
  },
};
