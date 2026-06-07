export type AiRegressionCase = {
  key: string;
  query: string;
  /** Expected BCP-47 primary tag from CLD3/heuristic detector (pipeline validation). */
  expectedLanguageTag?: string;
  /** Minimum English word count expected in normalized retrieval query (non-English inputs). */
  minEnglishQueryWords?: number;
  expectedResponseBehavior:
    | "direct_identity_assistant"
    | "direct_identity_user"
    | "direct_answer"
    | "clarification";
  expectedIntentFamily:
    | "identity"
    | "greeting"
    | "symptom_guidance"
    | "planning"
    | "nearby_facilities"
    | "report_explanation"
    | "general_health"
    | "offtopic"
    | "unknown";
};

export const AI_REGRESSION_CASES: AiRegressionCase[] = [
  {
    key: "identity_assistant_bn_script",
    query: "তোমার নাম কি?",
    expectedLanguageTag: "bn",
    minEnglishQueryWords: 2,
    expectedResponseBehavior: "direct_identity_assistant",
    expectedIntentFamily: "identity",
  },
  {
    key: "identity_assistant_bn_translit",
    query: "tor nam ki",
    expectedResponseBehavior: "direct_identity_assistant",
    expectedIntentFamily: "identity",
  },
  {
    key: "identity_assistant_en",
    query: "what is your name?",
    expectedLanguageTag: "en",
    expectedResponseBehavior: "direct_identity_assistant",
    expectedIntentFamily: "identity",
  },
  {
    key: "identity_user_bn_script",
    query: "আমার নাম কি?",
    expectedResponseBehavior: "direct_identity_user",
    expectedIntentFamily: "identity",
  },
  {
    key: "identity_user_bn_translit",
    query: "amar nam ki?",
    expectedResponseBehavior: "direct_identity_user",
    expectedIntentFamily: "identity",
  },
  {
    key: "identity_user_ambiguous_short",
    query: "ami k/",
    expectedResponseBehavior: "clarification",
    expectedIntentFamily: "unknown",
  },
  {
    key: "greeting_short",
    query: "hello",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "greeting",
  },
  {
    key: "symptom_mixed_lang",
    query: "amar fever and headache hocche, what should i do",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "symptom_guidance",
  },
  {
    key: "symptom_hinglish",
    query: "mujhe kal se fever aur body pain hai kya karu",
    expectedLanguageTag: "hi",
    minEnglishQueryWords: 3,
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "symptom_guidance",
  },
  {
    key: "symptom_hindi_script",
    query: "मुझे बुखार और सिर दर्द है, क्या करूं?",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "symptom_guidance",
  },
  {
    key: "symptom_banglish",
    query: "amar stomach pain hocche and nausea lagse ki korbo",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "symptom_guidance",
  },
  {
    key: "planner_food_bn",
    query: "আজকে pregnancy meal plan dao",
    expectedLanguageTag: "bn",
    minEnglishQueryWords: 2,
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "planning",
  },
  {
    key: "planner_food_hinglish",
    query: "week 24 pregnancy ke liye aaj ka meal plan do",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "planning",
  },
  {
    key: "nearby_help",
    query: "nearest maternity hospital near me",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "nearby_facilities",
  },
  {
    key: "report_help",
    query: "please explain my CBC report",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "report_explanation",
  },
  {
    key: "offtopic_redirect",
    query: "teach me hacking wifi",
    expectedResponseBehavior: "direct_answer",
    expectedIntentFamily: "offtopic",
  },
  {
    key: "low_confidence_clarify_noise",
    query: "ami ??? qzx 123 kiii",
    expectedResponseBehavior: "clarification",
    expectedIntentFamily: "unknown",
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchRegressionCase(userText: string): AiRegressionCase | null {
  const n = norm(userText);
  if (!n) return null;
  for (const c of AI_REGRESSION_CASES) {
    if (n === norm(c.query)) return c;
  }
  return null;
}
