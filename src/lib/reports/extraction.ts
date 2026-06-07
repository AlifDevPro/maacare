import path from "node:path";

import {
  classifyReportFile,
  imageFileToVisionPayload,
  isReportImageFile,
} from "@/lib/reports/file-utils";
import {
  extractTextWithGroqVisionFailover,
} from "@/lib/gemini/text-failover";

export const MIN_EXTRACTED_TEXT_CHARS = 40;
export const MAX_REPORT_TEXT_FOR_AI = 24_000;

export type ExtractionMode =
  | "provided_text"
  | "pdf_local"
  | "ocr_local"
  | "text_local"
  | "groq_vision_ocr"
  | "gemini_file"
  | "groq_vision_file"
  | "deferred_ai"
  | "none";

type PdfParseFn = (dataBuffer: Buffer) => Promise<{ text?: string }>;

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

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

export function clipReportText(text: string, maxChars = MAX_REPORT_TEXT_FOR_AI): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[Truncated for processing]`;
}

export async function extractTextFromReportFileLocally(
  file: File,
): Promise<{ text: string; mode: ExtractionMode; error?: string }> {
  const kind = classifyReportFile(file);
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  if (kind === "text") {
    return { text: buf.toString("utf8").trim(), mode: "text_local" };
  }

  if (kind === "pdf") {
    try {
      const pdfParse = await loadPdfParse();
      const parsed = await pdfParse(buf);
      return { text: parsed.text?.trim() ?? "", mode: "pdf_local" };
    } catch (e) {
      return {
        text: "",
        mode: "none",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (kind === "image") {
    if (isVercel()) {
      return { text: "", mode: "deferred_ai" };
    }
    try {
      const tesseractMod = await import("tesseract.js");
      const workerPath = path.resolve(
        process.cwd(),
        "node_modules",
        "tesseract.js",
        "src",
        "worker-script",
        "node",
        "index.js",
      );
      const worker = await tesseractMod.createWorker("eng", 1, { workerPath });
      const out = await worker.recognize(buf);
      await worker.terminate();
      return { text: out.data.text?.trim() ?? "", mode: "ocr_local" };
    } catch (e) {
      return {
        text: "",
        mode: "none",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return { text: "", mode: "none", error: "unsupported_file_type" };
}

export type ReportExtractionResult = {
  extractedText: string;
  extractionMode: ExtractionMode;
  /** Send raw file bytes to multimodal AI when local/vision OCR did not yield enough text. */
  needsMultimodalAnalysis: boolean;
  visionImagePayload: { base64: string; mimeType: string } | null;
};

/**
 * Resolve report text from pasted input or uploaded file.
 * On Vercel, images defer to Groq/Gemini vision instead of local OCR.
 */
export async function resolveReportTextFromUpload(input: {
  reportTextInput: string;
  reportFile: File | null;
  hasGroqKeys: boolean;
}): Promise<ReportExtractionResult> {
  const { reportTextInput, reportFile, hasGroqKeys } = input;

  if (reportTextInput.trim()) {
    return {
      extractedText: reportTextInput.trim(),
      extractionMode: "provided_text",
      needsMultimodalAnalysis: false,
      visionImagePayload: null,
    };
  }

  if (!reportFile) {
    return {
      extractedText: "",
      extractionMode: "none",
      needsMultimodalAnalysis: false,
      visionImagePayload: null,
    };
  }

  const local = await extractTextFromReportFileLocally(reportFile);
  if (local.text.length >= MIN_EXTRACTED_TEXT_CHARS) {
    return {
      extractedText: local.text,
      extractionMode: local.mode === "none" ? "text_local" : local.mode,
      needsMultimodalAnalysis: false,
      visionImagePayload: null,
    };
  }

  const partialText =
    local.text.length > 0
      ? `Partial extracted text (may be incomplete):\n${local.text}`
      : "";

  let visionImagePayload: { base64: string; mimeType: string } | null = null;
  if (isReportImageFile(reportFile) && hasGroqKeys) {
    visionImagePayload = await imageFileToVisionPayload(reportFile);
    if (visionImagePayload) {
      const groqText = await extractTextWithGroqVisionFailover(
        visionImagePayload.base64,
        visionImagePayload.mimeType,
        MIN_EXTRACTED_TEXT_CHARS,
      );
      if (groqText) {
        return {
          extractedText: groqText,
          extractionMode: "groq_vision_ocr",
          needsMultimodalAnalysis: false,
          visionImagePayload,
        };
      }
    }
  }

  const isImage = isReportImageFile(reportFile);
  if (!visionImagePayload && isImage) {
    visionImagePayload = await imageFileToVisionPayload(reportFile);
  }

  return {
    extractedText: partialText,
    extractionMode: isImage ? "deferred_ai" : "gemini_file",
    needsMultimodalAnalysis: true,
    visionImagePayload,
  };
}
