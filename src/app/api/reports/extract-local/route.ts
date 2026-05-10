import path from "node:path";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";

const MIN_TEXT_CHARS = 20;

type ExtractionMode = "provided_text" | "text_local" | "pdf_local" | "ocr_local" | "none";
type PdfParseFn = (dataBuffer: Buffer) => Promise<{ text?: string }>;

async function loadPdfParse(): Promise<PdfParseFn> {
  const mod = (await import("pdf-parse")) as unknown;
  if (typeof mod === "function") return mod as PdfParseFn;
  if (
    mod &&
    typeof mod === "object" &&
    "default" in mod &&
    typeof (mod as { default?: unknown }).default === "function"
  ) {
    return (mod as { default: PdfParseFn }).default;
  }
  throw new Error("pdf-parse loader is not a function");
}

function clipText(text: string, maxChars = 2000): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[Truncated preview]`;
}

async function extractFromFile(file: File): Promise<{
  mode: ExtractionMode;
  text: string;
  error?: string;
}> {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  ) {
    return { mode: "text_local", text: buf.toString("utf8") };
  }

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const pdfParse = await loadPdfParse();
      const parsed = await pdfParse(buf);
      return { mode: "pdf_local", text: parsed.text?.trim() ?? "" };
    } catch (e) {
      return {
        mode: "none",
        text: "",
        error: `PDF extraction failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(name)) {
    try {
      const tesseractMod = await import("tesseract.js");
      const createWorker = tesseractMod.createWorker;
      const workerPath = path.resolve(
        process.cwd(),
        "node_modules",
        "tesseract.js",
        "src",
        "worker-script",
        "node",
        "index.js",
      );
      const worker = await createWorker("eng", 1, { workerPath });
      const out = await worker.recognize(buf);
      await worker.terminate();
      return { mode: "ocr_local", text: out.data.text?.trim() ?? "" };
    } catch (e) {
      return {
        mode: "none",
        text: "",
        error: `Image OCR failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return {
    mode: "none",
    text: "",
    error: "Unsupported file type for local extraction.",
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const form = await req.formData();
    const reportText = String(form.get("reportText") ?? "").trim();
    const reportFile = form.get("file");

    if (!reportText && !(reportFile instanceof File)) {
      return failJson(400, "Add report text or upload a file.");
    }
    if (reportFile instanceof File && reportFile.size > 10 * 1024 * 1024) {
      return failJson(400, "File is too large (max 10MB).");
    }

    if (reportText) {
      return Response.json({
        ok: true,
        mode: "provided_text" as ExtractionMode,
        chars: reportText.length,
        preview: clipText(reportText),
      });
    }

    const extracted = await extractFromFile(reportFile as File);
    const text = extracted.text.trim();
    if (text.length < MIN_TEXT_CHARS) {
      return Response.json(
        {
          ok: false,
          mode: extracted.mode,
          chars: text.length,
          preview: clipText(text),
          message: extracted.error ?? "Could not extract enough text from this file.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      mode: extracted.mode,
      chars: text.length,
      preview: clipText(text),
    });
  } catch (e) {
    return serverErrorJson("reports_extract_local POST", e);
  }
}
