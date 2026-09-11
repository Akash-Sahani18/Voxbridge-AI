export type TranslationLanguage =
  | "en"
  | "hi"
  | "bn"
  | "ta"
  | "te"
  | "mr"
  | "gu"
  | "kn"
  | "ml"
  | "pa";

const TRANSLATION_SERVER =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5001";

function normalizeLanguage(
  language: string
): TranslationLanguage {
  const normalized =
    language
      .toLowerCase()
      .split("-")[0];

  const supported: TranslationLanguage[] = [
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
  ];

  if (
    supported.includes(
      normalized as TranslationLanguage
    )
  ) {
    return normalized as TranslationLanguage;
  }

  return "en";
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: TranslationLanguage = "en"
): Promise<string> {
  const cleanText =
    text.trim();

  if (!cleanText) {
    return "";
  }

  const source =
    sourceLanguage === "auto"
      ? "auto"
      : normalizeLanguage(
          sourceLanguage
        );

  const target =
    normalizeLanguage(
      targetLanguage
    );

  if (
    source !== "auto" &&
    source === target
  ) {
    return cleanText;
  }

  const response =
    await fetch(
      `${TRANSLATION_SERVER}/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          q: cleanText,
          source,
          target,
          format: "text",
        }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Translation request failed: ${response.status}`
    );
  }

  const data =
    (await response.json()) as {
      translatedText?: string;
    };

  return (
    data.translatedText?.trim() ||
    ""
  );
}

export async function checkTranslationServer(): Promise<boolean> {
  try {
    const response =
      await fetch(
        `${TRANSLATION_SERVER}/`
      );

    return response.ok;
  } catch {
    return false;
  }
}
