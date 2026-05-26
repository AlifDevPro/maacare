import type { ProfessionValue } from "@/lib/profile/profession-values";

import type { SignupProfileDraft } from "./signup-draft";
import { isValidEmailFormat } from "@/lib/validation/email";

export function validateAccountCredentials(input: {
  name: string;
  email: string;
  password: string;
}): string | null {
  if (!input.name.trim() || !input.email.trim() || !input.password) {
    return "Please fill your name, email, and password";
  }
  if (!isValidEmailFormat(input.email)) {
    return "Enter a valid email address";
  }
  if (input.password.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

export function accountStepCanContinue(input: {
  name: string;
  email: string;
  password: string;
  emailRegistered: boolean | null;
  emailLookupPending: boolean;
}): boolean {
  if (!input.name.trim()) return false;
  if (!isValidEmailFormat(input.email.trim())) return false;
  if (input.password.length < 8) return false;
  if (input.emailLookupPending) return false;
  if (input.emailRegistered === true) return false;
  return true;
}

export function validateProfession(profession: ProfessionValue | ""): string | null {
  if (!profession) return "Please choose how you use MaaCare (your role).";
  return null;
}

/** Minimum profile fields before showing the secure email/password step (AI flow). */
export function signupDraftReadyForCredentials(d: SignupProfileDraft): boolean {
  if (d.displayName.trim().length === 0 || d.profession === "") return false;

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
    const hasPracticalContext =
      d.healthNotes.trim().length > 0 || d.conditionsText.trim().length > 0;
    return hasPregnancyContext && hasPracticalContext;
  }

  if (d.profession === "student_researcher") {
    const hasStudyIntent = d.primaryUseCase === "student_research";
    const hasStudyContext =
      d.studentAffiliation.trim().length > 0 ||
      d.studentFieldOfStudy.trim().length > 0 ||
      d.healthNotes.trim().length > 0;
    return hasStudyIntent && hasStudyContext;
  }

  if (d.profession === "clinician") {
    const hasClinicianIntent = d.primaryUseCase === "clinician";
    const hasClinicianContext =
      d.clinicianSpecialty.trim().length > 0 ||
      d.clinicianInstitution.trim().length > 0 ||
      d.healthNotes.trim().length > 0;
    return hasClinicianIntent && hasClinicianContext;
  }

  return true;
}

export function validateTermsAccepted(terms: boolean): string | null {
  if (!terms) return "Please accept the Terms";
  return null;
}
