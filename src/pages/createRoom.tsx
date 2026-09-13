import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Link2,
  Plus,
  Radio,
} from "lucide-react";

import { createMeeting, joinMeeting } from "../services/meetings";
import { useAuth } from "../context/AuthContext";
import "../styles/CreateMeeting.css";

export default function CreateRoom() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName =
    user?.name?.trim() ||
    user?.email?.trim() ||
    user?.phone?.trim() ||
    "Account";

  const displayContact =
    user?.email?.trim() ||
    user?.phone?.trim() ||
    "";

  const avatarLetter =
    displayName.charAt(0).toUpperCase();

  const handleCreate = async () => {
    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const meeting = await createMeeting(title);

      if (!meeting?.room_id) {
        throw new Error(
          "Server did not return a room ID."
        );
      }

      await joinMeeting(meeting.room_id);

      navigate(
        `/call/${encodeURIComponent(meeting.room_id)}`,
        {
          replace: true,
        }
      );
    } catch (err) {
      console.error(
        "Meeting creation failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();

    navigate("/signin", {
      replace: true,
    });
  };

  return (
    <div className="create-page">
      <div className="create-bg-shape create-bg-left" />
      <div className="create-bg-shape create-bg-right" />
      <div className="create-bg-shape create-bg-bottom" />

      <div className="create-shell">
        <header className="create-header">
          <button
            type="button"
            className="create-logo"
            onClick={() => navigate("/")}
          >
            Voxbridge AI
          </button>

          <nav className="create-nav">
            <button
              type="button"
              onClick={() => navigate("/join")}
              disabled={loading}
            >
              Join Room
            </button>

            <button
              type="button"
              onClick={() => navigate("/live")}
              disabled={loading}
            >
              Live Stream
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
            >
              Logout
            </button>
          </nav>

          <div className="create-account">
            <div className="create-avatar">
              {avatarLetter}
            </div>

            <div className="create-user-info">
              <strong>{displayName}</strong>

              {displayContact && (
                <span>{displayContact}</span>
              )}
            </div>
          </div>
        </header>

        <main className="create-main">
          <section className="create-intro">
            <div className="create-icon">
              <Plus
                size={25}
                strokeWidth={1.8}
              />
            </div>

            <p className="create-eyebrow">
              START A MEETING
            </p>

            <h1>
              Create a room.
            </h1>

            <p className="create-description">
              Start a new conversation and invite
              people with a room ID. Everything runs
              directly in your browser.
            </p>

            <div className="create-benefits">
              <div>
                <span>
                  <Check size={14} />
                </span>
                <p>
                  Start directly from your browser
                </p>
              </div>

              <div>
                <span>
                  <Check size={14} />
                </span>
                <p>
                  No desktop installation required
                </p>
              </div>

              <div>
                <span>
                  <Check size={14} />
                </span>
                <p>
                  Share the generated room ID
                </p>
              </div>
            </div>
          </section>

          <section className="create-card">
            <div className="create-card-header">
              <div className="create-card-icon">
                <Radio
                  size={21}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <h2>Create meeting</h2>
                <p>
                  Give your meeting a name to get started.
                </p>
              </div>
            </div>

            <div className="create-form">
              <div className="create-field">
                <label htmlFor="meeting-title">
                  Meeting name
                </label>

                <input
                  id="meeting-title"
                  type="text"
                  value={title}
                  placeholder="e.g. Product sync"
                  autoFocus
                  autoComplete="off"
                  disabled={loading}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleCreate();
                    }
                  }}
                />

                <p className="create-field-hint">
                  Give your room a name that your
                  participants will recognize.
                </p>
              </div>

              {error && (
                <p className="create-error">
                  {error}
                </p>
              )}

              <button
                type="button"
                className="create-submit"
                onClick={() => void handleCreate()}
                disabled={loading}
              >
                {loading
                  ? "Creating..."
                  : "Create meeting"}

                {!loading && (
                  <Plus
                    size={17}
                    strokeWidth={2}
                  />
                )}
              </button>

              <div className="create-note">
                <Link2
                  size={15}
                  strokeWidth={1.8}
                />

                <p>
                  Your room ID will be generated
                  automatically when the meeting starts.
                </p>
              </div>

              <div className="create-divider">
                <span />
                <p>
                  HAVE A ROOM ALREADY?
                </p>
                <span />
              </div>

              <button
                type="button"
                className="create-join-button"
                onClick={() => navigate("/join")}
                disabled={loading}
              >
                Join an existing meeting
              </button>
            </div>
          </section>
        </main>

        <footer className="create-footer">
          <strong>© 2026 Voxbridge AI</strong>
          <span>
            Communication without barriers.
          </span>
        </footer>
      </div>
    </div>
  );
}