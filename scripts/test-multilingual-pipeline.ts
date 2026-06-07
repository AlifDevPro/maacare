/**
 * Offline smoke test for multilingual pipeline detection + English query normalization.
 * Run: npm run test:multilingual
 */
import { AI_REGRESSION_CASES } from "../src/lib/ai/regression-cases";
import { runMultilingualPipeline } from "../src/lib/ai/multilingual-pipeline";

process.env.MULTILINGUAL_PIPELINE_ENABLED = process.env.MULTILINGUAL_PIPELINE_ENABLED ?? "1";

function primaryTag(tag: string): string {
  return (tag || "en").trim().toLowerCase().split("-")[0] ?? "en";
}

async function main() {
  const cases = AI_REGRESSION_CASES.filter(
    (c) => c.expectedLanguageTag || c.minEnglishQueryWords,
  );
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const result = await runMultilingualPipeline({
      latestUserMessage: c.query,
      uiLanguagePrior: null,
    });

    const errors: string[] = [];
    if (c.expectedLanguageTag) {
      const got = primaryTag(result.ietfLanguageTag);
      const want = primaryTag(c.expectedLanguageTag);
      if (got !== want) errors.push(`language tag ${got} !== ${want}`);
    }
    if (c.minEnglishQueryWords) {
      const hasTranslationEnv = Boolean(process.env.GROQ_API_KEY?.trim());
      if (hasTranslationEnv || result.translatorSource !== "passthrough") {
        const words = (result.englishRetrievalQuery.match(/[a-zA-Z]{2,}/g) ?? []).length;
        if (words < c.minEnglishQueryWords) {
          errors.push(`english query words ${words} < ${c.minEnglishQueryWords}`);
        }
      }
    }

    if (errors.length === 0) {
      passed += 1;
      console.log(
        `OK  ${c.key} → ${result.ietfLanguageTag} | ${result.detectorSource}/${result.translatorSource}`,
      );
    } else {
      failed += 1;
      console.error(`FAIL ${c.key}: ${errors.join("; ")}`);
      console.error(`     query="${c.query}"`);
      console.error(`     en="${result.englishRetrievalQuery}"`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${cases.length} pipeline cases)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
