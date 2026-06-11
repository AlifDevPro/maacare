/**
 * Unit-style checks for report simplifier helpers (no live AI calls).
 * Run: npx tsx scripts/test-report-simplifier.ts
 */

import assert from "node:assert/strict";

import {
  classifyReportFile,
  validateReportUploadFile,
  REPORT_IMAGE_EXTENSIONS,
} from "../src/lib/reports/file-utils";
import {
  buildNonReportFallback,
  extractJsonFromModelText,
  parseReportAnalysisFromModelText,
  reportAnalysisSchema,
  sanitizeReportAnalysis,
} from "../src/lib/reports/parse-analysis";
import { apiErrorMessage, friendlyReportError } from "../src/lib/reports/user-messages";

function mockFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(["x".repeat(Math.min(size, 64))], { type });
  return new File([blob], name, { type });
}

function testFileValidation() {
  assert.equal(classifyReportFile(mockFile("lab.jpg", "image/jpeg")), "image");
  assert.equal(classifyReportFile(mockFile("lab.png", "image/png")), "image");
  assert.equal(classifyReportFile(mockFile("lab.webp", "image/webp")), "image");
  assert.equal(classifyReportFile(mockFile("report.pdf", "application/pdf")), "pdf");
  assert.equal(classifyReportFile(mockFile("notes.txt", "text/plain")), "text");
  assert.equal(classifyReportFile(mockFile("data.csv", "text/csv")), "text");

  assert.equal(validateReportUploadFile(mockFile("lab.jpg", "image/jpeg")), null);
  assert.match(
    validateReportUploadFile(mockFile("report.pdf", "application/pdf")) ?? "",
    /JPG, PNG, or WebP/i,
  );
  const largeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)]);
  const largeFile = new File([largeBlob], "big.jpg", { type: "image/jpeg" });
  assert.match(validateReportUploadFile(largeFile) ?? "", /too large/i);

  assert.ok(REPORT_IMAGE_EXTENSIONS.test("scan.JPEG"));
}

function testJsonParsing() {
  const wrapped = `\`\`\`json
{"summary":"Short summary.","plainExplanation":"Plain words.","riskLevel":"low","findings":[],"recommendations":[],"extractedVitals":{},"extractedProfile":{"conditions":[],"allergies":[],"medications":[],"notes":""}}
\`\`\``;
  const json = extractJsonFromModelText(wrapped);
  assert.ok(json);
  const parsed = parseReportAnalysisFromModelText(wrapped);
  assert.ok(parsed);
  assert.equal(parsed?.summary, "Short summary.");

  const trailingComma = `{"summary":"Ok","plainExplanation":"Ok","riskLevel":"medium","findings":[],"recommendations":["Consult your doctor for any concerns", "Repeat CBC in 2 weeks",], "extractedVitals":{},"extractedProfile":{"conditions":[],"allergies":[],"medications":[],"notes":""}}`;
  const parsed2 = parseReportAnalysisFromModelText(trailingComma);
  assert.ok(parsed2);
  assert.equal(parsed2?.recommendations.length, 1);
  assert.equal(parsed2?.recommendations[0], "Repeat CBC in 2 weeks");
}

function testNonReportFallback() {
  const unreadable = buildNonReportFallback("unreadable");
  assert.equal(unreadable.isMedicalReport, false);
  assert.match(unreadable.summary, /couldn't read/i);
  assert.equal(unreadable.findings.length, 0);
  assert.equal(unreadable.recommendations.length, 0);
  assert.ok(reportAnalysisSchema.safeParse(unreadable).success);

  const notMedical = buildNonReportFallback("not_medical");
  assert.match(notMedical.summary, /doesn't look like a medical report/i);

  const unknown = buildNonReportFallback("unknown");
  assert.match(unknown.summary, /couldn't simplify/i);
}

function testNonMedicalAiResponse() {
  const raw = `{"isMedicalReport":false,"summary":"This is a photo of a cat, not a medical report.","plainExplanation":"Please upload a lab or clinical report instead.","riskLevel":"low","findings":[],"recommendations":[],"extractedVitals":{},"extractedProfile":{"conditions":[],"allergies":[],"medications":[],"notes":""}}`;
  const parsed = parseReportAnalysisFromModelText(raw);
  assert.ok(parsed);
  assert.equal(parsed?.isMedicalReport, false);
  assert.equal(parsed?.findings.length, 0);
  assert.equal(parsed?.recommendations.length, 0);
  assert.match(parsed?.summary ?? "", /cat/i);
}

function testSanitizeNonMedical() {
  const cleaned = sanitizeReportAnalysis({
    isMedicalReport: false,
    documentType: "other",
    summary: "Not a report",
    plainExplanation: "Try again",
    riskLevel: "low",
    findings: [{ name: "Hb", value: "12", range: "", status: "normal", note: "" }],
    recommendations: ["Do something"],
    extractedVitals: { heartRateBpm: 80 },
    extractedProfile: { conditions: ["X"], allergies: [], medications: [], notes: "n" },
  });
  assert.equal(cleaned.isMedicalReport, false);
  assert.equal(cleaned.findings.length, 0);
  assert.equal(cleaned.recommendations.length, 0);
  assert.equal(cleaned.extractedProfile.conditions.length, 0);
}

function testSanitize() {
  const cleaned = sanitizeReportAnalysis({
    isMedicalReport: true,
    documentType: "lab",
    summary: "  Hello  ",
    plainExplanation: "Meaning",
    riskLevel: "low",
    findings: [{ name: " ", value: "x", range: "", status: "normal", note: "" }],
    recommendations: ["Always consult your physician", "Book follow-up"],
    extractedVitals: {},
    extractedProfile: { conditions: [], allergies: [], medications: [], notes: "" },
  });
  assert.equal(cleaned.recommendations.length, 1);
  assert.equal(cleaned.findings.length, 0);
}

function testFriendlyErrors() {
  assert.match(
    friendlyReportError("gemini resource_exhausted quota"),
    /busy right now/i,
  );
  assert.match(
    friendlyReportError("Could not extract enough text using OCR"),
    /couldn't read/i,
  );
  assert.equal(
    apiErrorMessage({ error: "request_failed", message: "Please sign in and try again." }),
    "Please sign in and try again.",
  );
}

function main() {
  testFileValidation();
  testJsonParsing();
  testNonReportFallback();
  testNonMedicalAiResponse();
  testSanitize();
  testSanitizeNonMedical();
  testFriendlyErrors();
  console.log("report-simplifier: all checks passed");
}

main();
