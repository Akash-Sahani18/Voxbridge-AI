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

export type SpeechRecognitionState =
  | "idle"
  | "starting"
  | "listening"
  | "reconnecting"
  | "stopped"
  | "unsupported"
  | "permission-denied"
  | "error";

export interface SpeechRecognitionCallbacks {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: SpeechRecognitionState) => void;
}

/* =========================================================
 * Browser SpeechRecognition types
 * ========================================================= */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: {
    transcript?: string;
  };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;

  onstart: (() => void) | null;
  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;
  onerror:
    | ((event: SpeechRecognitionErrorEventLike) => void)
    | null;
  onend: (() => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionLike;

/* =========================================================
 * Configuration
 * ========================================================= */

const MAX_RECONNECT_ATTEMPTS = 8;

const INITIAL_RECONNECT_DELAY = 500;

const MAX_RECONNECT_DELAY = 8000;

const DUPLICATE_WINDOW_MS = 1500;

/*
 * Browser recognition can occasionally emit the same
 * final transcript more than once.
 */
const NORMALIZED_ERROR_MESSAGES: Record<
  string,
  string
> = {
  "not-allowed":
    "Microphone permission was denied.",

  "service-not-allowed":
    "Speech recognition is not available.",

  "audio-capture":
    "Microphone could not be accessed.",

  network:
    "Speech recognition network connection failed.",

  "language-not-supported":
    "This language is not supported by speech recognition.",

  aborted:
    "Speech recognition was interrupted.",

  "no-speech":
    "No speech detected.",

  unknown:
    "Speech recognition failed.",
};

/* =========================================================
 * Service
 * ========================================================= */

class ContinuousSpeechRecognition {
  private recognition: SpeechRecognitionLike | null =
    null;

  private enabled = false;

  private starting = false;

  private restarting = false;

  private reconnectTimer: ReturnType<
    typeof setTimeout
  > | null = null;

  private reconnectAttempts = 0;

  private language: SpeechLanguage = "en-US";

  private state: SpeechRecognitionState = "idle";

  private callbacks: SpeechRecognitionCallbacks = {
    onFinal: () => {},
  };

  private lastFinalText = "";

  private lastFinalTimestamp = 0;

  constructor() {
    this.initialize();
  }

  /* =======================================================
   * INITIALIZATION
   * ======================================================= */

  private initialize() {
    if (typeof window === "undefined") {
      return;
    }

    const windowWithSpeech =
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.setState("unsupported");
      return;
    }

    try {
      this.recognition =
        new SpeechRecognition();

      this.recognition.continuous = true;

      this.recognition.interimResults = true;

      this.recognition.maxAlternatives = 1;

      this.recognition.lang = this.language;

      this.setupEvents();
    } catch (error) {
      console.error(
        "[SpeechRecognition] Initialization failed:",
        error
      );

      this.setState("error");
    }
  }

  /* =======================================================
   * EVENT HANDLERS
   * ======================================================= */

  private setupEvents() {
    if (!this.recognition) {
      return;
    }

    this.recognition.onstart = () => {
      this.starting = false;

      this.restarting = false;

      this.reconnectAttempts = 0;

      this.setState("listening");

      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (
      event
    ) => {
      if (!this.enabled) {
        return;
      }

      let interimText = "";

      let finalText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result =
          event.results[i];

        const text =
          result?.[0]?.transcript?.trim() ||
          "";

        if (!text) {
          continue;
        }

        if (result.isFinal) {
          finalText +=
            `${text} `;
        } else {
          interimText +=
            `${text} `;
        }
      }

      const cleanInterim =
        this.normalizeText(interimText);

      const cleanFinal =
        this.normalizeText(finalText);

      if (cleanInterim) {
        this.callbacks.onInterim?.(
          cleanInterim
        );
      }

      if (cleanFinal) {
        if (this.isDuplicateFinal(cleanFinal)) {
          return;
        }

        this.callbacks.onFinal(
          cleanFinal
        );
      }
    };

    this.recognition.onerror = (
      event
    ) => {
      const errorCode =
        event?.error || "unknown";

      console.debug(
        "[SpeechRecognition] Error:",
        errorCode
      );

      /*
       * These are normal browser lifecycle events.
       * Do not expose them to users.
       */
      if (
        errorCode === "aborted" ||
        errorCode === "no-speech"
      ) {
        return;
      }

      /*
       * Permission errors are not recoverable
       * through automatic retries.
       */
      if (
        errorCode === "not-allowed" ||
        errorCode ===
          "service-not-allowed"
      ) {
        this.enabled = false;

        this.cancelReconnect();

        this.setState(
          "permission-denied"
        );

        this.callbacks.onError?.(
          NORMALIZED_ERROR_MESSAGES[
            errorCode
          ] ||
            NORMALIZED_ERROR_MESSAGES.unknown
        );

        return;
      }

      /*
       * Language isn't recoverable through
       * reconnecting.
       */
      if (
        errorCode ===
        "language-not-supported"
      ) {
        this.enabled = false;

        this.cancelReconnect();

        this.setState("error");

        this.callbacks.onError?.(
          NORMALIZED_ERROR_MESSAGES[
            errorCode
          ]
        );

        return;
      }

      /*
       * Network and microphone problems may
       * recover after the browser fires onend.
       *
       * Do not immediately show an error.
       */
      if (
        errorCode === "network" ||
        errorCode === "audio-capture"
      ) {
        this.setState(
          "reconnecting"
        );

        return;
      }

      this.setState("error");

      this.callbacks.onError?.(
        NORMALIZED_ERROR_MESSAGES[
          errorCode
        ] ||
          NORMALIZED_ERROR_MESSAGES.unknown
      );
    };

    this.recognition.onend = () => {
      this.starting = false;

      this.callbacks.onEnd?.();

      /*
       * User intentionally stopped recognition.
       */
      if (!this.enabled) {
        this.setState("stopped");

        return;
      }

      /*
       * Browser unexpectedly stopped
       * recognition.
       */
      this.scheduleReconnect();
    };
  }

  /* =======================================================
   * START
   * ======================================================= */

  start(
    language: SpeechLanguage,
    callbacks: SpeechRecognitionCallbacks
  ) {
    if (!this.recognition) {
      callbacks.onError?.(
        "Speech recognition is not supported in this browser."
      );

      callbacks.onStateChange?.(
        "unsupported"
      );

      return;
    }

    this.language = language;

    this.callbacks = callbacks;

    this.enabled = true;

    this.cancelReconnect();

    this.reconnectAttempts = 0;

    this.setState("starting");

    this.recognition.lang =
      this.language;

    /*
     * Already running.
     */
    if (
      this.isRecognitionActive()
    ) {
      this.setState("listening");

      callbacks.onStart?.();

      return;
    }

    this.startRecognition();
  }

  /* =======================================================
   * START INTERNAL
   * ======================================================= */

  private startRecognition() {
    if (
      !this.recognition ||
      !this.enabled ||
      this.starting ||
      this.isRecognitionActive()
    ) {
      return;
    }

    try {
      this.starting = true;

      this.recognition.lang =
        this.language;

      this.recognition.start();
    } catch (error) {
      this.starting = false;

      /*
       * InvalidStateError commonly means the
       * browser still considers recognition active.
       *
       * Let onend/reconnect handle it instead
       * of creating a tight retry loop.
       */
      console.debug(
        "[SpeechRecognition] Start deferred:",
        error
      );

      this.scheduleReconnect();
    }
  }

  /* =======================================================
   * RECONNECT
   * ======================================================= */

  private scheduleReconnect() {
    if (
      !this.enabled ||
      !this.recognition ||
      this.restarting
    ) {
      return;
    }

    if (
      this.reconnectAttempts >=
      MAX_RECONNECT_ATTEMPTS
    ) {
      this.enabled = false;

      this.setState("error");

      this.callbacks.onError?.(
        "Speech recognition could not reconnect. Please try again."
      );

      return;
    }

    this.restarting = true;

    this.reconnectAttempts += 1;

    const delay =
      Math.min(
        INITIAL_RECONNECT_DELAY *
          Math.pow(
            2,
            this.reconnectAttempts - 1
          ),
        MAX_RECONNECT_DELAY
      );

    this.setState(
      "reconnecting"
    );

    this.cancelReconnect();

    this.reconnectTimer =
      setTimeout(() => {
        this.reconnectTimer = null;

        this.restarting = false;

        if (!this.enabled) {
          return;
        }

        this.startRecognition();
      }, delay);
  }

  /* =======================================================
   * STOP
   * ======================================================= */

  stop() {
    this.enabled = false;

    this.starting = false;

    this.restarting = false;

    this.reconnectAttempts = 0;

    this.cancelReconnect();

    if (!this.recognition) {
      this.setState("stopped");

      return;
    }

    try {
      this.recognition.stop();
    } catch {
      /*
       * Browser may already have stopped
       * recognition.
       */
    }

    this.setState("stopped");
  }

  /* =======================================================
   * LANGUAGE
   * ======================================================= */

  setLanguage(
    language: SpeechLanguage
  ) {
    if (
      this.language === language
    ) {
      return;
    }

    this.language = language;

    if (!this.recognition) {
      return;
    }

    this.recognition.lang =
      language;

    
    if (!this.enabled) {
      return;
    }

    
    this.reconnectAttempts = 0;

    try {
      this.recognition.stop();
    } catch {
      // Browser may already be stopped.
    }

    this.cancelReconnect();

    this.starting = false;

    this.restarting = false;

    this.setState("reconnecting");

    this.reconnectTimer =
      setTimeout(() => {
        this.reconnectTimer = null;

        if (!this.enabled) {
          return;
        }

        this.startRecognition();
      }, 300);
  }

  isRunning() {
    return this.enabled;
  }

  isSupported() {
    return this.recognition !== null;
  }

  getState() {
    return this.state;
  }

  getLanguage() {
    return this.language;
  }

  /* =======================================================
   * HELPERS
   * ======================================================= */

  private normalizeText(
    text: string
  ): string {
    return text
      .replace(/\s+/g, " ")
      .trim();
  }

  private isDuplicateFinal(
    text: string
  ): boolean {
    const now = Date.now();

    const duplicate =
      text ===
        this.lastFinalText &&
      now -
        this.lastFinalTimestamp <
        DUPLICATE_WINDOW_MS;

    this.lastFinalText = text;

    this.lastFinalTimestamp =
      now;

    return duplicate;
  }

  private isRecognitionActive() {
 
    return this.state === "listening";
  }

  private cancelReconnect() {
    if (
      this.reconnectTimer !== null
    ) {
      clearTimeout(
        this.reconnectTimer
      );

      this.reconnectTimer = null;
    }
  }

  private setState(
    state: SpeechRecognitionState
  ) {
    this.state = state;

    this.callbacks.onStateChange?.(
      state
    );
  }
}

export const speechRecognition =
  new ContinuousSpeechRecognition();