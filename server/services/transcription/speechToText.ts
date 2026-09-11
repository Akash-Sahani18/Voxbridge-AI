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

export interface SpeechRecognitionCallbacks {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

class ContinuousSpeechRecognition {
  private recognition: any = null;

  private enabled = false;

  private restarting = false;

  private language: SpeechLanguage = "en-US";

  private callbacks: SpeechRecognitionCallbacks = {
    onFinal: () => {},
  };

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error(
        "Speech Recognition is not supported by this browser."
      );

      return;
    }

    this.recognition =
      new SpeechRecognition();

    this.recognition.continuous = true;

    this.recognition.interimResults = true;

    this.recognition.maxAlternatives = 1;

    this.setupEvents();
  }

  private setupEvents() {
    if (!this.recognition) {
      return;
    }

    this.recognition.onstart = () => {
      this.restarting = false;

      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (
      event: any
    ) => {
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
          result?.[0]?.transcript || "";

        if (result.isFinal) {
          finalText +=
            " " + text;
        } else {
          interimText +=
            " " + text;
        }
      }

      const cleanedInterim =
        interimText
          .replace(/\s+/g, " ")
          .trim();

      const cleanedFinal =
        finalText
          .replace(/\s+/g, " ")
          .trim();

      if (cleanedInterim) {
        this.callbacks.onInterim?.(
          cleanedInterim
        );
      }

      if (cleanedFinal) {
        this.callbacks.onFinal(
          cleanedFinal
        );
      }
    };

    this.recognition.onerror = (
      event: any
    ) => {
      const error =
        event?.error ||
        "unknown";

      if (
        error === "no-speech" ||
        error === "aborted"
      ) {
        return;
      }

      if (
        error === "audio-capture"
      ) {
        this.callbacks.onError?.(
          "Microphone could not be accessed."
        );

        return;
      }

      if (
        error === "not-allowed"
      ) {
        this.enabled = false;

        this.callbacks.onError?.(
          "Microphone permission was denied."
        );

        return;
      }

      if (
        error === "service-not-allowed"
      ) {
        this.callbacks.onError?.(
          "Speech recognition service is not available."
        );

        return;
      }

      this.callbacks.onError?.(
        error
      );
    };

    this.recognition.onend = () => {
      this.callbacks.onEnd?.();

      if (
        this.enabled &&
        !this.restarting
      ) {
        this.restart();
      }
    };
  }

  private restart() {
    if (
      !this.recognition ||
      !this.enabled ||
      this.restarting
    ) {
      return;
    }

    this.restarting = true;

    window.setTimeout(() => {
      if (
        !this.recognition ||
        !this.enabled
      ) {
        this.restarting = false;

        return;
      }

      try {
        this.recognition.lang =
          this.language;

        this.recognition.start();
      } catch {
        this.restarting = false;

        if (this.enabled) {
          window.setTimeout(() => {
            this.restart();
          }, 1000);
        }
      }
    }, 300);
  }

  start(
    language: SpeechLanguage,
    callbacks: SpeechRecognitionCallbacks
  ) {
    if (!this.recognition) {
      callbacks.onError?.(
        "Speech Recognition is not supported by this browser."
      );

      return;
    }

    this.language =
      language;

    this.callbacks =
      callbacks;

    this.enabled = true;

    this.restarting = false;

    this.recognition.lang =
      language;

    try {
      this.recognition.start();
    } catch {
      if (
        this.enabled
      ) {
        this.restart();
      }
    }
  }

  stop() {
    this.enabled = false;

    this.restarting = false;

    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
    } catch {
    }
  }

  setLanguage(
    language: SpeechLanguage
  ) {
    this.language =
      language;

    if (!this.enabled) {
      return;
    }

    this.restarting = false;

    try {
      this.recognition?.stop();
    } catch {
    }

    window.setTimeout(() => {
      if (!this.enabled) {
        return;
      }

      this.start(
        language,
        this.callbacks
      );
    }, 300);
  }

  isRunning() {
    return this.enabled;
  }
}

export const speechRecognition =
  new ContinuousSpeechRecognition();