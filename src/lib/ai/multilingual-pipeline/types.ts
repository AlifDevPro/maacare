export type UserStyleHint = "native_script" | "latin_transliteration" | "mixed_code_switch";

export type UiLanguagePrior = "en" | "bn" | null;

export type DetectorSource = "cld3" | "fasttext" | "heuristic";

export type TranslatorSource = "passthrough" | "groq";

export type MultilingualPipelineResult = {
  ietfLanguageTag: string;
  englishRetrievalQuery: string;
  languageHintForPrompt?: string;
  translationConfidence: number;
  userStyleHint?: UserStyleHint;
  detectorSource: DetectorSource;
  translatorSource: TranslatorSource;
  normalizedUserMessage: string;
  queryExpansion: string;
};

export type LanguageDetectionResult = {
  ietfLanguageTag: string;
  detectionConfidence: number;
  userStyleHint: UserStyleHint;
  detectorSource: DetectorSource;
  languageHintForPrompt: string;
};
