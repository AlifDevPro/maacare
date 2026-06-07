import { z } from "zod";

export const findingSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  range: z.string().optional().default(""),
  status: z.enum(["normal", "low", "high", "borderline"]).default("borderline"),
  note: z.string().optional().default(""),
});

export const vitalsSchema = z.object({
  systolicBp: z.number().int().min(50).max(260).nullable().optional(),
  diastolicBp: z.number().int().min(30).max(180).nullable().optional(),
  heartRateBpm: z.number().int().min(20).max(260).nullable().optional(),
  weightKg: z.number().min(10).max(400).nullable().optional(),
  temperatureC: z.number().min(30).max(45).nullable().optional(),
  glucoseMgDl: z.number().min(20).max(700).nullable().optional(),
  spo2Pct: z.number().int().min(50).max(100).nullable().optional(),
});

export const reportAnalysisSchema = z.object({
  isMedicalReport: z.boolean().default(true),
  summary: z.string().min(1),
  plainExplanation: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  findings: z.array(findingSchema).max(30).default([]),
  recommendations: z.array(z.string().min(1)).max(6).default([]),
  extractedVitals: vitalsSchema.default({}),
  extractedProfile: z
    .object({
      conditions: z.array(z.string().min(1)).max(20).default([]),
      allergies: z.array(z.string().min(1)).max(20).default([]),
      medications: z.array(z.string().min(1)).max(20).default([]),
      notes: z.string().optional().default(""),
    })
    .default({ conditions: [], allergies: [], medications: [], notes: "" }),
});

export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;

export type NonReportFallbackReason = "not_medical" | "unreadable" | "unknown";

const EMPTY_PROFILE = { conditions: [], allergies: [], medications: [], notes: "" };

export function buildNonReportFallback(reason: NonReportFallbackReason): ReportAnalysis {
  const copy: Record<
    NonReportFallbackReason,
    { summary: string; plainExplanation: string; recommendations: string[] }
  > = {
    not_medical: {
      summary: "This doesn't look like a medical report.",
      plainExplanation:
        "What you shared doesn't appear to be a lab result, prescription, or clinical report. Please upload a clear photo of an actual medical document, or paste the report text instead.",
      recommendations: [],
    },
    unreadable: {
      summary: "We couldn't read this clearly enough to summarize.",
      plainExplanation:
        "The image or text was too blurry, dark, or incomplete to understand. Try a well-lit photo where all text is visible, or paste the report text directly.",
      recommendations: [],
    },
    unknown: {
      summary: "We couldn't simplify this as a medical report.",
      plainExplanation:
        "Something went wrong while preparing your summary. Please try again with a clearer photo of your report or paste the text.",
      recommendations: [],
    },
  };

  const { summary, plainExplanation, recommendations } = copy[reason];
  return {
    isMedicalReport: false,
    summary,
    plainExplanation,
    riskLevel: "low",
    findings: [],
    recommendations,
    extractedVitals: {},
    extractedProfile: EMPTY_PROFILE,
  };
}

const GENERIC_RECOMMENDATION_RE =
  /\b(consult your doctor|speak with your (doctor|physician|healthcare|clinician|provider)|seek (medical|professional) advice|disclaimer|not a substitute|always (consult|talk to)|for informational purposes only|this is not medical advice)\b/i;

export function extractJsonFromModelText(text: string): string | null {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block?.[1]) return block[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return null;
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    // Common model mistake: trailing commas before } or ]
    const repaired = raw
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2018|\u2019/g, "'");
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

export function parseReportAnalysisFromModelText(rawText: string): ReportAnalysis | null {
  const jsonText = extractJsonFromModelText(rawText);
  if (!jsonText) return null;
  const parsedJson = tryParseJson(jsonText);
  if (!parsedJson) return null;
  const parsed = reportAnalysisSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  return sanitizeReportAnalysis(parsed.data);
}

export function sanitizeReportAnalysis(analysis: ReportAnalysis): ReportAnalysis {
  const recommendations = analysis.recommendations
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => !GENERIC_RECOMMENDATION_RE.test(r))
    .slice(0, 4);

  const findings = analysis.findings
    .filter((f) => f.name.trim() && f.value.trim())
    .slice(0, 20);

  return {
    ...analysis,
    isMedicalReport: analysis.isMedicalReport !== false,
    summary: analysis.summary.trim(),
    plainExplanation: analysis.plainExplanation.trim(),
    recommendations: analysis.isMedicalReport === false ? [] : recommendations,
    findings: analysis.isMedicalReport === false ? [] : findings,
    extractedVitals: analysis.isMedicalReport === false ? {} : analysis.extractedVitals,
    extractedProfile:
      analysis.isMedicalReport === false
        ? EMPTY_PROFILE
        : {
            conditions: [...new Set(analysis.extractedProfile.conditions.map((x) => x.trim()).filter(Boolean))].slice(
              0,
              15,
            ),
            allergies: [...new Set(analysis.extractedProfile.allergies.map((x) => x.trim()).filter(Boolean))].slice(
              0,
              15,
            ),
            medications: [...new Set(analysis.extractedProfile.medications.map((x) => x.trim()).filter(Boolean))].slice(
              0,
              15,
            ),
            notes: analysis.extractedProfile.notes?.trim() ?? "",
          },
  };
}

export function hasAnyVitals(v: z.infer<typeof vitalsSchema>): boolean {
  return (
    v.systolicBp != null ||
    v.diastolicBp != null ||
    v.heartRateBpm != null ||
    v.weightKg != null ||
    v.temperatureC != null ||
    v.glucoseMgDl != null ||
    v.spo2Pct != null
  );
}
