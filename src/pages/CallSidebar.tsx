import { Check, ChevronRight, FileText, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Caption, MeetingSummary } from "../types";

interface CallSidebarProps {
  transcript: Caption[];
  onClearTranscript: () => void;
  localSocketId: string | undefined;
  aiSummary: MeetingSummary | null;
  summaryGenerating: boolean;
  onGenerateSummary: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export default function CallSidebar({
  transcript,
  onClearTranscript,
  localSocketId,
  aiSummary,
  summaryGenerating,
  onGenerateSummary,
  onVisibilityChange,
}: CallSidebarProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [summaryVisible, setSummaryVisible] = useState(false);

  const updateSidebarVisibility = (visible: boolean) => {
    setSidebarVisible(visible);
    onVisibilityChange?.(visible);
  };

  if (!sidebarVisible) {
    return (
      <button
        type="button"
        className="sidebar-show-button"
        onClick={() => updateSidebarVisibility(true)}
        aria-label="Show meeting details"
      >
        <ChevronRight size={16} />
        <span>Meeting details</span>
      </button>
    );
  }

  return (
    <aside className="side-panel">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-eyebrow">Meeting workspace</span>
          <h3>Meeting details</h3>
          <p>Transcript and AI-generated insights</p>
        </div>
        <button
          type="button"
          className="sidebar-hide-button"
          onClick={() => updateSidebarVisibility(false)}
        >
          Hide
        </button>
      </div>

      <section className={`side-section transcript-section ${!transcriptVisible ? "section-collapsed" : ""}`}>
        <div className="meeting-section-heading">
          <button
            type="button"
            className="meeting-section-heading-button"
            onClick={() => setTranscriptVisible((visible) => !visible)}
            aria-expanded={transcriptVisible}
          >
            <div className="meeting-section-title">
              <div className="meeting-section-title-row">
                <FileText size={16} />
                <span className="meeting-section-title-heading">Transcript</span>
              </div>
              <span className="meeting-section-title-count">{transcript.length} entries</span>
            </div>
          </button>

          <div className="meeting-section-actions">
            {transcript.length > 0 && transcriptVisible && (
              <button
                type="button"
                onClick={onClearTranscript}
                className="text-action danger-action"
              >
                <Trash2 size={14} />
                Clear
              </button>
            )}
            <button
              type="button"
              className="text-action"
              onClick={() => setTranscriptVisible((visible) => !visible)}
            >
              {transcriptVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {transcriptVisible && (
          <div className="transcript-list">
            {transcript.length === 0 ? (
              <div className="empty-state">
                <FileText size={20} />
                <p>Your conversation will appear here.</p>
              </div>
            ) : (
              transcript.map((item) => (
                <div key={item.id} className="transcript-item">
                  <div className="transcript-meta">
                    <span>{item.sender === localSocketId ? "You" : "Participant"}</span>
                  </div>
                  <p>{item.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className={`side-section summary-section ${!summaryVisible ? "section-collapsed" : ""}`}>
        <div className="meeting-section-heading">
          <button
            type="button"
            className="meeting-section-heading-button"
            onClick={() => setSummaryVisible((visible) => !visible)}
            aria-expanded={summaryVisible}
          >
            <div className="meeting-section-title">
              <div className="meeting-section-title-row">
                <Sparkles size={16} />
                <span className="meeting-section-title-heading">AI Summary</span>
              </div>
              <span className="meeting-section-title-count">{aiSummary ? "Meeting overview" : "Optional"}</span>
            </div>
          </button>

          <div className="meeting-section-actions">
            <button
              type="button"
              className="summary-generate-button"
              onClick={() => {
                setSummaryVisible(true);
                onGenerateSummary();
              }}
              disabled={transcript.length === 0 || summaryGenerating}
            >
              {summaryGenerating ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              className="text-action"
              onClick={() => setSummaryVisible((visible) => !visible)}
            >
              {summaryVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {summaryVisible && (
          transcript.length === 0 ? (
            <div className="empty-summary">
              <p>Add transcript content before generating a summary.</p>
            </div>
          ) : summaryGenerating ? (
            <div className="empty-summary">
              <p>Generating meeting summary...</p>
            </div>
          ) : !aiSummary ? (
            <div className="empty-summary">
              <p>Generate a summary from the current meeting transcript.</p>
            </div>
          ) : (
            <div className="ai-summary-content">
              <div className="summary-block">
                <h4>Overview</h4>
                <p>{aiSummary.overview}</p>
              </div>

              {[
                ["Key Points", aiSummary.keyPoints],
                ["Action Items", aiSummary.actionItems],
                ["Decisions", aiSummary.decisions],
              ].map(([title, items]) => (
                <div className="summary-block" key={title as string}>
                  <h4>{title as string}</h4>
                  {(items as string[]).length === 0 ? (
                    <p className="placeholder">
                      No {String(title).toLowerCase()} identified.
                    </p>
                  ) : (
                    <ul>
                      {(items as string[]).map((item, index) => (
                        <li key={index}>
                          <Check size={14} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </aside>
  );
}
