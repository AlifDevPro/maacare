import type { SignupProfileDraft } from "@/lib/signup/signup-draft";

export type OnboardingNextFocus =
  | "ask_display_name"
  | "ask_profession"
  | "ready_for_secure_step";

const PROFESSION_LABEL: Record<string, string> = {
  parent_caregiver: "Parent or caregiver",
  clinician: "Clinician",
  other: "Other",
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
        `Their preferred name is already saved as "${d.displayName.trim()}". Greet them briefly by name. Ask only how they use MaaCare (parent/caregiver, clinician, or other). If they say they are not pregnant, not expecting, or not tracking a pregnancy, set pregnancyStatus to not_applicable in DRAFT_PATCH. If they identify as a student, researcher, or academic role, set profession to other unless they clearly say they are a clinician or a parent/caregiver using the app for family. Do not ask for their name again.`,
    };
  }
  return {
    nextFocus: "ready_for_secure_step",
    modelInstruction:
      `Name and role are already saved ("${d.displayName.trim()}", ${professionLabel(d.profession)}). Do not ask for name or role again unless the user corrects them. If the latest user message changes pregnancy intent (e.g. not pregnant) or role (e.g. student), you MUST update pregnancyStatus and/or profession in DRAFT_PATCH. Otherwise offer one short optional question (dates, journey detail, health note) or remind them they can use the secure email/password section below. Keep it brief.`,
  };
}
