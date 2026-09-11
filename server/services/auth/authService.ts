import jwt from "jsonwebtoken";
import { pool } from "../../db/connection";

import {
  generateOtp,
  hashOtp,
  verifyOtp as checkOtp,
} from "./otp";

import { sendOtpEmail } from "./emailService";

type Purpose =
  | "register"
  | "login";

interface RequestOtpInput {
  name?: string;
  email?: string;
  purpose: Purpose;
}

interface VerifyOtpInput {
  name?: string;
  email?: string;
  otp: string;
  purpose: Purpose;
}

function normalizeEmail(email?: string) {
  return (
    email?.trim().toLowerCase() ||
    null
  );
}

export function createToken(userId: string) {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: "7d" }
  );
}

async function findUser(
  email: string | null
) {
  const result =
    await pool.query(
      `SELECT id, name, email, phone, email_verified, phone_verified,
              created_at, updated_at, last_login_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

  return result.rowCount
    ? result.rows[0]
    : null;
}

export async function requestOtp(
  input: RequestOtpInput
) {
  const email =
    normalizeEmail(input.email);

  if (!email) {
    throw new Error(
      "Email address is required."
    );
  }

  const existingUser =
    await findUser(email);

  if (
    input.purpose === "register" &&
    existingUser
  ) {
    throw new Error(
      "An account already exists with this email address."
    );
  }

  if (
    input.purpose === "login" &&
    !existingUser
  ) {
    throw new Error(
      "No account exists with this email address."
    );
  }

  if (
    input.purpose === "register" &&
    !input.name?.trim()
  ) {
    throw new Error(
      "Name is required for registration."
    );
  }

  const otp = generateOtp();

  await pool.query(
    `UPDATE auth_otps
     SET verified_at = NOW()
     WHERE channel = 'email'
       AND email = $1
       AND purpose = $2
       AND verified_at IS NULL`,
    [email, input.purpose]
  );

  await pool.query(
    `INSERT INTO auth_otps
     (email, otp_hash, channel, purpose, expires_at, attempts)
     VALUES ($1, $2, 'email', $3, NOW() + INTERVAL '5 minutes', 0)`,
    [
      email,
      hashOtp(otp),
      input.purpose,
    ]
  );

  try {
    await sendOtpEmail(
      email,
      otp,
      input.name?.trim(),
      input.purpose
    );
  } catch (error) {
    await pool.query(
      `DELETE FROM auth_otps
       WHERE channel = 'email'
         AND email = $1
         AND purpose = $2
         AND verified_at IS NULL`,
      [email, input.purpose]
    );

    throw error;
  }

  return {
    channel: "email" as const,
    message: "OTP sent successfully.",
  };
}

export async function verifyOtp(
  input: VerifyOtpInput
) {
  const email =
    normalizeEmail(input.email);

  if (!email) {
    throw new Error(
      "Email address is required."
    );
  }

  if (!/^\d{6}$/.test(input.otp)) {
    throw new Error(
      "OTP must contain 6 digits."
    );
  }

  const result =
    await pool.query(
      `SELECT *
       FROM auth_otps
       WHERE channel = 'email'
         AND email = $1
         AND purpose = $2
         AND verified_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, input.purpose]
    );

  if (!result.rowCount) {
    throw new Error(
      "OTP is invalid or expired."
    );
  }

  const otpRecord = result.rows[0];

  if (otpRecord.attempts >= 5) {
    throw new Error(
      "Too many OTP attempts. Request a new OTP."
    );
  }

  if (
    !checkOtp(
      input.otp,
      otpRecord.otp_hash
    )
  ) {
    await pool.query(
      `UPDATE auth_otps
       SET attempts = attempts + 1
       WHERE id = $1`,
      [otpRecord.id]
    );

    throw new Error("Invalid OTP.");
  }

  await pool.query(
    `UPDATE auth_otps
     SET verified_at = NOW()
     WHERE id = $1`,
    [otpRecord.id]
  );

  let user;

  if (input.purpose === "register") {
    if (!input.name?.trim()) {
      throw new Error(
        "Name is required for registration."
      );
    }

    if (await findUser(email)) {
      throw new Error(
        "An account already exists with this email address."
      );
    }

    const result =
      await pool.query(
        `INSERT INTO users
         (name, email, email_verified, last_login_at)
         VALUES ($1, $2, TRUE, NOW())
         RETURNING id, name, email, phone, email_verified, phone_verified,
                   created_at, updated_at, last_login_at`,
        [input.name.trim(), email]
      );

    user = result.rows[0];
  } else {
    user = await findUser(email);

    if (!user) {
      throw new Error(
        "User account not found."
      );
    }

    await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    user = await findUser(email);
  }

  if (!user) {
    throw new Error(
      "Unable to retrieve user account."
    );
  }

  return {
    token: createToken(user.id),
    user,
  };
}

export async function loginWithGoogle(
  credential: string
) {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is not configured."
    );
  }

  if (!credential?.trim()) {
    throw new Error(
      "Google credential is required."
    );
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  if (!response.ok) {
    throw new Error(
      "Google credential is invalid or expired."
    );
  }

  const payload = (await response.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    sub?: string;
  };

  if (payload.aud !== clientId) {
    throw new Error(
      "Google credential was issued for another application."
    );
  }

  const email =
    normalizeEmail(payload.email);

  if (!email) {
    throw new Error(
      "Google account email was not provided."
    );
  }

  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === "true";

  if (!emailVerified) {
    throw new Error(
      "Google email address is not verified."
    );
  }

  let user = await findUser(email);

  if (!user) {
    const name =
      payload.name?.trim() ||
      email.split("@")[0];

    const result =
      await pool.query(
        `INSERT INTO users
         (name, email, email_verified, last_login_at)
         VALUES ($1, $2, TRUE, NOW())
         RETURNING id, name, email, phone, email_verified, phone_verified,
                   created_at, updated_at, last_login_at`,
        [name, email]
      );

    user = result.rows[0];
  } else {
    await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    user = await findUser(email);
  }

  if (!user) {
    throw new Error(
      "Unable to retrieve Google account."
    );
  }

  return {
    token: createToken(user.id),
    user,
  };
}
