import {
  io,
  Socket,
} from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5001";

const AUTH_TOKEN_KEY =
  "wavecall_token";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) {
    return socket;
  }

  const token =
    localStorage.getItem(
      AUTH_TOKEN_KEY
    );

  socket = io(
    SERVER_URL,
    {
      transports: [
        "polling",
        "websocket",
      ],
      auth: {
        token,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    }
  );

  socket.on(
    "connect",
    () => {
      console.log(
        "Socket connected:",
        socket?.id
      );
    }
  );

  socket.on(
    "connect_error",
    (error) => {
      console.error(
        "Socket connection error:",
        error.message
      );
    }
  );

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        "Socket disconnected:",
        reason
      );
    }
  );

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) {
    return;
  }

  socket.disconnect();
  socket = null;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(
    AUTH_TOKEN_KEY
  );
}

export function setAuthToken(
  token: string
): void {
  localStorage.setItem(
    AUTH_TOKEN_KEY,
    token
  );
}

export function clearAuthToken(): void {
  localStorage.removeItem(
    AUTH_TOKEN_KEY
  );
}
