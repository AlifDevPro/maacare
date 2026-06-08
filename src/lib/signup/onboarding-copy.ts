import type { OnboardingNextFocus } from "@/lib/signup/onboarding-focus";
import { normalizeOnboardingLanguageTag } from "@/lib/signup/onboarding-language";

type OnboardingCopy = {
  seed: string;
  secureNotice: string;
  secureFormTitle: string;
  secureFormBullets: string;
  progressLabel: (step: number, total: number, title: string) => string;
  stepName: string;
  stepRole: string;
  stepAbout: string;
  askName: string;
  askRole: (name: string) => string;
  readySecure: string;
};

const EN: OnboardingCopy = {
  seed: `**Welcome to MaaCare.**

To create your account, answer a few quick questions.

We'll ask for:
• Your name
• Your role
• A little information related to your role

After that, you'll complete the secure account setup step.

**What is your name?**`,
  secureNotice:
    "Chat until we collect your **name**, **role**, and a little role-specific context — then the secure account step unlocks.",
  secureFormTitle: "Account information",
  secureFormBullets: `For your security:
• Do not enter your email in chat
• Do not enter your password in chat

You will enter these details in the secure registration form after onboarding is complete.`,
  progressLabel: (step, total, title) => `Step ${step} of ${total} · ${title}`,
  stepName: "Your name",
  stepRole: "Your role",
  stepAbout: "About you",
  askName: "What is your name?",
  askRole: (name) =>
    `Thanks, ${name}. Which best describes you?\n\n1. **Parent or Caregiver**\n2. **Healthcare Professional**\n3. **Student or Researcher**`,
  readySecure:
    "Great — onboarding is complete. Use the **Account information** section below to enter your email and password securely.",
};

const BN: OnboardingCopy = {
  seed: `**MaaCare-এ স্বাগতম।**

অ্যাকাউন্ট তৈরি করতে কয়েকটি সহজ প্রশ্নের উত্তর দিন।

আমরা জানতে চাই:
• আপনার নাম
• আপনার ভূমিকা
• আপনার ভূমিকা সম্পর্কিত কিছু তথ্য

এরপর নিরাপদ অ্যাকাউন্ট সেটআপ ধাপ সম্পন্ন করবেন।

**আপনার নাম কী?**`,
  secureNotice:
    "চ্যাটে **নাম**, **ভূমিকা** এবং ভূমিকা-সম্পর্কিত কিছু তথ্য দিন — তারপর নিরাপদ অ্যাকাউন্ট ধাপ খুলবে।",
  secureFormTitle: "অ্যাকাউন্ট তথ্য",
  secureFormBullets: `আপনার নিরাপত্তার জন্য:
• চ্যাটে ইমেইল দেবেন না
• চ্যাটে পাসওয়ার্ড দেবেন না

অনবোর্ডিং শেষে নিরাপদ নিবন্ধন ফর্মে এই তথ্য দেবেন।`,
  progressLabel: (step, total, title) => `ধাপ ${step}/${total} · ${title}`,
  stepName: "আপনার নাম",
  stepRole: "আপনার ভূমিকা",
  stepAbout: "আপনার সম্পর্কে",
  askName: "আপনার নাম কী?",
  askRole: (name) =>
    `ধন্যবাদ, ${name}। আপনার কোনটি সবচেয়ে উপযুক্ত?\n\n1. **অভিভাবক বা পরিচর্যাকারী**\n2. **স্বাস্থ্যসেবা পেশাজীবী**\n3. **শিক্ষার্থী বা গবেষক**`,
  readySecure:
    "চমৎকার — অনবোর্ডিং সম্পন্ন। নিচে **অ্যাকাউন্ট তথ্য** বিভাগে নিরাপদে ইমেইল ও পাসওয়ার্ড দিন।",
};

function copyFor(lang: string): OnboardingCopy {
  return primaryIsBn(lang) ? BN : EN;
}

function primaryIsBn(lang: string): boolean {
  return normalizeOnboardingLanguageTag(lang) === "bn";
}

export function getOnboardingSeedMessage(lang: string): string {
  return copyFor(lang).seed;
}

export function getOnboardingSecureNotice(lang: string): string {
  return copyFor(lang).secureNotice;
}

export function getOnboardingSecureFormCopy(lang: string): {
  title: string;
  bullets: string;
} {
  const c = copyFor(lang);
  return { title: c.secureFormTitle, bullets: c.secureFormBullets };
}

export function getOnboardingProgressLabel(
  focus: OnboardingNextFocus,
  lang: string,
): { step: number; total: number; title: string; label: string } {
  const c = copyFor(lang);
  if (focus === "ask_display_name") {
    return { step: 1, total: 3, title: c.stepName, label: c.progressLabel(1, 3, c.stepName) };
  }
  if (focus === "ask_profession") {
    return { step: 2, total: 3, title: c.stepRole, label: c.progressLabel(2, 3, c.stepRole) };
  }
  if (focus === "ready_for_secure_step") {
    return { step: 3, total: 3, title: c.stepAbout, label: c.progressLabel(3, 3, c.stepAbout) };
  }
  return { step: 3, total: 3, title: c.stepAbout, label: c.progressLabel(3, 3, c.stepAbout) };
}

export function fallbackQuestionForOnboardingFocusLocalized(
  focus: OnboardingNextFocus,
  displayName: string,
  lang: string,
): string {
  const c = copyFor(lang);
  const name = displayName.trim();

  switch (focus) {
    case "ask_display_name":
      return c.askName;
    case "ask_profession":
      return name
        ? c.askRole(name)
        : primaryIsBn(lang)
          ? "আপনার কোনটি সবচেয়ে উপযুক্ত?\n\n1. **অভিভাবক বা পরিচর্যাকারী**\n2. **স্বাস্থ্যসেবা পেশাজীবী**\n3. **শিক্ষার্থী বা গবেষক**"
          : "Which best describes you?\n\n1. **Parent or Caregiver**\n2. **Healthcare Professional**\n3. **Student or Researcher**";
    case "ask_pregnancy_relevance":
      return primaryIsBn(lang)
        ? "আপনি কি বর্তমানে গর্ভবতী, গর্ভধারণ পরিকল্পনা করছেন, প্রসব-পরবর্তী, নাকি MaaCare মূলত সহায়তা/গবেষণার জন্য ব্যবহার করছেন?"
        : "Are you currently pregnant, planning pregnancy, postpartum, or using MaaCare mainly for support/research?";
    case "ask_parent_context":
      return primaryIsBn(lang)
        ? "MaaCare প্রথমে কোন গর্ভাবস্থা বা পরিবার-যত্ন বিষয়ে সাহায্য করুক?"
        : "What is the main pregnancy or family-care topic you want MaaCare to help with first?";
    case "ask_student_context":
      return primaryIsBn(lang)
        ? "আপনি মাতৃস্বাস্থ্যে কী পড়ছেন বা গবেষণা করছেন, এবং কোথায়?"
        : "What are you studying or researching in maternal health, and where?";
    case "ask_clinician_context":
      return primaryIsBn(lang)
        ? "আপনার বিশেষত্ব কী, এবং ক্লিনিকাল কাজে MaaCare কীভাবে ব্যবহার করবেন?"
        : "What is your specialty, and how will you use MaaCare in clinical work?";
    case "ask_optional_health_context":
      return primaryIsBn(lang)
        ? "MaaCare-এর জন্য কোনো স্বাস্থ্য নোট বা অবস্থা মনে রাখতে চান?"
        : "Any health note or condition you want MaaCare to remember?";
    case "ready_for_secure_step":
      return c.readySecure;
    default:
      return c.askName;
  }
}
