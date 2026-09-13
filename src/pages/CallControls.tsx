import {
  Captions,
  Languages,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import type { SpeechLanguage } from "../services/transcription";

interface CallControlsProps {
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  captionsEnabled: boolean;
  translationEnabled: boolean;
  translationTargetLanguage: SpeechLanguage;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleCaptions: () => void;
  onToggleTranslation: () => void;
  onChangeTranslationTargetLanguage: (language: SpeechLanguage) => void;
  onLeave: () => void;
}

const languageOptions: Array<[SpeechLanguage, string]> = [
  ["en-US", "English"],
  ["hi-IN", "Hindi"],
  ["bn-IN", "Bengali"],
  ["ta-IN", "Tamil"],
  ["te-IN", "Telugu"],
  ["mr-IN", "Marathi"],
  ["gu-IN", "Gujarati"],
  ["kn-IN", "Kannada"],
  ["ml-IN", "Malayalam"],
  ["pa-IN", "Punjabi"],
];

export default function CallControls({
  microphoneEnabled,
  cameraEnabled,
  screenSharing,
  captionsEnabled,
  translationEnabled,
  translationTargetLanguage,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleCaptions,
  onToggleTranslation,
  onChangeTranslationTargetLanguage,
  onLeave,
}: CallControlsProps) {
  return (
    <footer className="call-controls">
      <div className="controls-main-group">
        <button
          type="button"
          className={`control-button ${!microphoneEnabled ? "active-off" : ""}`}
          onClick={onToggleMicrophone}
          title={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          <span>{microphoneEnabled ? "Mute" : "Unmute"}</span>
        </button>

        <button
          type="button"
          className={`control-button ${!cameraEnabled ? "active-off" : ""}`}
          onClick={onToggleCamera}
          title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          <span>{cameraEnabled ? "Camera" : "Camera off"}</span>
        </button>

        <button
          type="button"
          className={`control-button ${screenSharing ? "active" : ""}`}
          onClick={onToggleScreenShare}
        >
          <MonitorUp size={18} />
          <span>{screenSharing ? "Stop sharing" : "Share"}</span>
        </button>

        <button
          type="button"
          className={`control-button ${captionsEnabled ? "active" : ""}`}
          onClick={onToggleCaptions}
        >
          <Captions size={18} />
          <span>Captions</span>
        </button>

        <button
          type="button"
          className={`control-button ${translationEnabled ? "active" : ""}`}
          onClick={onToggleTranslation}
          title="Toggle translation"
        >
          <Languages size={18} />
          <span>Translate</span>
        </button>
      </div>

      <div className="controls-language-group">
        <div className="language-control">
          <select
            id="translation-language"
            aria-label="Translation language"
            value={translationTargetLanguage}
            onChange={(event) =>
              onChangeTranslationTargetLanguage(
                event.target.value as SpeechLanguage
              )
            }
            className="language-select"
            disabled={!translationEnabled}
          >
            {languageOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" className="leave-button" onClick={onLeave}>
        <PhoneOff size={18} />
        <span>Leave</span>
      </button>
    </footer>
  );
}
