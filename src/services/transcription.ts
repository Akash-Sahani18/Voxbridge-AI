import type { Socket } from "socket.io-client";

export type SpeechLanguage =
  | "en-US"
  | "hi-IN"
  | "bn-IN"
  | "ta-IN"
  | "te-IN"
  | "mr-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "pa-IN";

export interface AutoTranscriptionCallbacks {
  onFinal: (
    text: string,
    language: string
  ) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

const SEGMENT_DURATION_MS = 8000;
const SILENCE_STOP_MS = 1200;
const SPEECH_CHECK_INTERVAL_MS = 100;
const MIN_SPEECH_DURATION_MS = 700;
const MIN_RMS = 0.018;
const NOISE_MULTIPLIER = 2.5;

const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

class AutomaticSpeechTranscription {
  private enabled = false;

  private stream: MediaStream | null = null;

  private socket: Socket | null = null;

  private recorder: MediaRecorder | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  private recordingStartedAt = 0;

  private audioContext: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private analyserSource: MediaStreamAudioSourceNode | null = null;

  private noiseFloor = 0.006;

  private callbacks: AutoTranscriptionCallbacks = {
    onFinal: () => {},
  };

  private sequence = 0;

  private vadCheckCount = 0;

  private vadSpeakingCount = 0;

  private handleTranscription = (data: {
    sequence?: number;
    text?: string;
    language?: string;
  }) => {
    if (!this.enabled) {
      return;
    }

    const text =
      typeof data?.text === "string"
        ? data.text.trim()
        : "";

    if (!text) {
      return;
    }

    const language =
      typeof data?.language === "string" &&
      data.language.trim()
        ? data.language.trim().toLowerCase()
        : "en";

    this.callbacks.onFinal(
      text,
      language
    );
  };

  private handleTranscriptionError = (data: {
    message?: string;
  }) => {
    if (!this.enabled) {
      return;
    }

    const message =
      typeof data?.message === "string" &&
      data.message.trim()
        ? data.message.trim()
        : "Automatic speech transcription failed.";

    console.error(
      "[SpeechTranscription] Server error:",
      message
    );

    this.callbacks.onError?.(message);
  };

  start(
    stream: MediaStream,
    socket: Socket,
    callbacks: AutoTranscriptionCallbacks
  ) {
    this.stop();

    if (
      typeof MediaRecorder === "undefined"
    ) {
      callbacks.onError?.(
        "Automatic speech transcription is not supported by this browser."
      );

      return;
    }

    const audioTracks =
      stream.getAudioTracks();

    if (audioTracks.length === 0) {
      callbacks.onError?.(
        "No microphone audio track is available."
      );

      return;
    }

    if (!socket.connected) {
      callbacks.onError?.(
        "Speech transcription cannot start before the server connection is ready."
      );

      return;
    }

    this.stream =
      new MediaStream(audioTracks);

    this.socket = socket;
    this.callbacks = callbacks;
    this.enabled = true;
    this.sequence = 0;
    this.vadCheckCount = 0;
    this.vadSpeakingCount = 0;

    console.log("[SpeechTranscription][VAD] start()", {
      audioTracks: audioTracks.length,
      socketConnected: socket.connected,
    });

    socket.on(
      "speech-transcription",
      this.handleTranscription
    );

    socket.on(
      "speech-transcription-error",
      this.handleTranscriptionError
    );

    callbacks.onStart?.();

    this.startSegment();
  }

  stop() {
    this.enabled = false;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.monitorTimer !== null) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.socket) {
      this.socket.off(
        "speech-transcription",
        this.handleTranscription
      );

      this.socket.off(
        "speech-transcription-error",
        this.handleTranscriptionError
      );
    }

    const recorder = this.recorder;
    this.recorder = null;

    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // Ignore an already stopped recorder.
      }
    }

    if (this.analyserSource) {
      try {
        this.analyserSource.disconnect();
      } catch {
        // Ignore audio graph cleanup races.
      }
    }

    this.analyserSource = null;
    this.analyser = null;

    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
    }

    this.audioContext = null;
    this.stream = null;
    this.socket = null;
    this.recordingStartedAt = 0;
    this.noiseFloor = 0.006;

    this.callbacks.onEnd?.();
  }

  private getMimeType(): string {
    for (const mimeType of MIME_TYPES) {
      if (
        MediaRecorder.isTypeSupported(
          mimeType
        )
      ) {
        return mimeType;
      }
    }

    return "";
  }

  private startSegment() {
    if (!this.enabled || !this.stream) {
      return;
    }

    this.startVoiceMonitor();
  }

  private startVoiceMonitor() {
    console.log("[SpeechTranscription][VAD] startVoiceMonitor()", {
      enabled: this.enabled,
      hasStream: Boolean(this.stream),
    });

    if (!this.enabled || !this.stream) {
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) {
      this.callbacks.onError?.(
        "The browser does not support microphone voice detection."
      );
      this.stop();
      return;
    }

    try {
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;

      const source =
        context.createMediaStreamSource(
          this.stream
        );

      source.connect(analyser);

      this.audioContext = context;
      this.analyser = analyser;
      this.analyserSource = source;

      void context.resume().catch(() => {});

      this.monitorTimer = setInterval(
        () => {
          this.checkVoiceActivity();
        },
        SPEECH_CHECK_INTERVAL_MS
      );
    } catch (error) {
      console.error(
        "[SpeechTranscription] Voice detection initialization failed:",
        error
      );

      this.callbacks.onError?.(
        "The browser could not start microphone voice detection."
      );

      this.stop();
    }
  }

  private checkVoiceActivity() {
    if (
      !this.enabled ||
      !this.analyser
    ) {
      return;
    }

    const buffer = new Uint8Array(
      this.analyser.fftSize
    );

    this.analyser.getByteTimeDomainData(
      buffer
    );

    let sum = 0;

    for (const value of buffer) {
      const sample =
        (value - 128) / 128;
      sum += sample * sample;
    }

    const rms = Math.sqrt(
      sum / buffer.length
    );

    this.vadCheckCount += 1;

    const threshold = Math.max(
      MIN_RMS,
      this.noiseFloor * NOISE_MULTIPLIER
    );

    const speaking = rms >= threshold;

    if (speaking) {
      this.vadSpeakingCount += 1;
    }

    if (this.vadCheckCount <= 10 || this.vadCheckCount % 20 === 0) {
      console.log("[SpeechTranscription][VAD] sample", {
        check: this.vadCheckCount,
        rms: Number(rms.toFixed(6)),
        noiseFloor: Number(this.noiseFloor.toFixed(6)),
        threshold: Number(threshold.toFixed(6)),
        speaking,
        recorder: Boolean(this.recorder),
        speakingCount: this.vadSpeakingCount,
      });
    }

    if (!this.recorder && !speaking) {
      this.noiseFloor =
        this.noiseFloor * 0.92 +
        rms * 0.08;
    }

    if (!this.recorder) {
      if (speaking) {
        console.log("[SpeechTranscription][VAD] SPEECH DETECTED -> startRecording()");
        this.startRecording();
      }
      return;
    }

    if (speaking) {
      if (this.silenceTimer !== null) {
        clearTimeout(
          this.silenceTimer
        );
        this.silenceTimer = null;
      }
      return;
    }

    if (this.silenceTimer === null) {
      this.silenceTimer = setTimeout(
        () => {
          this.silenceTimer = null;

          if (
            !this.enabled ||
            !this.recorder
          ) {
            return;
          }

          const elapsed =
            Date.now() -
            this.recordingStartedAt;

          if (
            elapsed >=
            MIN_SPEECH_DURATION_MS
          ) {
            this.stopRecording();
          }
        },
        SILENCE_STOP_MS
      );
    }

    if (
      Date.now() -
        this.recordingStartedAt >=
      SEGMENT_DURATION_MS
    ) {
      this.stopRecording();
    }
  }

  private startRecording() {
    if (
      !this.enabled ||
      !this.stream ||
      this.recorder
    ) {
      return;
    }

    const mimeType =
      this.getMimeType();

    console.log("[SpeechTranscription][VAD] startRecording()", {
      mimeType,
      hasStream: Boolean(this.stream),
    });

    let recorder: MediaRecorder;

    try {
      recorder = mimeType
        ? new MediaRecorder(
            this.stream,
            { mimeType }
          )
        : new MediaRecorder(
            this.stream
          );
    } catch (error) {
      console.error(
        "[SpeechTranscription] MediaRecorder initialization failed:",
        error
      );

      this.callbacks.onError?.(
        "The browser could not start microphone recording for automatic transcription."
      );

      return;
    }

    const chunks: Blob[] = [];
    const sequence =
      this.sequence++;

    this.recorder = recorder;
    this.recordingStartedAt =
      Date.now();

    recorder.ondataavailable = (
      event
    ) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      if (!this.enabled) {
        return;
      }

      this.callbacks.onError?.(
        "Microphone recording failed while creating a transcription segment."
      );
    };

    recorder.onstop = () => {
      if (this.recorder === recorder) {
        this.recorder = null;
      }

      const blob = new Blob(
        chunks,
        {
          type:
            recorder.mimeType ||
            mimeType ||
            "audio/webm",
        }
      );

      if (
        this.enabled &&
        blob.size > 0 &&
        this.socket?.connected
      ) {
        this.socket.emit(
          "transcribe-audio",
          {
            sequence,
            mimeType:
              recorder.mimeType ||
              mimeType ||
              "audio/webm",
            audio: blob,
          }
        );
      }
    };

    try {
      recorder.start();
    } catch (error) {
      console.error(
        "[SpeechTranscription] Recorder start failed:",
        error
      );

      this.callbacks.onError?.(
        "Microphone recording could not be started."
      );

      if (this.recorder === recorder) {
        this.recorder = null;
      }
    }
  }

  private stopRecording() {
    const recorder =
      this.recorder;

    if (!recorder) {
      return;
    }

    if (this.silenceTimer !== null) {
      clearTimeout(
        this.silenceTimer
      );
      this.silenceTimer = null;
    }

    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } catch {
      // Ignore recorder lifecycle races.
    }
  }

}

export const autoSpeechTranscription =
  new AutomaticSpeechTranscription();
