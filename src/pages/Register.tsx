import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  requestRegisterOtp,
  verifyRegisterOtp,
} from "../services/auth";

import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

import "../styles/auth.css";

type RegisterStep =
  | "details"
  | "otp";

interface RegisterLocationState {
  value?: string;
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    isAuthenticated,
  } = useAuth();

  const registrationState =
    location.state as
      | RegisterLocationState
      | null;

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState(
      registrationState?.value || ""
    );

  const [otp, setOtp] =
    useState("");

  const [step, setStep] =
    useState<RegisterStep>("details");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [resendCooldown, setResendCooldown] =
    useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", {
        replace: true,
      });
    }
  }, [
    isAuthenticated,
    navigate,
  ]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((current) =>
        Math.max(current - 1, 0)
      );
    }, 1000);

    return () =>
      window.clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Enter your name.");
      return;
    }

    if (trimmedName.length < 2) {
      setError(
        "Name must contain at least 2 characters."
      );
      return;
    }

    if (!trimmedEmail) {
      setError(
        "Enter your email address."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        trimmedEmail
      )
    ) {
      setError(
        "Enter a valid email address."
      );
      return;
    }

    setLoading(true);

    try {
      await requestRegisterOtp({
        name: trimmedName,
        email: trimmedEmail,
      });

      setStep("otp");
      setOtp("");
      setResendCooldown(30);
      setMessage(
        "OTP sent to your email."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (
      resendCooldown > 0 ||
      loading
    ) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      await requestRegisterOtp({
        name: name.trim(),
        email: email.trim(),
      });

      setOtp("");
      setResendCooldown(30);
      setMessage(
        "A new OTP was sent to your email."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resend OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setError(
        "Enter the 6-digit OTP."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await verifyRegisterOtp({
          name: name.trim(),
          email: email.trim(),
          otp,
        });

      login(response);

      navigate("/", {
        replace: true,
      });
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Unable to verify OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="auth-page">
      <div className="auth-background-shape auth-background-shape-one" />
      <div className="auth-background-shape auth-background-shape-two" />

      <header className="auth-header">
        <button
          type="button"
          className="auth-logo"
          onClick={() => navigate("/")}
        >
          Voxbridge AI
        </button>

        <button
          type="button"
          className="auth-back-button"
          onClick={() => navigate("/")}
        >
          Back
        </button>
      </header>

      <section className="auth-content">
        <div className="auth-card">
          <div className="auth-card-mark">
            V
          </div>

          <h1>Create your account</h1>

          <p className="auth-card-subtitle">
            Register to start using Voxbridge AI.
          </p>

          <div className="auth-divider">
            <span />
            <p>Register</p>
            <span />
          </div>

          {step === "details" ? (
            <>
              <form
                className="auth-form"
                onSubmit={handleRequestOtp}
              >
                <label htmlFor="register-name">
                  Name
                </label>

                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your name"
                  autoComplete="name"
                />

                <label htmlFor="register-email">
                  Email
                </label>

                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Email address"
                  autoComplete="email"
                />

                {error && (
                  <p className="auth-error">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="auth-primary-button"
                  disabled={loading}
                >
                  {loading
                    ? "Sending OTP..."
                    : "Continue with Email"}
                </button>
              </form>

              <div className="auth-divider">
                <span />
                <p>OR</p>
                <span />
              </div>

              <GoogleSignInButton
                onError={setError}
              />
            </>
          ) : (
            <form
              className="auth-form"
              onSubmit={handleVerifyOtp}
            >
              <label htmlFor="register-otp">
                Verification code
              </label>

              <input
                id="register-otp"
                className="auth-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
                placeholder="000000"
                autoComplete="one-time-code"
                disabled={loading}
                autoFocus
              />

              <p className="auth-description">
                Enter the 6-digit OTP sent to{" "}
                <strong>{email}</strong>
              </p>

              {message && (
                <p className="auth-message">
                  {message}
                </p>
              )}

              {error && (
                <p className="auth-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="auth-primary-button"
                disabled={loading}
              >
                {loading
                  ? "Creating account..."
                  : "Create Account"}
              </button>

              <button
                type="button"
                className="auth-text-button"
                onClick={handleResendOtp}
                disabled={
                  loading ||
                  resendCooldown > 0
                }
              >
                {resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : "Resend OTP"}
              </button>

              <button
                type="button"
                className="auth-text-button"
                onClick={() => {
                  setStep("details");
                  setOtp("");
                  setError("");
                  setMessage("");
                  setResendCooldown(0);
                }}
                disabled={loading}
              >
                Change email
              </button>
            </form>
          )}

          <p className="auth-bottom-text">
            Already have an account?{" "}
            <Link to="/login">
              Login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
