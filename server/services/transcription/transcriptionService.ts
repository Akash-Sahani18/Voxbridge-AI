import {
  translateText,
  TranslationResponse,
} from "../transcription/translation";

import {
  detectLanguage,
  LanguageInfo,
} from "../transcription/languageDetection";

export interface TranscriptionResult {
  originalText: string;
  englishText: string;
  language: LanguageInfo;
  timestamp: number;
}

export async function processTranscription(
  text: string,
  languageCode: string
): Promise<TranscriptionResult> {
  const originalText = text.trim();

  const normalizedLanguage =
    languageCode
      ?.trim()
      .toLowerCase()
      .split("-")[0] || "unknown";

  const language: LanguageInfo =
    detectLanguage(normalizedLanguage);

  if (!originalText) {
    return {
      originalText: "",
      englishText: "",
      language,
      timestamp: Date.now(),
    };
  }

  let englishText = originalText;

  /*
   * Translate only when the detected
   * language is not English.
   */
  if (
    language.code !== "en" &&
    language.code !== "unknown"
  ) {
    try {
      const translation: TranslationResponse =
        await translateText({
          text: originalText,
          sourceLanguage: language.code,
          targetLanguage: "en",
        });

      englishText =
        translation.translatedText;
    } catch (error) {
      console.error(
        "[Transcription] Translation failed:",
        error
      );

      /*
       * Never break captions if translation fails.
       */
      englishText = originalText;
    }
  }

  return {
    originalText,
    englishText,
    language,
    timestamp: Date.now(),
  };
}