import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { buildLanguagePromptLines, normalizeUiLanguagePrior } from "@/lib/ai/language";
import { postProcessMultilingualReply, resolveLanguageFromTextOrPrior } from "@/lib/ai/multilingual-pipeline";
import { composeSystemPrompt } from "@/lib/ai/prompt-composer";
import { enforceNaturalResponseQuality } from "@/lib/ai/quality-guard";
import { buildMedicalSafetyRules, buildNaturalStyleRules, buildSharedIdentityRules } from "@/lib/ai/prompts/shared";
import { planResponseForIntent } from "@/lib/ai/response-planner";
import { executeMcpTool } from "@/lib/ai/mcp/gateway";
import { buildToolCallContext, mcpPlanForRoute } from "@/lib/ai/mcp/policy";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { getGeminiApiKeys, getGroqApiKeys } from "@/lib/gemini/keys";
import {
  analyzeReportWithGroqVisionFailover,
  extractTextWithGroqVisionFailover,
  generateWithGroq,
  getGroqReportModelName,
  isRateLimitError,
} from "@/lib/gemini/text-failover";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

const findingSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  range: z.string().optional().default(""),
  status: z.enum(["normal", "low", "high", "borderline"]).default("borderline"),
  note: z.string().optional().default(""),
});

const vitalsSchema = z.object({
  systolicBp: z.number().int().min(50).max(260).nullable().optional(),
  diastolicBp: z.number().int().min(30).max(180).nullable().optional(),
  heartRateBpm: z.number().int().min(20).max(260).nullable().optional(),
  weightKg: z.number().min(10).max(400).nullable().optional(),
  temperatureC: z.number().min(30).max(45).nullable().optional(),
  glucoseMgDl: z.number().min(20).max(700).nullable().optional(),
  spo2Pct: z.number().int().min(50).max(100).nullable().optional(),
});

const responseSchema = z.object({
  summary: z.string().min(1),
  plainExplanation: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  findings: z.array(findingSchema).max(30).default([]),
  recommendations: z.array(z.string().min(1)).max(10).default([]),
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

function toBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64");
}

function extractJson(text: string): string | null {
  const block = text.match(/```json\s*([\s\S]*?)```/i);
  if (block?.[1]) return block[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return null;
}

function hasAnyVitals(v: z.infer<typeof vitalsSchema>): boolean {
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

const MIN_LOCAL_TEXT_CHARS = 40;
const MAX_REPORT_TEXT_FOR_AI = 24_000;
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

function clipText(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[Truncated for processing]`;
}

function visionMimeForImageFile(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("png")) return "image/png";
  if (mime.includes("webp")) return "image/webp";
  if (mime.includes("gif")) return "image/gif";
  if (mime.includes("bmp")) return "image/bmp";
  return "image/jpeg";
}

async function imageFileToVisionBase64(file: File): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const bytes = await file.arrayBuffer();
    return {
      base64: Buffer.from(bytes).toString("base64"),
      mimeType: visionMimeForImageFile(file),
    };
  } catch {
    return null;
  }
}

async function imageToPdfBase64(file: File): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.create();

    const mime = (file.type || "").toLowerCase();
    let image:
      | Awaited<ReturnType<PDFDocument["embedPng"]>>
      | Awaited<ReturnType<PDFDocument["embedJpg"]>>;

    if (mime.includes("png")) {
      image = await pdf.embedPng(bytes);
    } else {
      image = await pdf.embedJpg(bytes);
    }

    const { width, height } = image.scale(1);
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    const out = await pdf.save();
    return Buffer.from(out).toString("base64");
  } catch {
    return null;
  }
}

async function extractTextFromFileLocally(
  file: File,
): Promise<{ text: string; mode: "pdf_local" | "ocr_local" | "text_local" | "none" }> {
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
    return { text: buf.toString("utf8"), mode: "text_local" };
  }

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const pdfParse = await loadPdfParse();
      const parsed = await pdfParse(buf);
      return { text: parsed.text?.trim() ?? "", mode: "pdf_local" };
    } catch {
      return { text: "", mode: "none" };
    }
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(name)) {
    if (isVercel()) {
      return { text: "", mode: "none" };
    }
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

      const worker = await createWorker("eng", 1, {
        workerPath,
      });
      const out = await worker.recognize(buf);
      await worker.terminate();
      return { text: out.data.text?.trim() ?? "", mode: "ocr_local" };
    } catch {
      return { text: "", mode: "none" };
    }
  }

  return { text: "", mode: "none" };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const form = await req.formData();
    const reportTitle = String(form.get("reportTitle") ?? "").trim();
    const reportTextInput = String(form.get("reportText") ?? "").trim();
    const saveVitals = String(form.get("saveVitals") ?? "true") === "true";
    const saveProfileInsights = String(form.get("saveProfileInsights") ?? "true") === "true";
    const reportFile = form.get("file");
    const isImageUpload =
      reportFile instanceof File &&
      (((reportFile.type || "").toLowerCase().startsWith("image/")) ||
        /\.(png|jpe?g|webp|bmp|gif)$/i.test(reportFile.name.toLowerCase()));

    if (!reportTextInput && !(reportFile instanceof File)) {
      return failJson(400, "Add report text or upload a file.");
    }
    if (reportFile instanceof File && reportFile.size > 10 * 1024 * 1024) {
      return failJson(400, "File is too large (max 10MB).");
    }

    const keys = getGeminiApiKeys();
    const gKeys = getGroqApiKeys();
    if (keys.length === 0 && gKeys.length === 0) {
      return failJson(503, "AI service is not configured.");
    }
    const supabase = await createSupabaseServerClient();
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", session.id)
      .maybeSingle();
    const uiLang = normalizeUiLanguagePrior((profileRow?.language as string | null) ?? null);
    const langCtx = await resolveLanguageFromTextOrPrior({
      userText: reportTextInput || reportTitle || "please explain my medical report",
      uiLanguagePrior: uiLang,
    });
    const languageBlock = buildLanguagePromptLines({
      ietfLanguageTag: langCtx.ietfLanguageTag,
      languageHintForPrompt: langCtx.languageHintForPrompt,
      userStyleHint: langCtx.userStyleHint,
    });
    const responsePlan = planResponseForIntent({
      intent: {
        family: "report_explanation",
        goal: "Explain uploaded medical report safely",
        responseMode: "answer_with_context",
        confidence: 0.97,
        needsClarification: false,
      },
      ietfLanguageTag: langCtx.ietfLanguageTag,
      hasReportContext: true,
      hasNearbyContext: false,
    });
    const mcpEnabled = process.env.MCP_ENABLED === "1";
    const consentToken = String(form.get("consentToken") ?? "").trim() || null;

    const systemInstruction = composeSystemPrompt(
      buildSharedIdentityRules(),
      buildMedicalSafetyRules(),
      buildNaturalStyleRules(),
      responsePlan.systemRules,
      "You are MaaCare clinical report simplifier for maternity care support.",
      "Extract key lab/vital values and explain in plain patient-friendly language.",
      "Never diagnose. Be conservative and suggest clinician follow-up when uncertain.",
      "Make summary detailed: 5-8 sentences covering important abnormalities, reassuring normal findings, and clinical context.",
      "Make plainExplanation practical: 2 short paragraphs with what it may mean and what to do next.",
      "Return STRICT JSON only (no markdown) with this shape:",
      '{ "summary": string, "plainExplanation": string, "riskLevel": "low"|"medium"|"high", "findings": [{ "name": string, "value": string, "range": string, "status": "normal"|"low"|"high"|"borderline", "note": string }], "recommendations": string[], "extractedVitals": { "systolicBp": number|null, "diastolicBp": number|null, "heartRateBpm": number|null, "weightKg": number|null, "temperatureC": number|null, "glucoseMgDl": number|null, "spo2Pct": number|null }, "extractedProfile": { "conditions": string[], "allergies": string[], "medications": string[], "notes": string } }',
      "If a value is not present, keep it null/empty.",
      languageBlock,
    );
    let mcpKnowledgeContext = "";

    let extractedText = reportTextInput;
    let extractionMode:
      | "provided_text"
      | "pdf_local"
      | "ocr_local"
      | "text_local"
      | "groq_vision_ocr"
      | "gemini_file"
      | "groq_vision_file" = "provided_text";
    let includeRawFileForGemini = false;
    let extractionFailureReason: string | null = null;
    let visionImagePayload: { base64: string; mimeType: string } | null = null;

    let fallbackPdfBase64: string | null = null;
    if (!extractedText && reportFile instanceof File) {
      const local = await extractTextFromFileLocally(reportFile);
      if ((local.text ?? "").trim().length >= MIN_LOCAL_TEXT_CHARS) {
        extractedText = local.text;
        extractionMode = local.mode === "none" ? "text_local" : local.mode;
      } else if (isImageUpload && gKeys.length > 0) {
        visionImagePayload = await imageFileToVisionBase64(reportFile);
        if (visionImagePayload) {
          const groqOcrText = await extractTextWithGroqVisionFailover(
            visionImagePayload.base64,
            visionImagePayload.mimeType,
            MIN_LOCAL_TEXT_CHARS,
          );
          if (groqOcrText) {
            extractedText = groqOcrText;
            extractionMode = "groq_vision_ocr";
          }
        }
      }

      if (!extractedText) {
        extractionFailureReason =
          "Could not read enough text from the uploaded file on server. Try a clearer file or paste the report text.";
        if (isImageUpload) {
          if (!visionImagePayload) {
            visionImagePayload = await imageFileToVisionBase64(reportFile);
          }
          fallbackPdfBase64 = await imageToPdfBase64(reportFile);
          if (!fallbackPdfBase64 && !visionImagePayload) {
            return failJson(
              400,
              "Could not read enough text from image locally. Please upload a clearer image or paste report text.",
            );
          }
          includeRawFileForGemini = Boolean(fallbackPdfBase64);
          extractionMode = "gemini_file";
        } else {
          includeRawFileForGemini = true;
          extractionMode = "gemini_file";
        }
      }
    }
    if (mcpEnabled) {
      const mcpPlan = mcpPlanForRoute({
        route: "reports_analyze",
        intentFamily: "report_explanation",
        requestedTools: ["search_medical_knowledge"],
        consentToken,
      });
      if (mcpPlan.allowedTools.includes("search_medical_knowledge")) {
        const mcpCtx = buildToolCallContext({
          route: "reports_analyze",
          intentFamily: "report_explanation",
          userId: session.id,
          allowWrites: mcpPlan.allowWrites,
          consentToken,
          maxToolCalls: mcpPlan.maxToolCalls,
        });
        const mcpOut = await executeMcpTool({
          name: "search_medical_knowledge",
          args: {
            query: [
              reportTitle,
              extractedText ? clipText(extractedText, 1000) : "",
              "maternal risk interpretation and safe next steps",
            ]
              .filter(Boolean)
              .join(" "),
            language: langCtx.ietfLanguageTag,
            audienceType: "member",
            maxResults: 4,
          },
          ctx: mcpCtx,
        });
        if (mcpOut.ok && Array.isArray(mcpOut.data?.hits)) {
          mcpKnowledgeContext = (mcpOut.data.hits as Array<{ content?: string }>)
            .map((h, i) => `[MCP-${i + 1}] ${h.content ?? ""}`)
            .join("\n");
        }
      }
    }

    const userParts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];
    userParts.push({
      text: `Report title: ${reportTitle || "Untitled medical report"}\nUser: ${session.name}\n`,
    });
    if (extractedText) {
      userParts.push({
        text: `Report text (may be extracted from file):\n${clipText(extractedText, MAX_REPORT_TEXT_FOR_AI)}${mcpKnowledgeContext ? `\n\nMCP context:\n${mcpKnowledgeContext}` : ""}`,
      });
    }
    if (includeRawFileForGemini && reportFile instanceof File) {
      if (isImageUpload && fallbackPdfBase64) {
        userParts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: fallbackPdfBase64,
          },
        });
      } else {
        const bytes = await reportFile.arrayBuffer();
        userParts.push({
          inlineData: {
            mimeType: reportFile.type || "application/octet-stream",
            data: toBase64(bytes),
          },
        });
      }
    }

    let rawText = "";
    let provider: "gemini" | "groq" = "gemini";
    const errors: string[] = [];

    for (const key of keys) {
      try {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({
          model: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
          systemInstruction,
        });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: userParts }],
        });
        rawText = result.response.text().trim();
        if (rawText) break;
      } catch (e) {
        errors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!rawText && extractedText) {
      const groqUserMessage = [
        `Report title: ${reportTitle || "Untitled medical report"}`,
        `User: ${session.name}`,
        "",
        `Report text:\n${clipText(extractedText, MAX_REPORT_TEXT_FOR_AI)}`,
        mcpKnowledgeContext ? `\nMCP context:\n${mcpKnowledgeContext}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      for (const key of gKeys) {
        try {
          rawText = await generateWithGroq(key, systemInstruction, groqUserMessage, {
            temperature: 0.2,
            model: getGroqReportModelName(),
          });
          provider = "groq";
          break;
        } catch (e) {
          errors.push(`groq: ${e instanceof Error ? e.message : String(e)}`);
          if (!isRateLimitError(String(e))) break;
        }
      }
    }

    if (
      !rawText &&
      includeRawFileForGemini &&
      isImageUpload &&
      visionImagePayload &&
      gKeys.length > 0
    ) {
      const contextText = [
        `Report title: ${reportTitle || "Untitled medical report"}`,
        `User: ${session.name}`,
        mcpKnowledgeContext ? `MCP context:\n${mcpKnowledgeContext}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const groqVisionReply = await analyzeReportWithGroqVisionFailover(
        systemInstruction,
        visionImagePayload.base64,
        visionImagePayload.mimeType,
        contextText,
      );
      if (groqVisionReply) {
        rawText = groqVisionReply;
        provider = "groq";
        extractionMode = "groq_vision_file";
      }
    }

    if (!rawText) {
      if (errors.length > 0 && errors.every((e) => isRateLimitError(e))) {
        return Response.json(
          {
            error: "AI usage limit reached. Please wait about 1 minute and try again.",
            retryAfterSeconds: 60,
          },
          { status: 429 },
        );
      }
      if (includeRawFileForGemini && !extractedText && extractionFailureReason) {
        return Response.json(
          {
            error: extractionFailureReason,
            hint: "Use Paste text for best reliability on production deployments.",
          },
          { status: 422 },
        );
      }
      return failJson(500, "Could not analyze report right now.");
    }

    const jsonText = extractJson(rawText);
    if (!jsonText) return failJson(500, "Could not parse AI report analysis.");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      return failJson(500, "Could not parse AI report analysis.");
    }

    const parsed = responseSchema.safeParse(parsedJson);
    if (!parsed.success) return failJson(500, "AI response format was invalid.");

    const analysis = parsed.data;
    const userFacingSource =
      reportTextInput || reportTitle || "please explain my medical report";
    const [summaryPost, explanationPost] = await Promise.all([
      postProcessMultilingualReply({
        reply: analysis.summary,
        latestUserMessage: userFacingSource,
        ietfLanguageTag: langCtx.ietfLanguageTag,
        userStyleHint: langCtx.userStyleHint,
      }),
      postProcessMultilingualReply({
        reply: analysis.plainExplanation,
        latestUserMessage: userFacingSource,
        ietfLanguageTag: langCtx.ietfLanguageTag,
        userStyleHint: langCtx.userStyleHint,
      }),
    ]);
    const cleanedAnalysis = {
      ...analysis,
      summary: enforceNaturalResponseQuality(summaryPost.reply),
      plainExplanation: enforceNaturalResponseQuality(explanationPost.reply),
      recommendations: analysis.recommendations
        .map((r) => enforceNaturalResponseQuality(r))
        .filter(Boolean),
      findings: analysis.findings.map((f) => ({
        ...f,
        note: enforceNaturalResponseQuality(f.note ?? ""),
      })),
      extractedProfile: {
        ...analysis.extractedProfile,
        notes: enforceNaturalResponseQuality(analysis.extractedProfile.notes ?? ""),
      },
    };

    let savedVitalId: string | null = null;
    let savedConditions = 0;
    let savedAllergies = 0;
    let savedMedications = 0;
    let profileNotesUpdated = false;

    if (saveVitals && hasAnyVitals(cleanedAnalysis.extractedVitals)) {
      const { data: inserted, error: vitErr } = await supabase
        .from("vital_signs")
        .insert({
          user_id: session.id,
          recorded_at: new Date().toISOString(),
          systolic_bp: cleanedAnalysis.extractedVitals.systolicBp ?? null,
          diastolic_bp: cleanedAnalysis.extractedVitals.diastolicBp ?? null,
          heart_rate_bpm: cleanedAnalysis.extractedVitals.heartRateBpm ?? null,
          weight_kg: cleanedAnalysis.extractedVitals.weightKg ?? null,
          temperature_c: cleanedAnalysis.extractedVitals.temperatureC ?? null,
          glucose_mg_dl: cleanedAnalysis.extractedVitals.glucoseMgDl ?? null,
          spo2_pct: cleanedAnalysis.extractedVitals.spo2Pct ?? null,
          notes: `Auto-extracted from report: ${reportTitle || "Untitled report"}`,
          source: "report_ai",
        })
        .select("id")
        .single();
      if (!vitErr && inserted?.id) savedVitalId = String(inserted.id);
    }

    if (saveProfileInsights) {
      const conditions = Array.from(
        new Set(
          (cleanedAnalysis.extractedProfile.conditions ?? [])
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ).slice(0, 20);
      const allergies = Array.from(
        new Set(
          (cleanedAnalysis.extractedProfile.allergies ?? [])
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ).slice(0, 20);
      const medications = Array.from(
        new Set(
          (cleanedAnalysis.extractedProfile.medications ?? [])
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ).slice(0, 20);

      if (conditions.length) {
        const { error } = await supabase.from("medical_conditions").insert(
          conditions.map((conditionName) => ({
            user_id: session.id,
            condition_name: conditionName,
            status: "active",
            notes: `Extracted from report: ${reportTitle || "Untitled report"}`,
          })),
        );
        if (!error) savedConditions = conditions.length;
      }

      if (allergies.length) {
        const { error } = await supabase.from("allergies").insert(
          allergies.map((name) => ({
            user_id: session.id,
            allergen_type: "other",
            name,
            notes: `Extracted from report: ${reportTitle || "Untitled report"}`,
          })),
        );
        if (!error) savedAllergies = allergies.length;
      }

      if (medications.length) {
        const { error } = await supabase.from("medications").insert(
          medications.map((name) => ({
            user_id: session.id,
            name,
            is_active: true,
            notes: `Extracted from report: ${reportTitle || "Untitled report"}`,
          })),
        );
        if (!error) savedMedications = medications.length;
      }

      const notes = cleanedAnalysis.extractedProfile.notes?.trim();
      if (notes) {
        const { error } = await supabase.from("user_health_profiles").upsert(
          {
            user_id: session.id,
            notes,
          },
          { onConflict: "user_id" },
        );
        if (!error) profileNotesUpdated = true;
      }
    }

    return Response.json({
      ...cleanedAnalysis,
      provider,
      extractionMode,
      extractedTextPreview: extractedText ? clipText(extractedText, 800) : "",
      savedVitalId,
      savedVitals: !!savedVitalId,
      savedProfile: {
        conditions: savedConditions,
        allergies: savedAllergies,
        medications: savedMedications,
        notesUpdated: profileNotesUpdated,
      },
    });
  } catch (e) {
    return serverErrorJson("reports_analyze POST", e);
  }
}
