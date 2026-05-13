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

export function validateProfession(profession: ProfessionValue | ""): string | null {
  if (!profession) return "Please choose how you use MaaCare (your role).";
  return null;
}

/** Minimum profile fields before showing the secure email/password step (AI flow). */
export function signupDraftReadyForCredentials(d: SignupProfileDraft): boolean {
  return d.displayName.trim().length > 0 && d.profession !== "";
}

export function validateTermsAccepted(terms: boolean): string | null {
  if (!terms) return "Please accept the Terms";
  return null;
}
