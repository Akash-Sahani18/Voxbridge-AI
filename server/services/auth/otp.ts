import crypto from "crypto";

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOtp(otp: string, otpHash: string): boolean {
  return hashOtp(otp) === otpHash;
}