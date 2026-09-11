export interface LiveStreamState {
  active: boolean;
  title: string;
  url: string;
  platform: string;
  startedAt: number | null;
}

export interface LiveStreamListener {
  (state: LiveStreamState): void;
}

class LiveStreamManager {
  private state: LiveStreamState = {
    active: false,
    title: "",
    url: "",
    platform: "",
    startedAt: null,
  };

  private listeners: LiveStreamListener[] = [];

  subscribe(
    listener: LiveStreamListener
  ): () => void {
    this.listeners.push(listener);

    listener({
      ...this.state,
    });

    return () => {
      this.listeners =
        this.listeners.filter(
          (item) => item !== listener
        );
    };
  }

  private notify(): void {
    const state = {
      ...this.state,
    };

    this.listeners.forEach(
      (listener) => {
        listener(state);
      }
    );
  }

  start(
    title: string,
    url: string
  ): boolean {
    const cleanTitle =
      title.trim();

    const cleanUrl =
      url.trim();

    if (
      !cleanTitle ||
      !cleanUrl
    ) {
      return false;
    }

    let parsedUrl: URL;

    try {
      parsedUrl =
        new URL(cleanUrl);
    } catch {
      return false;
    }

    const platform =
      this.detectPlatform(
        parsedUrl
      );

    this.state = {
      active: true,
      title: cleanTitle,
      url: parsedUrl.href,
      platform,
      startedAt: Date.now(),
    };

    this.notify();

    return true;
  }

  stop(): void {
    if (!this.state.active) {
      return;
    }

    this.state = {
      active: false,
      title: "",
      url: "",
      platform: "",
      startedAt: null,
    };

    this.notify();
  }

  getState(): LiveStreamState {
    return {
      ...this.state,
    };
  }

  isActive(): boolean {
    return this.state.active;
  }

  private detectPlatform(
    url: URL
  ): string {
    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    if (
      host === "youtube.com" ||
      host === "youtu.be"
    ) {
      return "YouTube";
    }

    if (
      host === "twitch.tv" ||
      host.endsWith(
        ".twitch.tv"
      )
    ) {
      return "Twitch";
    }

    if (
      host === "facebook.com" ||
      host.endsWith(
        ".facebook.com"
      )
    ) {
      return "Facebook";
    }

    if (
      host === "instagram.com" ||
      host.endsWith(
        ".instagram.com"
      )
    ) {
      return "Instagram";
    }

    if (
      host === "tiktok.com" ||
      host.endsWith(
        ".tiktok.com"
      )
    ) {
      return "TikTok";
    }

    return "External";
  }
}

export const liveStream =
  new LiveStreamManager();

export {
  LiveStreamManager,
};