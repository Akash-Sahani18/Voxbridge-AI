import { useMemo } from "react";
import "../styles/TranslationPanel.css";

export interface CaptionItem {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  language: string;
  timestamp: number;
  isFinal: boolean;
}

export interface TranslationItem {
  id: string;
  speakerId: string;
  speakerName: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

interface TranslationPanelProps {
  captions: CaptionItem[];
  translations: TranslationItem[];

  translationEnabled: boolean;
  targetLanguage: string;

  translating: boolean;

  onTranslationToggle: () => void;
  onTargetLanguageChange: (
    language: string
  ) => void;

  onTranslate: () => void;

  onClearTranscript?: () => void;
}

const LANGUAGE_OPTIONS = [
  {
    code: "en",
    name: "English",
  },
  {
    code: "hi",
    name: "Hindi",
  },
  {
    code: "es",
    name: "Spanish",
  },
  {
    code: "fr",
    name: "French",
  },
  {
    code: "de",
    name: "German",
  },
  {
    code: "ja",
    name: "Japanese",
  },
  {
    code: "ko",
    name: "Korean",
  },
  {
    code: "ta",
    name: "Tamil",
  },
  {
    code: "te",
    name: "Telugu",
  },
  {
    code: "bn",
    name: "Bengali",
  },
];

function formatTime(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getLanguageName(
  code: string
) {
  const language =
    LANGUAGE_OPTIONS.find(
      (item) =>
        item.code ===
        code
    );

  return (
    language?.name ||
    code ||
    "Unknown"
  );
}

export default function TranslationPanel({
  captions,
  translations,
  translationEnabled,
  targetLanguage,
  translating,
  onTranslationToggle,
  onTargetLanguageChange,
  onTranslate,
  onClearTranscript,
}: TranslationPanelProps) {

  const latestCaption =
    useMemo(() => {
      if (
        captions.length === 0
      ) {
        return null;
      }

      return captions[
        captions.length - 1
      ];
    }, [captions]);

  const latestTranslation =
    useMemo(() => {
      if (
        translations.length === 0
      ) {
        return null;
      }

      return translations[
        translations.length - 1
      ];
    }, [translations]);

  return (
    <aside className="translation-panel">

      {/* ==================================================
          LIVE CAPTIONS
      ================================================== */}

      <section className="translation-section">

        <div className="section-heading">

          <div>
            <h2>
              Live captions
            </h2>

            <p>
              Speech from participants
            </p>
          </div>

          <span className="live-indicator">
            <span className="live-dot" />
            LIVE
          </span>

        </div>

        <div className="caption-area">

          {!latestCaption && (
            <div className="empty-state">
              <p>
                Captions will appear
                here when someone
                speaks.
              </p>
            </div>
          )}

          {latestCaption && (
            <div
              className={
                latestCaption.isFinal
                  ? "caption-card"
                  : "caption-card interim"
              }
            >

              <div className="caption-meta">

                <span>
                  {
                    latestCaption.speakerName
                  }
                </span>

                <span>
                  {
                    getLanguageName(
                      latestCaption.language
                    )
                  }
                </span>

              </div>

              <p className="caption-text">
                {
                  latestCaption.text
                }
              </p>

              <span className="caption-time">
                {
                  formatTime(
                    latestCaption.timestamp
                  )
                }
              </span>

            </div>
          )}

        </div>

      </section>


      {/* ==================================================
          TRANSLATION
      ================================================== */}

      <section className="translation-section">

        <div className="section-heading">

          <div>
            <h2>
              Translation
            </h2>

            <p>
              Convert captions into another language
            </p>
          </div>

        </div>


        <div className="translation-controls">

          <label
            htmlFor="translation-language"
          >
            Translate to
          </label>

          <select
            id="translation-language"
            value={
              targetLanguage
            }
            onChange={(event) =>
              onTargetLanguageChange(
                event.target.value
              )
            }
            disabled={
              translating
            }
          >

            {LANGUAGE_OPTIONS.map(
              (language) => (
                <option
                  key={
                    language.code
                  }
                  value={
                    language.code
                  }
                >
                  {
                    language.name
                  }
                </option>
              )
            )}

          </select>


          <div className="translation-actions">

            <button
              type="button"
              className={
                translationEnabled
                  ? "translation-toggle active"
                  : "translation-toggle"
              }
              onClick={
                onTranslationToggle
              }
              aria-pressed={
                translationEnabled
              }
            >
              <span
                className="toggle-indicator"
              />

              Translation{" "}
              {
                translationEnabled
                  ? "ON"
                  : "OFF"
              }
            </button>


            <button
              type="button"
              className="translate-button"
              onClick={
                onTranslate
              }
              disabled={
                !latestCaption ||
                translating
              }
            >
              {translating
                ? "Translating..."
                : "Translate"}
            </button>

          </div>

        </div>


        <div className="translation-result">

          {!latestTranslation && (
            <div className="empty-state">

              <p>
                Select a language and
                translate a caption.
              </p>

            </div>
          )}

          {latestTranslation && (
            <div className="translation-card">

              <div className="translation-language-row">

                <span>
                  {
                    getLanguageName(
                      latestTranslation
                        .sourceLanguage
                    )
                  }
                </span>

                <span className="language-arrow">
                  →
                </span>

                <span>
                  {
                    getLanguageName(
                      latestTranslation
                        .targetLanguage
                    )
                  }
                </span>

              </div>


              <div className="original-text">

                <span>
                  Original
                </span>

                <p>
                  {
                    latestTranslation
                      .originalText
                  }
                </p>

              </div>


              <div className="translated-text">

                <span>
                  Translation
                </span>

                <p>
                  {
                    latestTranslation
                      .translatedText
                  }
                </p>

              </div>

            </div>
          )}

        </div>

      </section>


      {/* ==================================================
          TRANSCRIPT
      ================================================== */}

      <section className="translation-section transcript-section">

        <div className="section-heading">

          <div>
            <h2>
              Transcript
            </h2>

            <p>
              Conversation history
            </p>
          </div>

          {translations.length >
            0 && (
            <button
              type="button"
              className="clear-button"
              onClick={
                onClearTranscript
              }
            >
              Clear
            </button>
          )}

        </div>


        <div className="transcript-list">

          {translations.length ===
            0 && (
            <div className="empty-state">

              <p>
                Translated messages
                will appear here.
              </p>

            </div>
          )}


          {translations.map(
            (item) => (
              <article
                key={
                  item.id
                }
                className="transcript-item"
              >

                <div className="transcript-header">

                  <strong>
                    {
                      item.speakerName
                    }
                  </strong>

                  <time>
                    {
                      formatTime(
                        item.timestamp
                      )
                    }
                  </time>

                </div>


                <div className="transcript-original">

                  <span>
                    {
                      getLanguageName(
                        item.sourceLanguage
                      )
                    }
                  </span>

                  <p>
                    {
                      item.originalText
                    }
                  </p>

                </div>


                <div className="transcript-translation">

                  <span>
                    {
                      getLanguageName(
                        item.targetLanguage
                      )
                    }
                  </span>

                  <p>
                    {
                      item.translatedText
                    }
                  </p>

                </div>

              </article>
            )
          )}

        </div>

      </section>

    </aside>
  );
}