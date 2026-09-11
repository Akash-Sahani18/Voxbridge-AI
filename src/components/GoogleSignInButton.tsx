import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  loginWithGoogle,
} from "../services/auth";

import { useAuth } from "../context/AuthContext";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (
      response: GoogleCredentialResponse
    ) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      width?: number;
      text?: string;
      shape?: string;
    }
  ) => void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface GoogleWindow extends Window {
  google?: {
    accounts: GoogleAccounts;
  };
}

interface GoogleSignInButtonProps {
  onError?: (message: string) => void;
}

const GOOGLE_SCRIPT_ID =
  "google-identity-services";

export default function GoogleSignInButton({
  onError,
}: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] =
    useState(false);

  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) {
      return;
    }

    const renderGoogleButton = () => {
      const google =
        (window as GoogleWindow).google;

      if (!google || !buttonRef.current) {
        return;
      }

      buttonRef.current.innerHTML = "";

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            onError?.(
              "Google authentication did not return a credential."
            );
            return;
          }

          setLoading(true);
          onError?.("");

          try {
            const authResponse =
              await loginWithGoogle(
                response.credential
              );

            login(authResponse);
          } catch (error) {
            onError?.(
              error instanceof Error
                ? error.message
                : "Google authentication failed."
            );
          } finally {
            setLoading(false);
          }
        },
      });

      google.accounts.id.renderButton(
        buttonRef.current,
        {
          theme: "outline",
          size: "large",
          width: 360,
          text: "continue_with",
          shape: "rectangular",
        }
      );
    };

    const existingScript =
      document.getElementById(
        GOOGLE_SCRIPT_ID
      );

    if (existingScript) {
      renderGoogleButton();
      return;
    }

    const script =
      document.createElement("script");

    script.id = GOOGLE_SCRIPT_ID;
    script.src =
      "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;

    document.head.appendChild(script);

    return () => {
      if (buttonRef.current) {
        buttonRef.current.innerHTML = "";
      }
    };
  }, [clientId, login, onError]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="auth-google-wrapper">
      <div
        ref={buttonRef}
        className={
          loading
            ? "auth-google-button-loading"
            : ""
        }
      />

      {loading && (
        <span className="auth-google-loading-text">
          Signing in with Google...
        </span>
      )}
    </div>
  );
}
