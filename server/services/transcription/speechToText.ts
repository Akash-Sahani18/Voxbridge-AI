const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const DEFAULT_MODEL =
  "whisper-large-v3-turbo";

export interface AudioTranscriptionResult {
  text: string;
  language: string;
}

function normalizeDetectedLanguage(
  language: unknown
): string {
  if (typeof language !== "string") {
    return "en";
  }

  const normalized = language
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return /^[a-z]{2}$/.test(normalized)
    ? normalized
    : "en";
}

export async function transcribeAudio(
  audio: Uint8Array,
  mimeType: string
): Promise<AudioTranscriptionResult> {
  const apiKey =
    process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured on the server."
    );
  }

  if (audio.byteLength === 0) {
    throw new Error(
      "Audio transcription received an empty audio segment."
    );
  }

  const safeMimeType =
    mimeType?.trim() ||
    "audio/webm";

  const extension =
    safeMimeType.includes("ogg")
      ? "ogg"
      : safeMimeType.includes("mp4")
        ? "mp4"
        : "webm";

  const bytes = new Uint8Array(
    audio
  );

  const audioBlob = new Blob(
    [bytes.buffer],
    {
      type: safeMimeType,
    }
  );

  const form = new FormData();

  form.append(
    "file",
    audioBlob,
    `voxbridge-${Date.now()}.${extension}`
  );

  form.append(
    "model",
    DEFAULT_MODEL
  );

  form.append(
    "response_format",
    "verbose_json"
  );

  form.append(
    "temperature",
    "0"
  );

  const MAX_RATE_LIMIT_RETRIES = 2;

  let response: Response | null = null;

  for (
    let attempt = 0;
    attempt <= MAX_RATE_LIMIT_RETRIES;
    attempt++
  ) {
    response =
      await fetch(
        GROQ_TRANSCRIPTION_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
          },
          body: form,
        }
      );

    if (response.status !== 429) {
      break;
    }

    if (attempt === MAX_RATE_LIMIT_RETRIES) {
      break;
    }

    const retryAfter =
      Number(
        response.headers.get("retry-after") ||
          ""
      );

    const delayMs =
      Number.isFinite(retryAfter) &&
      retryAfter > 0
        ? retryAfter * 1000
        : 3000;

    console.warn(
      `[SPEECH TRANSCRIPTION] Groq rate limit reached. Retrying in ${Math.ceil(delayMs / 1000)}s.`
    );

    await new Promise((resolve) =>
      setTimeout(resolve, delayMs)
    );
  }

  if (!response) {
    throw new Error(
      "Groq speech transcription did not return a response."
    );
  }

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `Groq speech transcription failed with status ${response.status}: ${details.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as {
    text?: string;
    language?: string;
  };

  const text =
    typeof data.text === "string"
      ? data.text.trim()
      : "";

  if (!text) {
    return {
      text: "",
      language:
        normalizeDetectedLanguage(
          data.language
        ),
    };
  }

  const language =
    normalizeDetectedLanguage(
      data.language
    );

  console.log(
    "[SPEECH TRANSCRIPTION] Detected:",
    language,
    "Text:",
    text
  );

  return {
    text,
    language,
  };
}
