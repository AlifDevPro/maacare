import type { SignupProfileDraft } from "@/lib/signup/signup-draft";

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
        "Ask only how they would like to be called (preferred name). Do not ask for profession, journey, or dates yet. Do not ask for email or password.",
    };
  }
  if (!d.profession) {
    return {
      nextFocus: "ask_profession",
      modelInstruction:
        `Their preferred name is already saved as "${d.displayName.trim()}". Greet them briefly by name. Ask only how they use MaaCare (parent/caregiver, clinician, or student/researcher). If they say they are not pregnant, not expecting, or not tracking a pregnancy, set pregnancyStatus to not_applicable in DRAFT_PATCH. If they identify as a student, researcher, or academic role, set profession to student_researcher unless they clearly say they are a clinician or a parent/caregiver using the app for family. Do not ask for their name again.`,
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
): string {
  if (focus === "ask_display_name") {
    return "How should we call you?";
  }
  if (focus === "ask_profession") {
    const name = d.displayName.trim();
    return name
      ? `Thanks, ${name}. Which best describes your role: parent/caregiver, clinician, or student/researcher?`
      : "Which best describes your role: parent/caregiver, clinician, or student/researcher?";
  }
  if (focus === "ask_pregnancy_relevance") {
    return "Are you currently pregnant, planning pregnancy, postpartum, or using MaaCare mainly for support/research?";
  }
  if (focus === "ask_parent_context") {
    return "What is the main pregnancy or family-care question you want MaaCare to help with first?";
  }
  if (focus === "ask_student_context") {
    return "What are you studying or researching in maternal health, and where are you studying?";
  }
  if (focus === "ask_clinician_context") {
    return "What is your specialty, and how do you plan to use MaaCare in your clinical work?";
  }
  if (focus === "ask_optional_health_context") {
    return "Any condition or health note you want MaaCare to remember while guiding you?";
  }
  return "You can continue with the secure email and password step below to finish creating your account.";
}
