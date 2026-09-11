const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5001";

export const AUTH_TOKEN_KEY = "wavecall_token";
export const AUTH_USER_KEY = "wavecall_user";

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface OtpResponse {
  channel: "email";
  message: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Something went wrong."
    );
  }

  return data as T;
}

export async function requestRegisterOtp(
  input: {
    name: string;
    email: string;
  }
): Promise<OtpResponse> {
  return request<OtpResponse>(
    "/api/auth/register/request-otp",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function verifyRegisterOtp(
  input: {
    name: string;
    email: string;
    otp: string;
  }
): Promise<AuthResponse> {
  return request<AuthResponse>(
    "/api/auth/register/verify-otp",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function requestLoginOtp(
  input: {
    email: string;
  }
): Promise<OtpResponse> {
  return request<OtpResponse>(
    "/api/auth/login/request-otp",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function verifyLoginOtp(
  input: {
    email: string;
    otp: string;
  }
): Promise<AuthResponse> {
  return request<AuthResponse>(
    "/api/auth/login/verify-otp",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function loginWithGoogle(
  credential: string
): Promise<AuthResponse> {
  return request<AuthResponse>(
    "/api/auth/google",
    {
      method: "POST",
      body: JSON.stringify({ credential }),
    }
  );
}

export function saveAuth(
  response: AuthResponse
): void {
  localStorage.setItem(
    AUTH_TOKEN_KEY,
    response.token
  );

  localStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify(response.user)
  );
}

export function getStoredToken(): string | null {
  return localStorage.getItem(
    AUTH_TOKEN_KEY
  );
}

export function getStoredUser(): User | null {
  const value = localStorage.getItem(
    AUTH_USER_KEY
  );

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as User;
  } catch {
    localStorage.removeItem(
      AUTH_USER_KEY
    );

    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(
    AUTH_TOKEN_KEY
  );

  localStorage.removeItem(
    AUTH_USER_KEY
  );
}

export async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
        ...(options.headers || {}),
      },
    }
  );

  if (response.status === 401) {
    clearAuth();
  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Request failed."
    );
  }

  return data as T;
}
