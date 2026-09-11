import "dotenv/config";

import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";

import authRoutes from "./services/auth/authRoutes";
import meetingRoutes from "./services/meeting/meetingRoutes";

import {
  translateText,
} from "./services/transcription/translation";

import {
  generateMeetingSummary,
} from "./services/transcription/aiSummary";

import {
  verifyAuthToken,
} from "./services/auth/authMiddleware";

const PORT = Number(process.env.PORT || 5001);

const CLIENT_URL =
  process.env.CLIENT_URL ||
  "http://localhost:5173";
  
const app = express();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/meetings",
  meetingRoutes
);

app.post(
  "/translate",
  async (req, res) => {
    try {
      const {
        q,
        source,
        target,
      } = req.body;

      if (
        typeof q !== "string" ||
        !q.trim()
      ) {
        return res.status(400).json({
          error:
            "Translation text is required.",
        });
      }

      const result =
        await translateText({
          text: q,
          sourceLanguage:
            source || "en",
          targetLanguage:
            target || "en",
        });

      return res.json({
        translatedText:
          result.translatedText,
      });
    } catch (error) {
      console.error(
        "Translation error:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Translation failed.",
      });
    }
  }
);

const server =
  http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
  transports: [
    "polling",
    "websocket",
  ],
});

io.use((socket, next) => {
  const token =
    typeof socket.handshake.auth?.token ===
    "string"
      ? socket.handshake.auth.token
      : "";

  if (!token) {
    return next(
      new Error(
        "Authentication required."
      )
    );
  }

  try {
    const userId =
      verifyAuthToken(token);

    socket.data.userId =
      userId;

    next();
  } catch (error) {
    console.error(
      "Socket authentication failed:",
      error
    );

    next(
      new Error(
        "Invalid or expired authentication token."
      )
    );
  }
});

interface TranscriptItem {
  id: string;
  sender: string;
  text: string;
  language: string;
  timestamp: number;
}

interface LiveChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: "streamer" | "viewer";
  text: string;
  timestamp: number;
}

interface Room {
  users: Set<string>;
  streamer: string | null;
  streamTitle: string;
  transcript: TranscriptItem[];
  chatMessages: LiveChatMessage[];
}

const rooms =
  new Map<string, Room>();

app.get(
  "/",
  (_req, res) => {
    res.json({
      name: "Voxbridge",
      status: "running",
    });
  }
);

app.get(
  "/health",
  (_req, res) => {
    res.json({
      status: "ok",
    });
  }
);

io.on(
  "connection",
  (socket: Socket) => {
    socket.data.translationEnabled =
      false;

    socket.data.translationTargetLanguage =
      "en";

    console.log(
      "Client connected:",
      socket.id,
      "user:",
      socket.data.userId
    );

    socket.on(
      "join-room",
      (data) => {
        let roomId = "";
        let role = "call";
        let streamTitle = "Live Stream";

        if (
          typeof data === "string"
        ) {
          roomId = data;
        } else if (data) {
          roomId =
            data.roomId || "";

          role =
            data.role || "call";

          if (typeof data.title === "string") {
            streamTitle =
              data.title.trim().slice(0, 100) || "Live Stream";
          }
        }

        roomId =
          roomId.trim();

        if (!roomId) {
          socket.emit(
            "room-error",
            {
              message:
                "Room name is required",
            }
          );

          return;
        }

        let room =
          rooms.get(roomId);

        if (!room) {
          room = {
            users:
              new Set<string>(),
            streamer: null,
            streamTitle: "Live Stream",
            transcript: [],
            chatMessages: [],
          };

          rooms.set(
            roomId,
            room
          );

          console.log(
            "Created room:",
            roomId
          );
        }

        if (
          room.users.has(
            socket.id
          )
        ) {
          console.log(
            "Socket already in room:",
            socket.id
          );

          return;
        }

        if (
          role === "streamer"
        ) {
          if (
            room.streamer &&
            room.streamer !==
              socket.id
          ) {
            socket.emit(
              "room-error",
              {
                message:
                  "A streamer is already in this room.",
              }
            );

            return;
          }

          room.streamer =
            socket.id;

          room.streamTitle =
            streamTitle;
        }

        const existingUsers =
          Array.from(
            room.users
          );

        room.users.add(
          socket.id
        );

        socket.join(
          roomId
        );

        socket.data.roomId =
          roomId;

        socket.data.role =
          role;

        socket.emit(
          "room-transcript",
          room.transcript
        );

        socket.emit(
          "live-chat-history",
          room.chatMessages
        );

        socket.emit(
          "room-users",
          existingUsers
        );

        socket.emit(
          "room-joined",
          {
            roomId,
            users:
              existingUsers,
            streamer:
              room.streamer,
            streamTitle:
              room.streamTitle,
          }
        );

        console.log(
          "Joined room:",
          roomId,
          socket.id,
          role
        );

        if (
          role === "call"
        ) {
          for (
            const userId of
              existingUsers
          ) {
            const existingSocket =
              io.sockets.sockets.get(
                userId
              );

            if (
              existingSocket &&
              existingSocket.data
                .role === "call"
            ) {
              existingSocket.emit(
                "user-joined",
                socket.id
              );

              socket.emit(
                "existing-user",
                userId
              );
            }
          }
        }

        if (
          role === "streamer"
        ) {
          socket
            .to(roomId)
            .emit(
              "stream-started",
              {
                roomId,
                streamerId:
                  socket.id,
                streamTitle:
                  room.streamTitle,
              }
            );

          const viewerCount =
            Array.from(room.users).filter(
              (userId) => {
                const user =
                  io.sockets.sockets.get(userId);

                return user?.data.role === "viewer";
              }
            ).length;

          socket.emit(
            "viewer-count",
            viewerCount
          );

          for (
            const userId of
              existingUsers
          ) {
            const user =
              io.sockets.sockets.get(
                userId
              );

            if (
              user?.data.role ===
              "viewer"
            ) {
              socket.emit(
                "viewer-joined",
                userId
              );

              user.emit(
                "streamer-present",
                socket.id
              );
            }
          }
        }

        if (
          role === "viewer"
        ) {
          if (
            room.streamer
          ) {
            socket.emit(
              "streamer-present",
              room.streamer
            );

            io.to(
              room.streamer
            ).emit(
              "viewer-joined",
              socket.id
            );

            const viewerCount =
              Array.from(room.users).filter(
                (userId) => {
                  const user =
                    io.sockets.sockets.get(userId);

                  return user?.data.role === "viewer";
                }
              ).length;

            io.to(
              room.streamer
            ).emit(
              "viewer-count",
              viewerCount
            );
          } else {
            socket.emit(
              "waiting-for-streamer"
            );
          }
        }
      }
    );

    socket.on(
      "offer",
      (data) => {
        if (
          !data?.target ||
          !data?.offer
        ) {
          return;
        }

        io.to(
          data.target
        ).emit(
          "offer",
          {
            sender:
              socket.id,
            offer:
              data.offer,
          }
        );
      }
    );

    socket.on(
      "answer",
      (data) => {
        if (
          !data?.target ||
          !data?.answer
        ) {
          return;
        }

        io.to(
          data.target
        ).emit(
          "answer",
          {
            sender:
              socket.id,
            answer:
              data.answer,
          }
        );
      }
    );

    socket.on(
      "ice-candidate",
      (data) => {
        if (
          !data?.target ||
          !data?.candidate
        ) {
          return;
        }

        io.to(
          data.target
        ).emit(
          "ice-candidate",
          {
            sender:
              socket.id,
            candidate:
              data.candidate,
          }
        );
      }
    );

    socket.on(
      "caption",
      (data) => {
        if (
          !data ||
          typeof data.roomId !==
            "string" ||
          typeof data.text !==
            "string"
        ) {
          return;
        }

        const room =
          rooms.get(
            data.roomId.trim()
          );

        if (
          !room ||
          !room.users.has(
            socket.id
          )
        ) {
          return;
        }

        const text =
          data.text
            .trim()
            .slice(0, 1000);

        if (!text) {
          return;
        }

        const caption:
          TranscriptItem = {
          id:
            typeof data.captionId ===
              "string" &&
            data.captionId.trim()
              ? data.captionId
              : `${socket.id}-${Date.now()}`,

          sender:
            socket.id,

          text,

          language:
            typeof data.language ===
              "string"
              ? data.language
              : "en-US",

          timestamp:
            Date.now(),
        };

        room.transcript.push(
          caption
        );

        room.transcript =
          room.transcript.slice(
            -100
          );

        io.to(
          data.roomId
        ).emit(
          "caption",
          caption
        );
      }
    );

    socket.on(
      "translation-preference",
      (data) => {
        const roomId =
          socket.data.roomId as
            | string
            | undefined;

        if (
          !roomId ||
          !rooms.has(roomId)
        ) {
          return;
        }

        socket.data.translationEnabled =
          Boolean(
            data?.enabled
          );

        socket.data.translationTargetLanguage =
          normalizeLanguage(
            typeof data?.targetLanguage ===
              "string"
              ? data.targetLanguage
              : "en"
          );

        console.log(
          "Translation preference updated:",
          socket.id,
          socket.data
            .translationEnabled,
          socket.data
            .translationTargetLanguage
        );
      }
    );

    socket.on(
      "translate-caption",
      async (data) => {
        if (
          !data ||
          typeof data.roomId !==
            "string" ||
          typeof data.text !==
            "string"
        ) {
          socket.emit(
            "translation-error",
            {
              message:
                "Invalid translation request.",
            }
          );

          return;
        }

        const roomId =
          data.roomId.trim();

        const room =
          rooms.get(roomId);

        if (
          !room ||
          !room.users.has(
            socket.id
          )
        ) {
          socket.emit(
            "translation-error",
            {
              message:
                "You are not a participant in this room.",
            }
          );

          return;
        }

        const text =
          data.text
            .trim()
            .slice(0, 500);

        if (!text) {
          return;
        }

        const sourceLanguage =
          typeof data.sourceLanguage ===
            "string" &&
          data.sourceLanguage.trim()
            ? data.sourceLanguage
            : "en";

        const recipients =
          new Map<
            string,
            string[]
          >();

        for (
          const userId of
            room.users
        ) {
          const user =
            io.sockets.sockets.get(
              userId
            );

          if (
            !user?.data
              .translationEnabled
          ) {
            continue;
          }

          const targetLanguage =
            normalizeLanguage(
              user.data
                .translationTargetLanguage ||
                "en"
            );

          const users =
            recipients.get(
              targetLanguage
            ) || [];

          users.push(
            userId
          );

          recipients.set(
            targetLanguage,
            users
          );
        }

        if (
          recipients.size === 0
        ) {
          console.log(
            "Translation skipped: no participants have translation enabled."
          );

          return;
        }

        console.log(
          "Translation requested:",
          sourceLanguage,
          "->",
          Array.from(
            recipients.keys()
          )
        );

        try {
          const results =
            await Promise.all(
              Array.from(
                recipients.entries()
              ).map(
                async ([
                  targetLanguage,
                  userIds,
                ]) => {
                  const result =
                    await translateText(
                      {
                        text,
                        sourceLanguage,
                        targetLanguage,
                      }
                    );

                  return {
                    targetLanguage,
                    userIds,
                    result,
                  };
                }
              )
            );

          for (
            const item of
              results
          ) {
            const translation =
              {
                id:
                  `${typeof data.captionId === "string" && data.captionId.trim() ? data.captionId : `${socket.id}-${Date.now()}`}-${item.targetLanguage}`,

                captionId:
                  typeof data.captionId ===
                    "string" &&
                  data.captionId.trim()
                    ? data.captionId
                    : `${socket.id}-${Date.now()}`,

                sender:
                  socket.id,

                originalText:
                  text,

                translatedText:
                  item.result
                    .translatedText
                    .trim(),

                sourceLanguage:
                  item.result
                    .sourceLanguage,

                targetLanguage:
                  item.result
                    .targetLanguage,

                timestamp:
                  Date.now(),
              };

            for (
              const userId of
                item.userIds
            ) {
              io.to(
                userId
              ).emit(
                "translation",
                translation
              );
            }
          }

          console.log(
            "Translation sent to:",
            Array.from(
              recipients.values()
            ).flat()
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Translation failed.";

          console.error(
            "Translation failed:",
            error
          );

          socket.emit(
            "translation-error",
            {
              message,
            }
          );
        }
      }
    );

    socket.on(
      "generate-ai-summary",
      async (
        roomId: string
      ) => {
        const normalizedRoomId =
          typeof roomId ===
            "string"
            ? roomId.trim()
            : "";

        const room =
          rooms.get(
            normalizedRoomId
          );

        if (
          !room ||
          !room.users.has(
            socket.id
          )
        ) {
          socket.emit(
            "ai-summary-error",
            {
              message:
                "You are not a participant in this room.",
            }
          );

          return;
        }

        if (
          room.transcript
            .length === 0
        ) {
          socket.emit(
            "ai-summary-error",
            {
              message:
                "There is no transcript to summarize.",
            }
          );

          return;
        }

        try {
          const summary =
            await generateMeetingSummary(
              room.transcript
            );

          io.to(
            normalizedRoomId
          ).emit(
            "ai-summary",
            summary
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "AI summary generation failed.";

          console.error(
            "AI summary generation failed:",
            error
          );

          socket.emit(
            "ai-summary-error",
            {
              message,
            }
          );
        }
      }
    );

    socket.on(
      "clear-captions",
      (roomId: string) => {
        const normalizedRoomId =
          typeof roomId ===
            "string"
            ? roomId.trim()
            : "";

        const room =
          rooms.get(
            normalizedRoomId
          );

        if (
          !room ||
          !room.users.has(
            socket.id
          )
        ) {
          return;
        }

        room.transcript =
          [];

        io.to(
          normalizedRoomId
        ).emit(
          "captions-cleared"
        );
      }
    );

    socket.on(
      "stream-started",
      (roomId: string) => {
        const room =
          rooms.get(roomId);

        if (
          !room ||
          room.streamer !==
            socket.id
        ) {
          return;
        }

        socket
          .to(roomId)
          .emit(
            "stream-started",
            {
              roomId,
              streamerId:
                socket.id,
              streamTitle:
                room.streamTitle,
            }
          );
      }
    );

    socket.on(
      "stream-stopped",
      (roomId: string) => {
        const room =
          rooms.get(roomId);

        if (
          !room ||
          room.streamer !==
            socket.id
        ) {
          return;
        }

        room.streamer =
          null;

        socket
          .to(roomId)
          .emit(
            "stream-stopped",
            {
              roomId,
              streamerId:
                socket.id,
            }
          );
      }
    );

    socket.on(
      "live-chat-history-request",
      (data) => {
        const roomId =
          typeof data?.roomId === "string"
            ? data.roomId.trim()
            : "";

        if (!roomId) {
          return;
        }

        const room = rooms.get(roomId);

        if (!room || !room.users.has(socket.id)) {
          return;
        }

        socket.emit(
          "live-chat-history",
          room.chatMessages
        );
      }
    );

    socket.on(
      "live-chat-message",
      (data) => {
        const roomId =
          typeof data?.roomId === "string"
            ? data.roomId.trim()
            : "";

        const text =
          typeof data?.text === "string"
            ? data.text.trim().slice(0, 500)
            : "";

        const now = Date.now();
        const recentMessages =
          Array.isArray(socket.data.chatMessageTimes)
            ? socket.data.chatMessageTimes.filter(
                (timestamp: number) => now - timestamp < 5000
              )
            : [];

        if (recentMessages.length >= 5) {
          socket.emit("live-chat-error", {
            message: "Please slow down before sending another message.",
          });
          return;
        }

        recentMessages.push(now);
        socket.data.chatMessageTimes = recentMessages;

        const senderName =
          typeof data?.senderName === "string"
            ? data.senderName.trim().slice(0, 80)
            : "";

        const role =
          socket.data.role === "streamer"
            ? "streamer"
            : "viewer";

        if (!roomId || !text) {
          return;
        }

        const room = rooms.get(roomId);

        if (
          !room ||
          !room.users.has(socket.id) ||
          (role === "streamer" && room.streamer !== socket.id)
        ) {
          return;
        }

        const authenticatedName =
          typeof socket.data.userName === "string"
            ? socket.data.userName.trim().slice(0, 80)
            : "";

        const displayName =
          authenticatedName ||
          (typeof senderName === "string"
            ? senderName.trim().slice(0, 80)
            : "");

        if (!displayName) {
          return;
        }

        const message: LiveChatMessage = {
          id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: socket.id,
          senderName: displayName,
          role,
          text,
          timestamp: Date.now(),
        };

        room.chatMessages.push(message);

        if (room.chatMessages.length > 100) {
          room.chatMessages = room.chatMessages.slice(-100);
        }

        io.to(roomId).emit(
          "live-chat-message",
          message
        );
      }
    );

    socket.on(
      "leave-room",
      () => {
        leaveRoom(socket);
      }
    );

    socket.on(
      "disconnect",
      (reason) => {
        console.log(
          "Client disconnected:",
          socket.id
        );

        console.log(
          "Reason:",
          reason
        );

        leaveRoom(socket);
      }
    );
  }
);

function normalizeLanguage(
  language: string
) {
  return (
    language
      ?.trim()
      .toLowerCase()
      .split("-")[0] ||
    "en"
  );
}

function leaveRoom(
  socket: Socket
) {
  const roomId =
    socket.data.roomId as
      | string
      | undefined;

  if (!roomId) {
    return;
  }

  const room =
    rooms.get(roomId);

  if (!room) {
    return;
  }

  const wasStreamer =
    room.streamer ===
    socket.id;

  room.users.delete(
    socket.id
  );

  if (wasStreamer) {
    room.streamer =
      null;

    socket
      .to(roomId)
      .emit(
        "stream-stopped",
        {
          roomId,
          streamerId:
            socket.id,
        }
      );
  }

  socket
    .to(roomId)
    .emit(
      "user-left",
      socket.id
    );

  if (!wasStreamer) {
    const viewerCount =
      Array.from(room.users).filter(
        (userId) => {
          const user =
            io.sockets.sockets.get(userId);

          return user?.data.role === "viewer";
        }
      ).length;

    if (room.streamer) {
      io.to(
        room.streamer
      ).emit(
        "viewer-count",
        viewerCount
      );
    }
  }

  socket.leave(
    roomId
  );

  if (
    room.users.size === 0
  ) {
    rooms.delete(
      roomId
    );

    console.log(
      "Room deleted:",
      roomId
    );
  }

  socket.data.roomId =
    undefined;

  socket.data.role =
    undefined;
}

server.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "Voxbridge server running"
    );
    console.log(
      `http://localhost:${PORT}`
    );
    console.log("");
  }
);