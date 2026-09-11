import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

export interface AuthenticatedRequest
  extends Request {
  userId?: string;
}

export function verifyAuthToken(
  token: string
): string {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "Authentication configuration error."
    );
  }

  const decoded =
    jwt.verify(
      token,
      secret
    );

  if (
    typeof decoded ===
      "string" ||
    !decoded.userId ||
    typeof decoded.userId !==
      "string"
  ) {
    throw new Error(
      "Invalid authentication token."
    );
  }

  return decoded.userId;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization =
    req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      error:
        "Authentication required.",
    });
  }

  const parts =
    authorization.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {
    return res.status(401).json({
      error:
        "Invalid authorization format.",
    });
  }

  try {
    req.userId =
      verifyAuthToken(parts[1]);

    next();
  } catch (error) {
    console.error(
      "JWT verification failed:",
      error
    );

    return res.status(401).json({
      error:
        error instanceof Error
          ? error.message
          : "Invalid or expired authentication token.",
    });
  }
}
