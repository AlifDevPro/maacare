/**
 * Registration onboarding language locking tests.
 * Run: npm run test:onboarding-language
 */
import { primaryTag } from "../src/lib/ai/multilingual-pipeline/language-heuristics";
import { resolveOnboardingLanguage } from "../src/lib/signup/onboarding-language";

type Case = {
  key: string;
  input: Parameters<typeof resolveOnboardingLanguage>[0];
  expectedTag: string;
};

const CASES: Case[] = [
  {
    key: "case1-english-alif",
    input: {
      latestUserMessage: "Alif",
      onboardingLanguage: "en",
      appLanguage: "en",
    },
    expectedTag: "en",
  },
  {
    key: "case2-english-ahmed",
    input: {
      latestUserMessage: "Ahmed",
      onboardingLanguage: "en",
      appLanguage: "en",
    },
    expectedTag: "en",
  },
  {
    key: "case3-english-john",
    input: {
      latestUserMessage: "John",
      onboardingLanguage: "en",
      appLanguage: "en",
    },
    expectedTag: "en",
  },
  {
    key: "case4-bengali-alif",
    input: {
      latestUserMessage: "Alif",
      onboardingLanguage: "bn",
      appLanguage: "bn",
    },
    expectedTag: "bn",
  },
  {
    key: "case5-english-alif-no-lock-uses-app",
    input: {
      latestUserMessage: "Alif",
      appLanguage: "en",
    },
    expectedTag: "en",
  },
  {
    key: "case6-name-never-switches-from-locked-en",
    input: {
      latestUserMessage: "Maria",
      onboardingLanguage: "en",
    },
    expectedTag: "en",
  },
  {
    key: "case7-explicit-bengali-switch",
    input: {
      latestUserMessage: "বাংলায় উত্তর দাও",
      onboardingLanguage: "en",
    },
    expectedTag: "bn",
  },
];

function main() {
  let passed = 0;
  let failed = 0;

  for (const c of CASES) {
    const result = resolveOnboardingLanguage(c.input);
    const got = primaryTag(result.ietfLanguageTag);
    const want = primaryTag(c.expectedTag);
    if (got === want) {
      passed += 1;
      console.log(`OK  ${c.key} → ${got} (${result.source})`);
    } else {
      failed += 1;
      console.error(`FAIL ${c.key}: got ${got}, want ${want} (source=${result.source})`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${CASES.length} cases)`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
