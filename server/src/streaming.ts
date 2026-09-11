import { spawn, ChildProcess } from "child_process";

let ffmpegProcess: ChildProcess | null = null;

export function startStream(
  inputUrl: string,
  outputUrl: string
): void {
  if (ffmpegProcess) {
    throw new Error(
      "A stream is already running."
    );
  }

  if (!inputUrl) {
    throw new Error(
      "Input stream URL is required."
    );
  }

  if (!outputUrl) {
    throw new Error(
      "Output stream URL is required."
    );
  }

  ffmpegProcess = spawn(
    "ffmpeg",
    [
      "-i",
      inputUrl,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-tune",
      "zerolatency",

      "-c:a",
      "aac",

      "-ar",
      "44100",

      "-b:a",
      "128k",

      "-f",
      "flv",

      outputUrl,
    ],
    {
      stdio: [
        "pipe",
        "pipe",
        "pipe",
      ],
    }
  );

  ffmpegProcess.stdout?.on(
    "data",
    (data) => {
      console.log(
        data.toString()
      );
    }
  );

  ffmpegProcess.stderr?.on(
    "data",
    (data) => {
      console.log(
        data.toString()
      );
    }
  );

  ffmpegProcess.on(
    "close",
    (code) => {
      console.log(
        `FFmpeg exited with code ${code}`
      );

      ffmpegProcess = null;
    }
  );

  ffmpegProcess.on(
    "error",
    (error) => {
      console.error(
        "FFmpeg error:",
        error
      );

      ffmpegProcess = null;
    }
  );
}

export function stopStream(): void {
  if (!ffmpegProcess) {
    return;
  }

  ffmpegProcess.kill(
    "SIGTERM"
  );

  ffmpegProcess = null;
}

export function isStreaming(): boolean {
  return ffmpegProcess !== null;
}