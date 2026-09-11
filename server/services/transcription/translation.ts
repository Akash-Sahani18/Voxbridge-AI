export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

const SUPPORTED_LANGUAGES = new Set([
  "en",
  "hi",
  "bn",
  "ta",
  "te",
  "mr",
  "gu",
  "kn",
  "ml",
  "pa",
]);

function normalizeLanguage(
  language: string
): string {
  const normalized =
    language
      ?.trim()
      .toLowerCase()
      .split("-")[0] || "en";

  return SUPPORTED_LANGUAGES.has(
    normalized
  )
    ? normalized
    : "en";
}

export async function translateText(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const cleanText =
    request.text?.trim();

  if (!cleanText) {
    throw new Error(
      "Translation text is empty."
    );
  }

  const source =
    normalizeLanguage(
      request.sourceLanguage
    );

  const target =
    normalizeLanguage(
      request.targetLanguage
    );

  if (source === target) {
    return {
      originalText: cleanText,
      translatedText: cleanText,
      sourceLanguage: source,
      targetLanguage: target,
    };
  }

  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(cleanText)}` +
    `&langpair=${encodeURIComponent(
      `${source}|${target}`
    )}`;

  console.log(
    "[TRANSLATION] Request:",
    source,
    "->",
    target,
    cleanText
  );

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Translation API failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as {
    responseStatus?: number;
    responseDetails?: string;
    responseData?: {
      translatedText?: string;
    };
  };

  if (
    data.responseStatus &&
    data.responseStatus !== 200
  ) {
    throw new Error(
      data.responseDetails ||
        "Translation API rejected the request."
    );
  }

  const translatedText =
    data.responseData?.translatedText?.trim();

  if (!translatedText) {
    throw new Error(
      "Translation API returned no translation."
    );
  }

  console.log(
    "[TRANSLATION] Result:",
    translatedText
  );

  return {
    originalText: cleanText,
    translatedText,
    sourceLanguage: source,
    targetLanguage: target,
  };
}