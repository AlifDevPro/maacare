import type { SignupProfileDraft } from "@/lib/signup/signup-draft";
import { fallbackQuestionForOnboardingFocusLocalized } from "@/lib/signup/onboarding-copy";

export type OnboardingNextFocus =
  | "ask_display_name"
  | "ask_profession"
  | "ask_pregnancy_relevance"
  | "ask_parent_context"
  | "ask_student_context"
  | "ask_clinician_context"
  | "ask_optional_health_context"
  | "ready_for_secure_step";

const PROFESSION_LABEL: Record<string, string> = {
  parent_caregiver: "Parent or caregiver",
  clinician: "Clinician",
  student_researcher: "Student or researcher",
  other: "Student or researcher",
};

function professionLabel(p: string): string {
  return PROFESSION_LABEL[p] ?? p;
}

/** Human-readable one-liner of what the app already has (for the model). */
export function buildFilledSummary(d: SignupProfileDraft): string {
  const parts: string[] = [];
  const name = d.displayName.trim();
  if (name) parts.push(`displayName is set to "${name}"`);
  if (d.profession) parts.push(`profession is "${professionLabel(d.profession)}" (${d.profession})`);
  if (d.pregnancyStatus) parts.push(`pregnancyStatus is "${d.pregnancyStatus}"`);
  if (d.lmpDate.trim()) parts.push(`lmpDate is set`);
  if (d.eddDate.trim()) parts.push(`eddDate is set`);
  if (d.phone.trim()) parts.push(`phone is set`);
  return parts.length ? parts.join("; ") : "No structured fields filled yet.";
}

export function deriveOnboardingFocus(d: SignupProfileDraft): {
  nextFocus: OnboardingNextFocus;
  modelInstruction: string;
} {
  if (!d.displayName.trim()) {
    return {
      nextFocus: "ask_display_name",
      modelInstruction:
        "Ask only for their name (display name). Use a direct question like 'What is your name?'. Do not ask for profession, journey, or dates yet. Do not ask for email or password. Keep the reply to one short paragraph plus one question.",
    };
  }
  if (!d.profession) {
    return {
      nextFocus: "ask_profession",
      modelInstruction:
        `Their name is already saved as "${d.displayName.trim()}". Thank them briefly by name. Ask which role fits best using numbered options: 1) Parent or Caregiver, 2) Healthcare Professional, 3) Student or Researcher. Do not ask for their name again. If they say they are not pregnant or are a student/researcher, set pregnancyStatus to not_applicable when appropriate.`,
    };
  }

  if (d.profession === "parent_caregiver") {
    const hasPregnancyContext =
      d.pregnancyStatus !== "not_applicable" ||
      d.primaryUseCase === "partner_support" ||
      d.primaryUseCase === "other_caregiver" ||
      d.lmpDate.trim().length > 0 ||
      d.eddDate.trim().length > 0 ||
      d.gestationalAgeWeeks.trim().length > 0 ||
      d.babyBirthDate.trim().length > 0 ||
      d.gravida.trim().length > 0 ||
      d.para.trim().length > 0;
    if (!hasPregnancyContext) {
      return {
        nextFocus: "ask_pregnancy_relevance",
        modelInstruction:
          `Name and role are saved ("${d.displayName.trim()}", Parent or caregiver). Ask one focused pregnancy relevance question next: are they pregnant, planning, postpartum, or supporting/researching (not_applicable). If they are supporting someone else, set primaryUseCase to partner_support or other_caregiver.`,
      };
    }
    if (!d.healthNotes.trim() && !d.conditionsText.trim()) {
      return {
        nextFocus: "ask_parent_context",
        modelInstruction:
          "Ask one practical maternal-support question to personalize guidance (for example: key concern, symptom, or goal). Save concise notes into healthNotes or conditionsText.",
      };
    }
    return {
      nextFocus: "ready_for_secure_step",
      modelInstruction:
        `Name, role, and parent context are saved ("${d.displayName.trim()}", Parent or caregiver). Keep it brief and direct them to continue in the secure email/password step below.`,
    };
  }

  if (d.profession === "student_researcher") {
    if (d.primaryUseCase !== "student_research") {
      return {
        nextFocus: "ask_student_context",
        modelInstruction:
          "Ask one study-intent question and set primaryUseCase to student_research. Collect a short study context if possible.",
      };
    }
    if (!d.studentAffiliation.trim() && !d.studentFieldOfStudy.trim() && !d.healthNotes.trim()) {
      return {
        nextFocus: "ask_student_context",
        modelInstruction:
          "Ask one focused study-context question (field of study, affiliation, or research goal). Save to studentFieldOfStudy, studentAffiliation, or healthNotes.",
      };
    }
    return {
      nextFocus: "ready_for_secure_step",
      modelInstruction:
        `Name, role, and student context are saved ("${d.displayName.trim()}", Student or researcher). Keep it short and direct them to continue in the secure email/password step below.`,
    };
  }

  if (d.profession === "clinician") {
    if (d.primaryUseCase !== "clinician") {
      return {
        nextFocus: "ask_clinician_context",
        modelInstruction:
          "Ask one clinician-use question and set primaryUseCase to clinician.",
      };
    }
    if (!d.clinicianSpecialty.trim() && !d.clinicianInstitution.trim() && !d.healthNotes.trim()) {
      return {
        nextFocus: "ask_clinician_context",
        modelInstruction:
          "Ask one focused clinician-context question (specialty, institution, or intended use). Save to clinicianSpecialty, clinicianInstitution, or healthNotes.",
      };
    }
    return {
      nextFocus: "ready_for_secure_step",
      modelInstruction:
        `Name, role, and clinician context are saved ("${d.displayName.trim()}", Clinician). Keep it brief and direct them to continue in the secure email/password step below.`,
    };
  }

  if (!d.pregnancyStatus) {
    return {
      nextFocus: "ask_pregnancy_relevance",
      modelInstruction:
        `Name and role are already saved ("${d.displayName.trim()}", ${professionLabel(d.profession)}). Ask exactly one focused pregnancy relevance question next: are they planning, pregnant, postpartum, or using MaaCare mainly for support/research (not_applicable). If they state they are not pregnant, not expecting, or using the app for learning/support only, set pregnancyStatus to not_applicable in DRAFT_PATCH.`,
    };
  }
  if (!d.healthNotes.trim() && !d.conditionsText.trim()) {
    return {
      nextFocus: "ask_optional_health_context",
      modelInstruction:
        `Name, role, and pregnancy relevance are saved. Ask one short optional health-context question (for example: any condition or concern they want MaaCare to remember). Keep this to one sentence and one question.`,
    };
  }
  return {
    nextFocus: "ready_for_secure_step",
    modelInstruction:
      `Name, role, and pregnancy relevance are already saved ("${d.displayName.trim()}", ${professionLabel(d.profession)}, ${d.pregnancyStatus}). Do not ask for name or role again unless the user corrects them. If the latest user message changes pregnancy intent or role, you MUST update pregnancyStatus and/or profession in DRAFT_PATCH. Briefly confirm they can continue in the secure email/password step below. You may ask one optional follow-up only if it keeps progress clear.`,
  };
}

export function fallbackQuestionForOnboardingFocus(
  focus: OnboardingNextFocus,
  d: SignupProfileDraft,
  lang = "en",
): string {
  return fallbackQuestionForOnboardingFocusLocalized(focus, d.displayName, lang);
}
