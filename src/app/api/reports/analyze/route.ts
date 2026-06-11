import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";

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
  generateWithGroq,
  getGroqReportModelName,
  isRateLimitError,
} from "@/lib/gemini/text-failover";
import { enforceSubscriptionFeature } from "@/lib/subscription/enforce";
import { consumeFeatureUsage } from "@/lib/subscription/repository";
import { persistReportIntelligence } from "@/lib/reports/intelligence";
import { updateReportStoragePaths } from "@/lib/reports/repository";
import { uploadReportImage } from "@/lib/reports/storage";
import {
  clipReportText,
  resolveReportTextFromUpload,
  type ExtractionMode,
} from "@/lib/reports/extraction";
import {
  classifyReportFile,
  fileToBase64,
  isReportImageFile,
  MAX_REPORT_FILE_BYTES,
  validateReportUploadFile,
} from "@/lib/reports/file-utils";
import {
  buildNonReportFallback,
  hasAnyVitals,
  parseReportAnalysisFromModelText,
  sanitizeReportAnalysis,
  type ReportAnalysis,
} from "@/lib/reports/parse-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    } else if (mime.includes("jpeg") || mime.includes("jpg")) {
      image = await pdf.embedJpg(bytes);
    } else {
      return null;
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

function buildReportSystemInstruction(languageBlock: string | string[]): string {
  return composeSystemPrompt(
    buildSharedIdentityRules(),
    buildMedicalSafetyRules(),
    buildNaturalStyleRules(),
    "You are MaaCare report simplifier for maternity care support.",
    "Turn medical reports into short, clear summaries for patients.",
    "Never diagnose. Be conservative and suggest clinician follow-up only when a result is clearly concerning.",
    "STEP 1 — Classify the input before summarizing:",
    "- If the upload is NOT a medical/lab/clinical report (e.g. random photo, meme, selfie, receipt, landscape, pet, blank image, or unrelated text): set isMedicalReport to false.",
    "- If the image or text is too blurry, dark, cropped, or incomplete to identify as a report: set isMedicalReport to false and explain that a clearer photo is needed.",
    "- If the input IS a valid medical report: set isMedicalReport to true and summarize normally.",
    "When isMedicalReport is false: write a friendly 1-2 sentence summary and plainExplanation telling the user this is not a medical report (or is unreadable). Leave findings, recommendations, extractedVitals, and extractedProfile empty.",
    "When isMedicalReport is true:",
    "Classify documentType as one of: lab (lab results), prescription (medication orders), imaging (ultrasound, X-ray, scan reports), clinical_note (visit summaries, discharge notes), or other.",
    "Focus ONLY on important information: abnormal results, key diagnoses, medications, and actionable follow-ups.",
    "Omit boilerplate, legal disclaimers, generic wellness tips, and filler unless critical to safety.",
    "summary: 2-4 concise sentences highlighting what matters most.",
    "plainExplanation: 1 short paragraph in everyday language explaining the main takeaway.",
    "findings: include only notable lab/vital values (skip routine normals unless the patient should know). Max 12 items.",
    "recommendations: max 3 specific, practical next steps tied to the report. No generic 'talk to your doctor' lines.",
    "Return STRICT JSON only (no markdown) with this shape:",
    '{ "isMedicalReport": boolean, "documentType": "lab"|"prescription"|"imaging"|"clinical_note"|"other", "summary": string, "plainExplanation": string, "riskLevel": "low"|"medium"|"high", "findings": [{ "name": string, "value": string, "range": string, "status": "normal"|"low"|"high"|"borderline", "note": string }], "recommendations": string[], "extractedVitals": { "systolicBp": number|null, "diastolicBp": number|null, "heartRateBpm": number|null, "weightKg": number|null, "temperatureC": number|null, "glucoseMgDl": number|null, "spo2Pct": number|null }, "extractedProfile": { "conditions": string[], "allergies": string[], "medications": string[], "notes": string } }',
    "If a value is not present, keep it null/empty.",
    languageBlock,
  );
}

async function finalizeAnalysisResponse(input: {
  analysis: ReportAnalysis;
  reportTextInput: string;
  reportTitle: string;
  langCtx: { ietfLanguageTag: string; userStyleHint?: "native_script" | "latin_transliteration" | "mixed_code_switch" };
  saveVitals: boolean;
  saveProfileInsights: boolean;
  persistReport: boolean;
  session: { id: string; name: string };
  reportTitleForNotes: string;
  provider: "gemini" | "groq";
  extractionMode: ExtractionMode;
  extractedText?: string;
  inputMode: "file" | "text";
  fileMeta?: { name: string; mime: string; size: number } | null;
  reportFile?: File | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const {
    analysis,
    reportTextInput,
    reportTitle,
    langCtx,
    saveVitals,
    saveProfileInsights,
    persistReport,
    session,
    reportTitleForNotes,
    provider,
    extractionMode,
    extractedText,
    inputMode,
    fileMeta,
    reportFile,
    supabase,
  } = input;

  const userFacingSource = reportTextInput || reportTitle || "please explain my medical report";
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

  const cleanedAnalysis = sanitizeReportAnalysis({
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
  });

  const isMedical = cleanedAnalysis.isMedicalReport !== false;
  let savedVitalId: string | null = null;
  let savedConditions = 0;
  let savedAllergies = 0;
  let savedMedications = 0;
  let profileNotesUpdated = false;

  if (isMedical && saveVitals && hasAnyVitals(cleanedAnalysis.extractedVitals)) {
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
        notes: `Auto-extracted from report: ${reportTitleForNotes}`,
        source: "report_ai",
      })
      .select("id")
      .single();
    if (!vitErr && inserted?.id) savedVitalId = String(inserted.id);
  }

  if (isMedical && saveProfileInsights) {
    const conditions = cleanedAnalysis.extractedProfile.conditions.slice(0, 20);
    const allergies = cleanedAnalysis.extractedProfile.allergies.slice(0, 20);
    const medications = cleanedAnalysis.extractedProfile.medications.slice(0, 20);

    if (conditions.length) {
      const { error } = await supabase.from("medical_conditions").insert(
        conditions.map((conditionName) => ({
          user_id: session.id,
          condition_name: conditionName,
          status: "active",
          notes: `Extracted from report: ${reportTitleForNotes}`,
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
          notes: `Extracted from report: ${reportTitleForNotes}`,
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
          notes: `Extracted from report: ${reportTitleForNotes}`,
        })),
      );
      if (!error) savedMedications = medications.length;
    }

    const notes = cleanedAnalysis.extractedProfile.notes?.trim();
    if (notes) {
      const { error } = await supabase.from("user_health_profiles").upsert(
        { user_id: session.id, notes },
        { onConflict: "user_id" },
      );
      if (!error) profileNotesUpdated = true;
    }
  }

  let savedReportId: string | null = null;
  let reportAvailableToAi = false;
  let saveError: string | null = null;

  if (persistReport) {
    try {
      const title =
        reportTitle.trim() ||
        (fileMeta?.name ? fileMeta.name.replace(/\.[^.]+$/, "") : "") ||
        "Medical report";
      const { report, indexed } = await persistReportIntelligence({
        userId: session.id,
        title,
        inputMode,
        fileName: fileMeta?.name ?? null,
        fileMime: fileMeta?.mime ?? null,
        fileSizeBytes: fileMeta?.size ?? null,
        extractedText: extractedText ?? reportTextInput ?? null,
        analysis: cleanedAnalysis,
        provider,
        extractionMode,
      });
      savedReportId = report.id;
      reportAvailableToAi = indexed && cleanedAnalysis.isMedicalReport !== false;

      if (inputMode === "file" && reportFile && isReportImageFile(reportFile)) {
        try {
          const { bucket, path } = await uploadReportImage(supabase, session.id, report.id, reportFile);
          await updateReportStoragePaths(supabase, report.id, session.id, bucket, path);
        } catch (uploadErr) {
          console.error("[reports_analyze] image upload failed", uploadErr);
        }
      }
    } catch (e) {
      saveError = e instanceof Error ? e.message : "Could not save report to your history.";
      console.error("[reports_analyze] persist failed", e);
    }
  }

  try {
    await consumeFeatureUsage(supabase, session.id, "report_simplification");
  } catch (consumeErr) {
    console.error("[reports_analyze] usage consume failed", consumeErr);
  }

  return Response.json({
    ...cleanedAnalysis,
    provider,
    extractionMode,
    savedVitalId,
    savedVitals: !!savedVitalId,
    savedReportId,
    saveError,
    reportAvailableToAi,
    savedProfile: {
      conditions: savedConditions,
      allergies: savedAllergies,
      medications: savedMedications,
      notesUpdated: profileNotesUpdated,
    },
  });
}

type UserPart = { text: string } | { inlineData: { mimeType: string; data: string } };

async function buildMultimodalUserParts(input: {
  reportFile: File;
  reportTitle: string;
  sessionName: string;
  extractedText: string;
  mcpKnowledgeContext: string;
}): Promise<UserPart[]> {
  const { reportFile, reportTitle, sessionName, extractedText, mcpKnowledgeContext } = input;
  const parts: UserPart[] = [
    {
      text: `Report title: ${reportTitle || "Medical report"}\nUser: ${sessionName}\n`,
    },
  ];

  if (extractedText) {
    parts.push({
      text: `Report text:\n${clipReportText(extractedText)}${mcpKnowledgeContext ? `\n\nReference context:\n${mcpKnowledgeContext}` : ""}`,
    });
  } else if (mcpKnowledgeContext) {
    parts.push({ text: `Reference context:\n${mcpKnowledgeContext}` });
  }

  if (isReportImageFile(reportFile)) {
    const pdfBase64 = await imageToPdfBase64(reportFile);
    if (pdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
      return parts;
    }
    const imageBase64 = await fileToBase64(reportFile);
    if (imageBase64) {
      const mime = (reportFile.type || "image/jpeg").toLowerCase();
      parts.push({
        inlineData: {
          mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
          data: imageBase64,
        },
      });
      return parts;
    }
  } else {
    const rawBase64 = await fileToBase64(reportFile);
    if (rawBase64) {
      parts.push({
        inlineData: {
          mimeType: reportFile.type || "application/pdf",
          data: rawBase64,
        },
      });
    }
  }

  return parts;
}

async function generateWithGeminiKeys(
  keys: string[],
  systemInstruction: string,
  userParts: UserPart[],
): Promise<{ rawText: string; errors: string[] }> {
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
      const rawText = result.response.text().trim();
      if (rawText) return { rawText, errors };
    } catch (e) {
      errors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { rawText: "", errors };
}

async function generateWithGroqTextKeys(
  keys: string[],
  systemInstruction: string,
  userMessage: string,
): Promise<{ rawText: string; errors: string[] }> {
  const errors: string[] = [];
  for (const key of keys) {
    try {
      const rawText = await generateWithGroq(key, systemInstruction, userMessage, {
        temperature: 0.2,
        model: getGroqReportModelName(),
      });
      if (rawText) return { rawText, errors };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`groq: ${msg}`);
      if (!isRateLimitError(msg)) break;
    }
  }
  return { rawText: "", errors };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const reportGate = await enforceSubscriptionFeature(session.id, "report_simplification");
    if (!reportGate.ok) return reportGate.response;

    const form = await req.formData();
    const reportTitle = String(form.get("reportTitle") ?? "").trim();
    const reportTextInput = String(form.get("reportText") ?? "").trim();
    const saveVitals = String(form.get("saveVitals") ?? "true") === "true";
    const saveProfileInsights = String(form.get("saveProfileInsights") ?? "true") === "true";
    const reportFile = form.get("file") instanceof File ? (form.get("file") as File) : null;
    const inputMode: "file" | "text" = reportFile && !reportTextInput ? "file" : "text";
    const fileMeta = reportFile
      ? { name: reportFile.name, mime: reportFile.type || "application/octet-stream", size: reportFile.size }
      : null;
    const persistReport =
      String(form.get("persistReport") ?? form.get("saveVitals") ?? "true") === "true";

    if (!reportTextInput && !reportFile) {
      return failJson(400, "Add report text or upload an image of your report.");
    }
    if (reportFile) {
      const validationError = validateReportUploadFile(reportFile);
      if (validationError) return failJson(400, validationError);
      if (reportFile.size > MAX_REPORT_FILE_BYTES) {
        return failJson(400, "This file is too large. Please use an image under 10 MB.");
      }
    }

    const geminiKeys = getGeminiApiKeys();
    const groqKeys = getGroqApiKeys();
    if (geminiKeys.length === 0 && groqKeys.length === 0) {
      return failJson(503, "This feature isn't available right now. Please try again later.");
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
      buildReportSystemInstruction(languageBlock),
      responsePlan.systemRules,
    );

    const extraction = await resolveReportTextFromUpload({
      reportTextInput,
      reportFile,
      hasGroqKeys: groqKeys.length > 0,
    });

    let extractionMode: ExtractionMode = extraction.extractionMode;
    let extractedText = extraction.extractedText;
    let visionImagePayload = extraction.visionImagePayload;
    const needsMultimodal = extraction.needsMultimodalAnalysis;

    if (reportFile && !reportTextInput && !extractedText && !needsMultimodal) {
      console.warn("[reports_analyze] empty extraction without multimodal fallback", {
        fileName: reportFile.name,
        kind: classifyReportFile(reportFile),
      });
      return finalizeAnalysisResponse({
        analysis: buildNonReportFallback("unreadable"),
        reportTextInput,
        reportTitle,
        langCtx,
        saveVitals,
        saveProfileInsights,
        persistReport,
        session,
        reportTitleForNotes: reportTitle || "Untitled report",
        provider: "gemini",
        extractionMode,
        extractedText,
        inputMode,
        fileMeta,
        reportFile,
        supabase,
      });
    }

    if (needsMultimodal && reportFile && isReportImageFile(reportFile) && !visionImagePayload) {
      return finalizeAnalysisResponse({
        analysis: buildNonReportFallback("unreadable"),
        reportTextInput,
        reportTitle,
        langCtx,
        saveVitals,
        saveProfileInsights,
        persistReport,
        session,
        reportTitleForNotes: reportTitle || "Untitled report",
        provider: "gemini",
        extractionMode,
        extractedText,
        inputMode,
        fileMeta,
        reportFile,
        supabase,
      });
    }

    let mcpKnowledgeContext = "";
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
              extractedText ? clipReportText(extractedText, 1000) : "",
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
            .map((h, i) => `[${i + 1}] ${h.content ?? ""}`)
            .join("\n");
        }
      }
    }

    const userParts: UserPart[] = needsMultimodal && reportFile
      ? await buildMultimodalUserParts({
          reportFile,
          reportTitle,
          sessionName: session.name,
          extractedText,
          mcpKnowledgeContext,
        })
      : [
          {
            text: [
              `Report title: ${reportTitle || "Medical report"}`,
              `User: ${session.name}`,
              "",
              `Report text:\n${clipReportText(extractedText)}`,
              mcpKnowledgeContext ? `\nReference context:\n${mcpKnowledgeContext}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ];

    if (userParts.every((p) => "text" in p && !p.text.trim()) && !userParts.some((p) => "inlineData" in p)) {
      return finalizeAnalysisResponse({
        analysis: buildNonReportFallback("unreadable"),
        reportTextInput,
        reportTitle,
        langCtx,
        saveVitals,
        saveProfileInsights,
        persistReport,
        session,
        reportTitleForNotes: reportTitle || "Untitled report",
        provider: "gemini",
        extractionMode,
        extractedText,
        inputMode,
        fileMeta,
        reportFile,
        supabase,
      });
    }

    let rawText = "";
    let provider: "gemini" | "groq" = "gemini";
    const errors: string[] = [];

    if (geminiKeys.length > 0) {
      const geminiOut = await generateWithGeminiKeys(geminiKeys, systemInstruction, userParts);
      rawText = geminiOut.rawText;
      errors.push(...geminiOut.errors);
    }

    if (!rawText && extractedText && groqKeys.length > 0) {
      const groqUserMessage = userParts
        .map((p) => ("text" in p ? p.text : "[attached file]"))
        .join("\n");
      const groqOut = await generateWithGroqTextKeys(groqKeys, systemInstruction, groqUserMessage);
      rawText = groqOut.rawText;
      if (rawText) provider = "groq";
      errors.push(...groqOut.errors);
    }

    if (
      !rawText &&
      needsMultimodal &&
      reportFile &&
      isReportImageFile(reportFile) &&
      visionImagePayload &&
      groqKeys.length > 0
    ) {
      const contextText = [
        `Report title: ${reportTitle || "Medical report"}`,
        `User: ${session.name}`,
        mcpKnowledgeContext ? `Reference context:\n${mcpKnowledgeContext}` : "",
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
      console.error("[reports_analyze] all providers failed", { errors, needsMultimodal, fileName: reportFile?.name });
      if (errors.length > 0 && errors.every((e) => isRateLimitError(e))) {
        return Response.json(
          {
            error: "rate_limited",
            message: "We're busy right now. Please wait about a minute and try again.",
            retryAfterSeconds: 60,
          },
          { status: 429 },
        );
      }
      return finalizeAnalysisResponse({
        analysis: buildNonReportFallback(needsMultimodal && !extractedText ? "unreadable" : "unknown"),
        reportTextInput,
        reportTitle,
        langCtx,
        saveVitals,
        saveProfileInsights,
        persistReport,
        session,
        reportTitleForNotes: reportTitle || "Untitled report",
        provider: "gemini",
        extractionMode,
        extractedText,
        inputMode,
        fileMeta,
        reportFile,
        supabase,
      });
    }

    let analysis = parseReportAnalysisFromModelText(rawText);
    if (!analysis && groqKeys.length > 0 && geminiKeys.length > 0) {
      const repairInstruction = `${systemInstruction}\n\nYour previous reply was not valid JSON. Reply with STRICT JSON only, no markdown.`;
      const repairMessage = `Fix and return valid JSON for this report analysis attempt:\n${clipReportText(rawText, 4000)}`;
      const repair = await generateWithGroqTextKeys(groqKeys, repairInstruction, repairMessage);
      if (repair.rawText) {
        analysis = parseReportAnalysisFromModelText(repair.rawText);
        if (analysis) provider = "groq";
      }
    }

    if (!analysis) {
      console.error("[reports_analyze] parse failed", { preview: rawText.slice(0, 400) });
      return finalizeAnalysisResponse({
        analysis: buildNonReportFallback("unknown"),
        reportTextInput,
        reportTitle,
        langCtx,
        saveVitals,
        saveProfileInsights,
        persistReport,
        session,
        reportTitleForNotes: reportTitle || "Untitled report",
        provider,
        extractionMode,
        extractedText,
        inputMode,
        fileMeta,
        reportFile,
        supabase,
      });
    }

    return finalizeAnalysisResponse({
      analysis,
      reportTextInput,
      reportTitle,
      langCtx,
      saveVitals,
      saveProfileInsights,
      persistReport,
      session,
      reportTitleForNotes: reportTitle || "Untitled report",
      provider,
      extractionMode,
      extractedText,
      inputMode,
      fileMeta,
      reportFile,
      supabase,
    });
  } catch (e) {
    return serverErrorJson("reports_analyze POST", e);
  }
}
