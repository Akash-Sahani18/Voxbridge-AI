import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  caption: string;
  translation: string;
}

interface CallVideosProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  localStreamAvailable: boolean;
  localSpeaking: boolean;
  mediaError: string;
  captionsEnabled: boolean;
  localCaptionText: string;
  translationEnabled: boolean;
  participants: RemoteParticipant[];
  audioContextRef: RefObject<AudioContext | null>;
}

function CaptionOverlay({
  caption,
  translation,
}: {
  caption: string;
  translation?: string;
}) {
  if (!caption && !translation) {
    return null;
  }

  return (
    <div className="video-live-text" aria-live="polite">
      {caption && (
        <div className="video-caption-block">
          <span className="video-overlay-label">Live caption</span>
          <p>{caption}</p>
        </div>
      )}

      {translation && (
        <div className="video-translation-block">
          <span className="video-overlay-label">Translation</span>
          <p>{translation}</p>
        </div>
      )}
    </div>
  );
}

function useSpeakingDetection(
  stream: MediaStream | null,
  audioContextRef: RefObject<AudioContext | null>
) {
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const silentSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) {
      setSpeaking(false);
      speakingRef.current = false;
      silentSinceRef.current = null;
      return;
    }

    let context = audioContextRef.current;

    if (!context) {
      context = new AudioContext();
      audioContextRef.current = context;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;

    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;

    const getRms = (
      target: AnalyserNode,
      targetData: Uint8Array<ArrayBuffer>
    ) => {
      target.getByteTimeDomainData(targetData);
      let sum = 0;

      for (const value of targetData) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      return Math.sqrt(sum / targetData.length);
    };

    const monitor = () => {
      const level = getRms(analyser, data);
      const now = performance.now();
      const startThreshold = 0.045;
      const stopThreshold = 0.025;
      const silenceDuration = 280;

      if (speakingRef.current) {
        if (level <= stopThreshold) {
          if (silentSinceRef.current === null) {
            silentSinceRef.current = now;
          }

          if (
            now - silentSinceRef.current >=
            silenceDuration
          ) {
            speakingRef.current = false;
            silentSinceRef.current = null;
            setSpeaking(false);
          }
        } else {
          silentSinceRef.current = null;
        }
      } else if (level >= startThreshold) {
        speakingRef.current = true;
        silentSinceRef.current = null;
        setSpeaking(true);
      }

      frame = window.requestAnimationFrame(monitor);
    };

    frame = window.requestAnimationFrame(monitor);

    return () => {
      window.cancelAnimationFrame(frame);

      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // Ignore stale audio nodes.
      }

      speakingRef.current = false;
      silentSinceRef.current = null;
      setSpeaking(false);
    };
  }, [stream, audioContextRef]);

  return speaking;
}

function RemoteVideoTile({
  participant,
  captionsEnabled,
  translationEnabled,
  audioContextRef,
}: {
  participant: RemoteParticipant;
  captionsEnabled: boolean;
  translationEnabled: boolean;
  audioContextRef: RefObject<AudioContext | null>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const speaking = useSpeakingDetection(
    participant.stream,
    audioContextRef
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = participant.stream;

    if (participant.stream) {
      video.play().catch(() => {
        // Browser autoplay restriction.
      });
    }

    return () => {
      if (video.srcObject === participant.stream) {
        video.srcObject = null;
      }
    };
  }, [participant.stream]);

  return (
    <div
      className={`video-card ${
        speaking ? "is-speaking" : ""
      } ${
        !participant.stream
          ? "remote-empty"
          : ""
      }`}
    >
      <video
        ref={videoRef}
        className="video-element"
        autoPlay
        playsInline
      />

      {!participant.stream && (
        <div className="waiting-content">
          <div className="waiting-content-inner">
            <span className="waiting-kicker">
              Meeting
            </span>

            <h2>
              Connecting participant
            </h2>

            <p>
              Establishing the video connection.
            </p>
          </div>
        </div>
      )}

      {participant.stream &&
        (captionsEnabled ||
          translationEnabled) && (
          <CaptionOverlay
            caption={
              captionsEnabled
                ? participant.caption
                : ""
            }
            translation={
              translationEnabled
                ? participant.translation
                : ""
            }
          />
        )}

      <div className="video-label">
        {participant.name}

        {speaking && (
          <span className="speaking-status">
            Speaking
          </span>
        )}
      </div>
    </div>
  );
}

export default function CallVideos({
  localVideoRef,
  localStreamAvailable,
  localSpeaking,
  mediaError,
  captionsEnabled,
  localCaptionText,
  translationEnabled,
  participants,
  audioContextRef,
}: CallVideosProps) {
  /*
   * There are always at least two visible tiles:
   *
   * 1. Local participant
   * 2. Waiting tile when no remote participant exists
   *
   * Therefore the waiting state must also use two
   * columns instead of treating the grid as a
   * single-tile layout.
   */
  const totalTiles =
    participants.length === 0
      ? 2
      : 1 + participants.length;

  const columns =
    totalTiles <= 1
      ? 1
      : totalTiles <= 4
        ? 2
        : totalTiles <= 9
          ? 3
          : 4;

  return (
    <section
      className={`video-area video-area-columns-${columns}`}
    >
      <div
        className={`video-card ${
          localSpeaking
            ? "is-speaking"
            : ""
        }`}
      >
        <video
          ref={localVideoRef}
          className="video-element"
          autoPlay
          muted
          playsInline
        />

        {!localStreamAvailable &&
          !mediaError && (
            <div className="waiting-content">
              <div className="waiting-content-inner">
                <span className="waiting-kicker">
                  Your camera
                </span>

                <h2>
                  Requesting camera
                </h2>

                <p>
                  Please allow camera and
                  microphone access.
                </p>
              </div>
            </div>
          )}

        {mediaError && (
          <div className="waiting-content">
            <div className="waiting-content-inner">
              <span className="waiting-kicker">
                Media
              </span>

              <h2>
                Camera unavailable
              </h2>

              <p>
                {mediaError}
              </p>
            </div>
          </div>
        )}

        {captionsEnabled && (
          <CaptionOverlay
            caption={localCaptionText}
          />
        )}

        <div className="video-label">
          You

          {localSpeaking && (
            <span className="speaking-status">
              Speaking
            </span>
          )}
        </div>
      </div>

      {participants.length === 0 && (
        <div className="video-card remote-empty">
          <div className="waiting-content">
            <div className="waiting-content-inner">
              <span className="waiting-kicker">
                Meeting
              </span>

              <h2>
                Waiting for participant
              </h2>

              <p>
                Share this room with someone
                to start the call.
              </p>
            </div>
          </div>
        </div>
      )}

      {participants.map(
        (participant) => (
          <RemoteVideoTile
            key={participant.id}
            participant={participant}
            captionsEnabled={
              captionsEnabled
            }
            translationEnabled={
              translationEnabled
            }
            audioContextRef={
              audioContextRef
            }
          />
        )
      )}
    </section>
  );
}