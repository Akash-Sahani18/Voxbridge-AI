import { env } from "node:process";

export interface SummaryTranscriptItem {
  id: string;
  sender: string;
  text: string;
  language: string;
  timestamp: number;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: number;
}

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  "openai/gpt-oss-20b";

const REQUEST_TIMEOUT_MS =
  30000;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseSummary(
  content: string
): Omit<MeetingSummary, "generatedAt"> {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<
      string,
      unknown
    >;

    return {
      overview:
        cleanString(parsed.overview) ||
        "No overview was generated.",

      keyPoints:
        cleanStringArray(
          parsed.keyPoints
        ),

      actionItems:
        cleanStringArray(
          parsed.actionItems
        ),

      decisions:
        cleanStringArray(
          parsed.decisions
        ),
    };
  } catch {
    return {
      overview:
        cleaned ||
        "No overview was generated.",

      keyPoints: [],

      actionItems: [],

      decisions: [],
    };
  }
}

export async function generateMeetingSummary(
  transcript: SummaryTranscriptItem[]
): Promise<MeetingSummary> {
  const apiKey =
    env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured on the server."
    );
  }

  const speakerLabels =
    new Map<string, string>();

  let nextSpeakerNumber = 1;

  const recentTranscript =
    transcript
      .filter(
        (item) =>
          item &&
          typeof item.text === "string" &&
          item.text.trim()
      )
      .slice(-100);

  if (
    recentTranscript.length === 0
  ) {
    throw new Error(
      "There is no usable transcript to summarize."
    );
  }

  const transcriptText =
    recentTranscript
      .map((item) => {
        let label =
          speakerLabels.get(
            item.sender
          );

        if (!label) {
          label =
            `Participant ${nextSpeakerNumber}`;

          nextSpeakerNumber += 1;

          speakerLabels.set(
            item.sender,
            label
          );
        }

        return `${label} [${item.language}]: ${item.text}`;
      })
      .join("\n");

  const systemPrompt = `You are the meeting intelligence layer for Voxbridge.
Summarize the provided real-time conversation transcript accurately.
Do not invent facts, names, decisions, or action items.
Keep the overview concise.
Return ONLY valid JSON with this exact shape:
{
  "overview": "string",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "decisions": ["string"]
}
If there are no action items or decisions, return empty arrays.
Preserve the meaning of the conversation even when multiple languages are present.`;

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  let response: Response;

  try {
    response =
      await fetch(
        GROQ_API_URL,
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          signal:
            controller.signal,

          body:
            JSON.stringify({
              model:
                env.GROQ_SUMMARY_MODEL?.trim() ||
                DEFAULT_MODEL,

              temperature: 0.2,

              reasoning_effort:
                "low",

              max_completion_tokens:
                1200,

              response_format: {
                type: "json_object",
              },

              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt,
                },

                {
                  role: "user",
                  content:
                    `Summarize this Voxbridge conversation:\n\n${transcriptText}`,
                },
              ],
            }),
        }
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Groq summary request timed out after 30 seconds."
      );
    }

    throw new Error(
      error instanceof Error
        ? `Unable to reach Groq: ${error.message}`
        : "Unable to reach Groq."
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload =
    (await response.json()) as {
      error?: {
        message?: string;
      };

      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `Groq request failed with status ${response.status}.`
    );
  }

  const content =
    payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty summary."
    );
  }

  const parsed =
    parseSummary(content);

  return {
    ...parsed,
    generatedAt: Date.now(),
  };
}