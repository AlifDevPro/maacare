import Papa from "papaparse";

import { chunkText } from "@/lib/rag/chunk-text";

export type CsvChunkMode = "per_column" | "merge_then_split";

export type ParsedKnowledgeRow = {
  documentTitle: string;
  category?: string;
  source?: string;
  chunks: string[];
};

const TITLE_ALIASES = new Set(["document_title", "doc_title", "title", "name"]);
const CATEGORY_ALIASES = new Set(["category", "cat", "topic", "type"]);
const SOURCE_ALIASES = new Set(["source", "publisher", "origin", "org"]);
/** Not ingested as chunk text (document-level metadata only). */
const META_ALIASES = new Set<string>([
  ...Array.from(TITLE_ALIASES),
  ...Array.from(CATEGORY_ALIASES),
  ...Array.from(SOURCE_ALIASES),
  "description",
  "summary",
]);

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function pickColumn(
  headers: string[],
  aliases: Set<string>,
): string | undefined {
  for (const h of headers) {
    if (aliases.has(normalizeHeader(h))) return h;
  }
  return undefined;
}

function contentHeaders(headers: string[], titleCol?: string, catCol?: string, srcCol?: string): string[] {
  const skip = new Set([titleCol, catCol, srcCol].filter(Boolean) as string[]);
  return headers.filter((h) => {
    if (skip.has(h)) return false;
    const n = normalizeHeader(h);
    if (META_ALIASES.has(n)) return false;
    return true;
  });
}

function cellString(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse admin CSV: one row = one RAG document.
 * Reserved columns (case/spacing-insensitive): title, category, source.
 * Every other column is treated as a text field for that row (variable width across the sheet is OK).
 */
export function parseKnowledgeCsv(
  csvText: string,
  mode: CsvChunkMode,
): { rows: ParsedKnowledgeRow[]; parseErrors: string[] } {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const parseErrors = parsed.errors.map((e) => e.message ?? String(e));
  if (!parsed.meta.fields?.length) {
    return { rows: [], parseErrors: [...parseErrors, "CSV has no header row"] };
  }

  const headers = parsed.meta.fields.filter((h) => h.length > 0);
  const titleCol = pickColumn(headers, TITLE_ALIASES);
  if (!titleCol) {
    return {
      rows: [],
      parseErrors: [
        ...parseErrors,
        'Missing title column. Add a column named title, document_title, or name.',
      ],
    };
  }

  const catCol = pickColumn(headers, CATEGORY_ALIASES);
  const srcCol = pickColumn(headers, SOURCE_ALIASES);
  const textCols = contentHeaders(headers, titleCol, catCol, srcCol);

  if (textCols.length === 0) {
    return {
      rows: [],
      parseErrors: [
        ...parseErrors,
        "No text columns found. Add columns besides title/category/source (e.g. section_1, body, notes).",
      ],
    };
  }

  const rows: ParsedKnowledgeRow[] = [];

  for (const raw of parsed.data) {
    const documentTitle = cellString(raw, titleCol);
    if (!documentTitle) continue;

    const category = catCol ? cellString(raw, catCol) : "";
    const source = srcCol ? cellString(raw, srcCol) : "";

    const pieces: string[] = [];
    for (const col of textCols) {
      const t = cellString(raw, col);
      if (t) pieces.push(t);
    }

    if (pieces.length === 0) continue;

    let chunks: string[];
    if (mode === "merge_then_split") {
      chunks = chunkText(pieces.join("\n\n"));
    } else {
      chunks = pieces.flatMap((p) => chunkText(p));
    }

    if (chunks.length === 0) continue;

    rows.push({
      documentTitle,
      category: category || undefined,
      source: source || undefined,
      chunks,
    });
  }

  return { rows, parseErrors };
}
