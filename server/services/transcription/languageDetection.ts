export interface LanguageInfo {
  code: string;
  name: string;
}

const LANGUAGE_NAMES: Record<
  string,
  string
> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  kn: "Kannada",
  ml: "Malayalam",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
};

export function detectLanguage(
  languageCode: string
): LanguageInfo {
  const code =
    languageCode
      ?.trim()
      .toLowerCase() || "unknown";

  return {
    code,
    name:
      LANGUAGE_NAMES[code] ||
      "Unknown language",
  };
}