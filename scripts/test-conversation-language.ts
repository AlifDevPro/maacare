/**
 * Conversation-level language locking regression tests (cases from product spec).
 * Run: npm run test:conversation-language
 */
import { primaryTag } from "../src/lib/ai/multilingual-pipeline/language-heuristics";
import { runMultilingualPipeline } from "../src/lib/ai/multilingual-pipeline";

process.env.MULTILINGUAL_PIPELINE_ENABLED = process.env.MULTILINGUAL_PIPELINE_ENABLED ?? "1";

type Turn = {
  message: string;
  conversationLanguage?: string | null;
  recentUserMessages?: string[];
};

type Case = {
  key: string;
  turns: Turn[];
  expectedTag: string;
};

const CASES: Case[] = [
  {
    key: "case1-appointment-2pm",
    turns: [
      { message: "Add appointment on June 10" },
      {
        message: "2pm",
        recentUserMessages: ["Add appointment on June 10"],
        conversationLanguage: "en",
      },
    ],
    expectedTag: "en",
  },
  {
    key: "case2-pregnancy-yes",
    turns: [
      { message: "I have pregnancy symptoms" },
      {
        message: "yes",
        recentUserMessages: ["I have pregnancy symptoms"],
        conversationLanguage: "en",
      },
    ],
    expectedTag: "en",
  },
  {
    key: "case3-bengali-headache-yes",
    turns: [
      { message: "আমার মাথা ব্যথা করছে" },
      {
        message: "হ্যাঁ",
        recentUserMessages: ["আমার মাথা ব্যথা করছে"],
        conversationLanguage: "bn",
      },
    ],
    expectedTag: "bn",
  },
  {
    key: "case4-explicit-bengali-switch",
    turns: [
      { message: "I have headache" },
      {
        message: "বাংলায় উত্তর দাও",
        recentUserMessages: ["I have headache"],
        conversationLanguage: "en",
      },
    ],
    expectedTag: "bn",
  },
  {
    key: "case5-book-ok",
    turns: [
      { message: "Book appointment" },
      {
        message: "ok",
        recentUserMessages: ["Book appointment"],
        conversationLanguage: "en",
      },
    ],
    expectedTag: "en",
  },
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const c of CASES) {
    const finalTurn = c.turns[c.turns.length - 1]!;
    const result = await runMultilingualPipeline({
      latestUserMessage: finalTurn.message,
      conversationLanguage: finalTurn.conversationLanguage ?? null,
      recentUserMessages: finalTurn.recentUserMessages ?? [],
      uiLanguagePrior: null,
    });

    const got = primaryTag(result.ietfLanguageTag);
    const want = primaryTag(c.expectedTag);
    if (got === want) {
      passed += 1;
      console.log(
        `OK  ${c.key} → ${got} (${result.conversationLanguageSource}/${result.detectorSource})`,
      );
    } else {
      failed += 1;
      console.error(`FAIL ${c.key}: got ${got}, want ${want}`);
      console.error(`     message="${finalTurn.message}"`);
      console.error(`     source=${result.conversationLanguageSource}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${CASES.length} cases)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
