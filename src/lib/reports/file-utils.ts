/** Supported upload types for report simplification (serverless-safe). */
export const REPORT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const REPORT_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

export type ReportFileKind = "image" | "pdf" | "text" | "unsupported";

export function classifyReportFile(file: File): ReportFileKind {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith("image/") || REPORT_IMAGE_EXTENSIONS.test(name)) {
    return "image";
  }
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt")) {
    return "text";
  }
  return "unsupported";
}

export function isReportImageFile(file: File): boolean {
  return classifyReportFile(file) === "image";
}

export function visionMimeForImageFile(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("png")) return "image/png";
  if (mime.includes("webp")) return "image/webp";
  return "image/jpeg";
}

export function validateReportUploadFile(file: File): string | null {
  if (file.size > MAX_REPORT_FILE_BYTES) {
    return "This file is too large. Please use an image under 10 MB.";
  }
  if (classifyReportFile(file) !== "image") {
    return "Please upload a JPG, PNG, or WebP image of your report.";
  }
  return null;
}

export async function fileToBase64(file: File): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer();
    return Buffer.from(bytes).toString("base64");
  } catch {
    return null;
  }
}

export async function imageFileToVisionPayload(
  file: File,
): Promise<{ base64: string; mimeType: string } | null> {
  const base64 = await fileToBase64(file);
  if (!base64) return null;
  return { base64, mimeType: visionMimeForImageFile(file) };
}
