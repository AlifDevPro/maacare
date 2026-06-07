const AI_META_RE = /\b(as an ai|as a language model|i am an ai|i'm an ai)\b/gi;
const DASH_PAIR_RE = /--+/g;
const MARKDOWN_HEADER_RE = /^\s{0,3}#{1,6}\s+/gm;
const BULLET_PREFIX_RE = /^\s*[-*]\s+/gm;
const BANGLA_CHAR_RE = /[\u0980-\u09FF]/;
const DEVANAGARI_CHAR_RE = /[\u0900-\u097F]/;

function normalizeTextForEchoCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeEcho(reply: string, latestUserMessage: string): boolean {
  const r = normalizeTextForEchoCheck(reply);
  const u = normalizeTextForEchoCheck(latestUserMessage);
  if (!r || !u) return false;
  if (r === u) return true;
  if (r.startsWith(u) && r.length <= Math.max(u.length + 40, Math.ceil(u.length * 1.5))) return true;
  return false;
}

function scriptCounts(text: string): { latin: number; bangla: number; devanagari: number; totalLetters: number } {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const bangla = (text.match(BANGLA_CHAR_RE) ?? []).length;
  const devanagari = (text.match(DEVANAGARI_CHAR_RE) ?? []).length;
  const totalLetters = (text.match(/\p{L}/gu) ?? []).length;
  return { latin, bangla, devanagari, totalLetters };
}

function dominantScript(input: ReturnType<typeof scriptCounts>): "latin" | "bangla" | "devanagari" | "none" {
  if (input.totalLetters === 0) return "none";
  const entries: Array<{ key: "latin" | "bangla" | "devanagari"; value: number }> = [
    { key: "latin", value: input.latin },
    { key: "bangla", value: input.bangla },
    { key: "devanagari", value: input.devanagari },
  ];
  entries.sort((a, b) => b.value - a.value);
  const top = entries[0]!;
  if (top.value / input.totalLetters < 0.45) return "none";
  return top.key;
}

export type QualityEvaluation = {
  ok: boolean;
  confidence: number;
  reasons: string[];
};

export function evaluateResponseQuality(input: {
  reply: string;
  latestUserMessage: string;
  ietfLanguageTag: string;
  minChars?: number;
  alignment?: {
    shortQuery?: boolean;
    identityTarget?: "assistant" | "user" | "none";
    userName?: string | null;
  };
}): QualityEvaluation {
  const reasons: string[] = [];
  const reply = (input.reply ?? "").trim();
  const minChars = input.minChars ?? 18;

  if (!reply) reasons.push("empty");
  if (reply.length > 0 && reply.length < minChars) reasons.push("too_short");
  if (AI_META_RE.test(reply)) reasons.push("ai_meta");
  AI_META_RE.lastIndex = 0;
  if (looksLikeEcho(reply, input.latestUserMessage)) reasons.push("echo");

  const tag = input.ietfLanguageTag.trim().toLowerCase();
  const userScripts = scriptCounts(input.latestUserMessage);
  const replyScripts = scriptCounts(reply);
  const userDominant = dominantScript(userScripts);
  const replyDominant = dominantScript(replyScripts);
  const userLatinHeavy = userScripts.totalLetters > 0 && userScripts.latin / userScripts.totalLetters >= 0.75;
  const replyLatinHeavy = replyScripts.totalLetters > 0 && replyScripts.latin / replyScripts.totalLetters >= 0.75;
  const userNonLatinHeavy =
    userScripts.totalLetters > 0 && (userScripts.bangla + userScripts.devanagari) / userScripts.totalLetters >= 0.45;

  if (!tag.startsWith("en") && userNonLatinHeavy && replyLatinHeavy) {
    reasons.push("language_drift");
  }
  if (
    userDominant !== "none" &&
    replyDominant !== "none" &&
    userDominant !== replyDominant &&
    !(userLatinHeavy && tag.startsWith("en"))
  ) {
    reasons.push("style_drift");
  }

  const nReply = normalizeTextForEchoCheck(reply);
  if (input.alignment?.shortQuery === true) {
    const startsWithSmallTalk =
      /^(kemon|hello|hi|hey|assalamu|আসসালামু|হাই|ধন্যবাদ|thanks)\b/.test(nReply);
    if (startsWithSmallTalk) reasons.push("leading_smalltalk");
  }

  const identityTarget = input.alignment?.identityTarget ?? "none";
  if (identityTarget === "assistant") {
    const hasMaaCare = /\bmaacare\b/i.test(reply);
    const reversedOrder = /\bmaacare\s*,?\s*ami\b|\bami\s*,?\s*maacare\b/i.test(reply);
    if (!hasMaaCare) reasons.push("query_alignment");
    if (reversedOrder) reasons.push("persona_order");
  } else if (identityTarget === "user") {
    const userName = input.alignment?.userName?.trim() ?? "";
    const hasUserName = userName ? nReply.includes(normalizeTextForEchoCheck(userName)) : false;
    if (userName && !hasUserName) reasons.push("query_alignment");
    if (/\bmy name is maacare\b|আমার নাম\s*maacare/i.test(reply)) reasons.push("persona_mismatch");
  }

  const confidence = Math.max(0, Math.min(1, 1 - reasons.length * 0.28));
  return { ok: reasons.length === 0, confidence, reasons };
}

export function enforceNaturalResponseQuality(
  text: string,
  options?: { voice?: boolean; fallback?: string },
): string {
  let out = (text ?? "").trim();
  if (!out) return options?.fallback ?? "I can help with that.";

  out = out.replace(AI_META_RE, " ");
  out = out.replace(DASH_PAIR_RE, " - ");
  out = out.replace(/\s{3,}/g, " ");

  if (options?.voice) {
    out = out
      .replace(MARKDOWN_HEADER_RE, "")
      .replace(BULLET_PREFIX_RE, "")
      .replace(/[*_`>#]/g, "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
  }

  out = out.replace(/\n{3,}/g, "\n\n").trim();
  if (!out) return options?.fallback ?? "I can help with that.";
  return out;
}

export async function withQualityRetry(input: {
  latestUserMessage: string;
  ietfLanguageTag: string;
  generator: (extraRule?: string) => Promise<string>;
  minChars?: number;
  recoveryRule?: string;
  alignment?: {
    shortQuery?: boolean;
    identityTarget?: "assistant" | "user" | "none";
    userName?: string | null;
  };
}): Promise<{ reply: string; retried: boolean; quality: QualityEvaluation }> {
  const first = await input.generator();
  const cleanedFirst = enforceNaturalResponseQuality(first, {
    fallback: "I can help with that. Could you share a bit more detail?",
  });
  const q1 = evaluateResponseQuality({
    reply: cleanedFirst,
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
    minChars: input.minChars,
    alignment: input.alignment,
  });
  if (q1.ok || q1.confidence >= 0.66) {
    return { reply: cleanedFirst, retried: false, quality: q1 };
  }

  const extraRule =
    input.recoveryRule?.trim() ||
    "Quality correction pass: answer the user's intent directly; do not echo the user text; avoid AI-meta language; keep response natural in the user's language.";
  const second = await input.generator(extraRule);
  const cleanedSecond = enforceNaturalResponseQuality(second, {
    fallback: cleanedFirst,
  });
  const q2 = evaluateResponseQuality({
    reply: cleanedSecond,
    latestUserMessage: input.latestUserMessage,
    ietfLanguageTag: input.ietfLanguageTag,
    minChars: input.minChars,
    alignment: input.alignment,
  });
  return q2.ok || q2.confidence >= q1.confidence
    ? { reply: cleanedSecond, retried: true, quality: q2 }
    : { reply: cleanedFirst, retried: false, quality: q1 };
}

export function sanitizeStructuredTextFields<T extends Record<string, unknown>>(
  obj: T,
  keys: Array<keyof T>,
): T {
  const next = { ...obj };
  for (const k of keys) {
    const v = next[k];
    if (typeof v === "string") {
      next[k] = enforceNaturalResponseQuality(v) as T[keyof T];
    }
  }
  return next;
}
