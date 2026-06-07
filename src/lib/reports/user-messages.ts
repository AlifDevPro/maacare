/** User-facing copy for the report simplifier (no technical jargon). */

export const reportLoadingSteps = {
  file: [
    "Reading your report...",
    "Analyzing the content...",
    "Preparing a simplified version...",
    "Almost ready...",
  ],
  text: [
    "Reading your report...",
    "Analyzing the content...",
    "Preparing a simplified version...",
    "Almost ready...",
  ],
} as const;

export function friendlyReportError(raw: string | undefined | null): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "We couldn't simplify this report. Please try again.";

  const lower = msg.toLowerCase();
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return "We're busy right now. Please wait a minute and try again.";
  }
  if (lower.includes("sign in") || lower.includes("unauthorized")) {
    return "Please sign in and try again.";
  }
  if (lower.includes("too large") || lower.includes("10mb")) {
    return "This file is too large. Please use an image under 10 MB.";
  }
  if (lower.includes("unsupported") || lower.includes("file type")) {
    return "Please upload a JPG, PNG, or WebP image of your report.";
  }
  if (
    lower.includes("could not read") ||
    lower.includes("extract") ||
    lower.includes("ocr") ||
    lower.includes("enough text")
  ) {
    return "We couldn't read this report clearly. Try a sharper photo or paste the text instead.";
  }
  if (lower.includes("not configured") || lower.includes("service")) {
    return "This feature isn't available right now. Please try again later.";
  }
  if (lower.includes("parse") || lower.includes("invalid") || lower.includes("format")) {
    return "We couldn't prepare your summary. Please try again with a clearer report.";
  }
  if (lower.includes("request_failed") || lower.includes("server_error")) {
    return "Something went wrong. Please try again in a moment.";
  }

  // Strip obvious technical tokens before showing anything else.
  if (
    /\b(gemini|groq|ocr|tesseract|pdf-parse|api|pipeline|model|mcp)\b/i.test(msg)
  ) {
    return "We couldn't simplify this report. Please try a clearer image or paste the text.";
  }

  return msg.length > 160
    ? "We couldn't simplify this report. Please try again."
    : msg;
}

export function apiErrorMessage(payload: {
  error?: string;
  message?: string;
}): string {
  return friendlyReportError(payload.message ?? payload.error);
}
