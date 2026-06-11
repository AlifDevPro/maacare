/**
 * Symptom insight output language resolution (UI-first).
 * Run: npm run test:symptom-insight-language
 */
import assert from "node:assert/strict";

import {
  resolveSymptomInsightLanguage,
  symptomInsightLanguageTag,
} from "../src/lib/symptoms/insight-language";

const CASES: Array<{
  key: string;
  appLanguage: string | null | undefined;
  profileLanguage: string | null | undefined;
  expected: "en" | "bn";
}> = [
  {
    key: "english-ui-bn-profile",
    appLanguage: "en",
    profileLanguage: "bn",
    expected: "en",
  },
  {
    key: "bangla-ui-en-profile",
    appLanguage: "bn",
    profileLanguage: "en",
    expected: "bn",
  },
  {
    key: "missing-appLanguage-falls-back-to-profile",
    appLanguage: null,
    profileLanguage: "bn",
    expected: "bn",
  },
  {
    key: "missing-both-defaults-en",
    appLanguage: null,
    profileLanguage: null,
    expected: "en",
  },
];

for (const c of CASES) {
  const got = resolveSymptomInsightLanguage(c.appLanguage, c.profileLanguage);
  assert.equal(got, c.expected, `${c.key}: expected ${c.expected}, got ${got}`);
  assert.equal(symptomInsightLanguageTag(got), c.expected);
}

console.log(`symptom-insight-language: ${CASES.length} cases passed`);
