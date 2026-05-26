import { applySexAwareProfileDefaults } from "@/lib/profile/journey-fields";
import type { SignupProfileDraft } from "@/lib/signup/signup-draft";

/** Strong signals user is currently pregnant / trying — do not force not_applicable. */
const PREGNANCY_AFFIRM_RE =
  /\b(pregnant|pregnancy|expecting|due date|edd|lmp|last period|trimester|weeks?\s*\d|gestation|baby on the way|trying to conceive|ttc|ivf|fertility)\b/i;

const NOT_PREGNANT_RE =
  /\b(not pregnant|no pregnancy|not expecting|no baby|not trying|don't want kids|dont want kids|no kids|student|researcher|not applicable to me|no journey|not tracking)\b/i;

const STUDENT_RESEARCHER_RE =
  /\b(student|researcher|phd|academic|university|college)\b/i;

const CLINICIAN_RE = /\b(doctor|nurse|midwife|clinician|physician|provider|obgyn|ob\s*-?\s*gyn)\b/i;

const PARENT_RE = /\b(parent|mom|mother|dad|father|caregiver|family)\b/i;

const MALE_SELF_RE = /\b(\bi am\b|\bi'm\b|\bim\b)\s+(a\s+)?(man|male|father|dad|husband)\b/i;
const FEMALE_SELF_RE = /\b(\bi am\b|\bi'm\b|\bim\b)\s+(a\s+)?(woman|female|mother|mom|wife)\b/i;

function appendHealthNoteLine(notes: string, line: string): string {
  const t = notes.trim();
  const prefix = "From signup:";
  if (t.includes(line.slice(0, 40))) return notes;
  if (!t) return `${prefix} ${line}`;
  return `${t}\n${prefix} ${line}`;
}

/**
 * Conservative heuristics from free-text user messages so structured draft matches intent
 * when the LLM skips fields. Does not override explicit structured fields already set
 * except where noted.
 */
export function normalizeSignupDraftFromUserText(
  draft: SignupProfileDraft,
  latestUserText: string,
  opts?: { recentUserTexts?: string[] },
): SignupProfileDraft {
  const combined = [latestUserText, ...(opts?.recentUserTexts ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (!combined) return draft;

  let next: SignupProfileDraft = { ...draft };

  const affirms = PREGNANCY_AFFIRM_RE.test(combined);
  const negates = NOT_PREGNANT_RE.test(combined);
  const partnerSupport =
    /\b(husband|wife|spouse|partner|supporting)\b/i.test(combined) &&
    /\b(pregnant|pregnancy|her|wife|she|their baby|baby)\b/i.test(combined);

  if (partnerSupport && !affirms) {
    next = { ...next, primaryUseCase: "partner_support", pregnancyStatus: "not_applicable" };
  } else if (negates && !affirms) {
    next = { ...next, pregnancyStatus: "not_applicable" };
  }

  if (!next.displayName.trim() && latestUserText.trim()) {
    const raw = latestUserText.trim();
    const looksLikeName =
      raw.length >= 2 &&
      raw.length <= 80 &&
      !raw.includes("@") &&
      !/^https?:\/\//i.test(raw) &&
      raw.split(/\s+/).length <= 6;
    if (looksLikeName) {
      const extracted =
        raw.match(/(?:i['’]?m|i am|my name is|call me|this is)\s+([^\n,.!?]{2,60})/i)?.[1]?.trim() ??
        raw.split(/\n/)[0]!.trim();
      if (extracted.length >= 2) {
        next = { ...next, displayName: extracted.slice(0, 80) };
      }
    }
  }

  if (!next.sex && MALE_SELF_RE.test(combined) && !FEMALE_SELF_RE.test(combined)) {
    next = { ...next, sex: "male" };
    const d = applySexAwareProfileDefaults({
      sex: "male",
      primaryUseCase: next.primaryUseCase,
      pregnancyStatus: next.pregnancyStatus,
    });
    next = { ...next, primaryUseCase: d.primaryUseCase as SignupProfileDraft["primaryUseCase"], pregnancyStatus: d.pregnancyStatus as SignupProfileDraft["pregnancyStatus"] };
  } else if (!next.sex && FEMALE_SELF_RE.test(combined) && !MALE_SELF_RE.test(combined)) {
    next = { ...next, sex: "female" };
  }

  if (!next.profession) {
    if (CLINICIAN_RE.test(combined)) {
      next = { ...next, profession: "clinician", primaryUseCase: "clinician" };
    } else if (PARENT_RE.test(combined) && !STUDENT_RESEARCHER_RE.test(combined)) {
      next = { ...next, profession: "parent_caregiver", primaryUseCase: "self_maternal" };
    } else if (STUDENT_RESEARCHER_RE.test(combined)) {
      next = { ...next, profession: "student_researcher", primaryUseCase: "student_research" };
      const raw = latestUserText.trim();
      if (raw.length > 2 && raw.length < 500) {
        next = { ...next, healthNotes: appendHealthNoteLine(next.healthNotes, raw) };
      }
    }
  }

  if (next.profession === "clinician" && !next.primaryUseCase) {
    next = { ...next, primaryUseCase: "clinician" };
  } else if (next.profession === "student_researcher" && !next.primaryUseCase) {
    next = { ...next, primaryUseCase: "student_research" };
  } else if (next.profession === "parent_caregiver" && !next.primaryUseCase) {
    next = { ...next, primaryUseCase: "self_maternal" };
  }

  return next;
}

/** Up to `max` user messages before the final user message (for keyword context). */
export function collectRecentUserBodiesBeforeLatest(
  messages: readonly { role: string; content: string }[],
  max: number,
): string[] {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  if (users.length <= 1) return [];
  return users.slice(0, -1).slice(-max);
}
