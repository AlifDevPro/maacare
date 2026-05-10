import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { parseKnowledgeCsv, type CsvChunkMode } from "@/lib/rag/csv-knowledge";
import { ingestDocumentWithChunks } from "@/lib/rag/service";

const MAX_FILE_BYTES = 2_000_000;
const MAX_DOCUMENTS = 120;

const chunkModeSchema = z.enum(["per_column", "merge_then_split"]);

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart form with a CSV file field named file." },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const modeRaw = form.get("chunkMode");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1_000_000}MB)` },
        { status: 400 },
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      return NextResponse.json({ error: "Upload a .csv file" }, { status: 400 });
    }

    const modeParsed = chunkModeSchema.safeParse(
      typeof modeRaw === "string" ? modeRaw : "per_column",
    );
    const chunkMode: CsvChunkMode = modeParsed.success ? modeParsed.data : "per_column";

    const csvText = await file.text();
    const { rows, parseErrors } = parseKnowledgeCsv(csvText, chunkMode);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No importable rows",
          parseErrors,
        },
        { status: 400 },
      );
    }

    const slice = rows.slice(0, MAX_DOCUMENTS);
    const truncated = rows.length > MAX_DOCUMENTS;

    let documentsImported = 0;
    let chunksImported = 0;
    const rowErrors: string[] = [];

    for (const row of slice) {
      try {
        const result = await ingestDocumentWithChunks({
          documentTitle: row.documentTitle,
          source: row.source,
          category: row.category,
          chunks: row.chunks,
          userId: session.id,
        });
        documentsImported += 1;
        chunksImported += result.chunkIds.length;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        rowErrors.push(`${row.documentTitle}: ${msg}`);
      }
    }

    return NextResponse.json({
      documentsImported,
      chunksImported,
      rowsAttempted: slice.length,
      truncated,
      maxDocuments: MAX_DOCUMENTS,
      parseErrors: parseErrors.length ? parseErrors : undefined,
      rowErrors: rowErrors.length ? rowErrors : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Batch import failed" }, { status: 500 });
  }
}
