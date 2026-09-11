import express from "express";

import {
  loginWithGoogle,
  requestOtp,
  verifyOtp,
} from "./authService";

const router = express.Router();

router.post(
  "/register/request-otp",
  async (req, res) => {
    try {
      const { name, email } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          error: "Name is required.",
        });
      }

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          error: "Email address is required.",
        });
      }

      const result = await requestOtp({
        name,
        email,
        purpose: "register",
      });

      return res.json(result);
    } catch (error) {
      console.error(
        "Registration OTP error:",
        error
      );

      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to send OTP.",
      });
    }
  }
);

router.post(
  "/register/verify-otp",
  async (req, res) => {
    try {
      const { name, email, otp } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          error: "Name is required.",
        });
      }

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          error: "Email address is required.",
        });
      }

      if (typeof otp !== "string") {
        return res.status(400).json({
          error: "OTP is required.",
        });
      }

      const result = await verifyOtp({
        name,
        email,
        otp,
        purpose: "register",
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error(
        "Registration OTP verification error:",
        error
      );

      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify OTP.",
      });
    }
  }
);

router.post(
  "/login/request-otp",
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          error: "Email address is required.",
        });
      }

      const result = await requestOtp({
        email,
        purpose: "login",
      });

      return res.json(result);
    } catch (error) {
      console.error(
        "Login OTP error:",
        error
      );

      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to send OTP.",
      });
    }
  }
);

router.post(
  "/login/verify-otp",
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          error: "Email address is required.",
        });
      }

      if (typeof otp !== "string") {
        return res.status(400).json({
          error: "OTP is required.",
        });
      }

      const result = await verifyOtp({
        email,
        otp,
        purpose: "login",
      });

      return res.json(result);
    } catch (error) {
      console.error(
        "Login OTP verification error:",
        error
      );

      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify OTP.",
      });
    }
  }
);

router.post(
  "/google",
  async (req, res) => {
    try {
      const { credential } = req.body;

      if (
        typeof credential !== "string" ||
        !credential.trim()
      ) {
        return res.status(400).json({
          error: "Google credential is required.",
        });
      }

      const result =
        await loginWithGoogle(credential);

      return res.json(result);
    } catch (error) {
      console.error(
        "Google authentication error:",
        error
      );

      return res.status(401).json({
        error:
          error instanceof Error
            ? error.message
            : "Google authentication failed.",
      });
    }
  }
);

export default router;