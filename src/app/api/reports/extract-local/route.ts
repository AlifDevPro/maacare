import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { clipReportText, extractTextFromReportFileLocally } from "@/lib/reports/extraction";
import {
  classifyReportFile,
  isReportImageFile,
  MAX_REPORT_FILE_BYTES,
  validateReportUploadFile,
} from "@/lib/reports/file-utils";

export const runtime = "nodejs";

const MIN_PREVIEW_CHARS = 20;

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const form = await req.formData();
    const reportText = String(form.get("reportText") ?? "").trim();
    const reportFile = form.get("file") instanceof File ? (form.get("file") as File) : null;

    if (!reportText && !reportFile) {
      return failJson(400, "Add report text or upload an image of your report.");
    }
    if (reportFile) {
      const validationError = validateReportUploadFile(reportFile);
      if (validationError) return failJson(400, validationError);
      if (reportFile.size > MAX_REPORT_FILE_BYTES) {
        return failJson(400, "This file is too large. Please use an image under 10 MB.");
      }
    }

    if (reportText) {
      return Response.json({
        ok: true,
        mode: "provided_text",
        chars: reportText.length,
      });
    }

    const extracted = await extractTextFromReportFileLocally(reportFile as File);
    const text = extracted.text.trim();
    const file = reportFile as File;
    const isImage = isReportImageFile(file);

    // Images on serverless: local OCR is skipped; analysis reads the image directly.
    if (text.length < MIN_PREVIEW_CHARS && isImage && extracted.mode === "deferred_ai") {
      return Response.json({
        ok: true,
        mode: "deferred_ai",
        chars: 0,
      });
    }

    // PDF with little embedded text may still work via server-side analysis.
    if (text.length < MIN_PREVIEW_CHARS && classifyReportFile(file) === "pdf") {
      return Response.json({
        ok: true,
        mode: "deferred_ai",
        chars: text.length,
      });
    }

    if (text.length < MIN_PREVIEW_CHARS) {
      return Response.json(
        {
          ok: false,
          mode: extracted.mode,
          chars: text.length,
          message: "We couldn't read enough from this file. Try a clearer image or paste the text.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      mode: extracted.mode,
      chars: text.length,
      preview: clipReportText(text, 500),
    });
  } catch (e) {
    return serverErrorJson("reports_extract_local POST", e);
  }
}
