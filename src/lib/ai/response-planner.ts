import type { IntentFamily, IntentResult, ResponseMode } from "@/lib/ai/intent";

export type ResponsePlan = {
  mode: ResponseMode;
  shouldRetrieveKnowledge: boolean;
  shouldAskClarifyingQuestion: boolean;
  maxSentences: number;
  maxToolCalls: number;
  allowedToolFamilies: Array<"profile" | "knowledge" | "reports" | "facilities" | "planner" | "observability">;
  shouldSearchUserReports: boolean;
  directAnswerFirst: boolean;
  avoidOpeningSmallTalk: boolean;
  systemRules: string[];
};

function sentenceBudgetForIntent(family: IntentFamily, voice: boolean): number {
  if (voice) return family === "greeting" || family === "identity" ? 2 : 3;
  if (family === "greeting" || family === "identity") return 2;
  return 5;
}

export function planResponseForIntent(input: {
  intent: IntentResult;
  ietfLanguageTag: string;
  hasReportContext: boolean;
  hasNearbyContext: boolean;
  voice?: boolean;
}): ResponsePlan {
  const voice = input.voice === true;
  const baseRules: string[] = [
    "Answer the user goal directly before adding extra guidance.",
    "Keep tone natural, concise, and human.",
  ];

  let shouldRetrieveKnowledge = true;
  let shouldAskClarifyingQuestion = false;
  let maxToolCalls = 2;
  const family = input.intent.family;
  let allowedToolFamilies: ResponsePlan["allowedToolFamilies"] = ["profile", "knowledge", "reports"];
  let shouldSearchUserReports =
    family === "report_explanation" || family === "general_health" || family === "symptom_guidance";
  let mode: ResponseMode = input.intent.responseMode;
  let directAnswerFirst = true;
  let avoidOpeningSmallTalk = false;

  if (family === "greeting" || family === "identity" || family === "smalltalk") {
    shouldRetrieveKnowledge = false;
    maxToolCalls = family === "identity" ? 1 : 0;
    allowedToolFamilies = family === "identity" ? ["profile"] : [];
    mode = "answer_without_context";
    baseRules.push("Keep response short and welcoming.");
    if (family === "identity") {
      avoidOpeningSmallTalk = true;
      baseRules.push("For identity/name asks, first sentence must directly answer the question.");
      baseRules.push("Do not start with greeting fillers before the answer.");
    }
  } else if (family === "nearby_facilities") {
    shouldRetrieveKnowledge = false;
    maxToolCalls = 2;
    allowedToolFamilies = ["facilities"];
    baseRules.push("Focus on concrete nearby-care next steps.");
  } else if (family === "report_explanation" && input.hasReportContext) {
    shouldRetrieveKnowledge = true;
    shouldSearchUserReports = true;
    maxToolCalls = 3;
    allowedToolFamilies = ["knowledge", "reports"];
    baseRules.push("Use provided report context and the user's saved reports before generic retrieval.");
  } else if (family === "offtopic") {
    shouldRetrieveKnowledge = false;
    maxToolCalls = 0;
    allowedToolFamilies = [];
    mode = "brief_redirect";
    baseRules.push("Briefly acknowledge then steer back to maternal and wellness topics.");
  }

  if (input.intent.needsClarification || input.intent.confidence < 0.55) {
    shouldAskClarifyingQuestion = true;
    mode = "ask_clarification";
    shouldRetrieveKnowledge = false;
    shouldSearchUserReports = false;
    maxToolCalls = Math.min(maxToolCalls, 1);
    directAnswerFirst = false;
    baseRules.push("Ask one focused clarifying question and avoid assumptions.");
  }

  if (input.hasNearbyContext) {
    baseRules.push("Nearby facilities context is available; prioritize it when relevant.");
  }

  if (input.ietfLanguageTag.startsWith("bn")) {
    baseRules.push("Bangla output should sound native and conversational.");
  }

  return {
    mode,
    shouldRetrieveKnowledge,
    shouldSearchUserReports,
    shouldAskClarifyingQuestion,
    maxSentences: sentenceBudgetForIntent(family, voice),
    maxToolCalls,
    allowedToolFamilies,
    directAnswerFirst,
    avoidOpeningSmallTalk,
    systemRules: baseRules,
  };
}
