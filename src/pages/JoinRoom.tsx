import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  ArrowRight,
  Check,
  DoorOpen,
  Link2,
} from "lucide-react";

import {
  joinMeeting,
} from "../services/meetings";

import "../styles/JoinRoom.css";
import AppNavbar from "../components/AppNavbar";

export default function JoinRoom() {
  const navigate = useNavigate();

  const [roomName, setRoomName] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleJoin = async () => {
    if (loading) {
      return;
    }

    const room =
      roomName.trim();

    if (!room) {
      setError(
        "Please enter a room ID."
      );

      return;
    }

    if (room.length < 3) {
      setError(
        "Room ID must be at least 3 characters."
      );

      return;
    }

    setError("");
    setLoading(true);

    try {
      await joinMeeting(room);

      navigate(
        `/call/${encodeURIComponent(room)}`,
        {
          replace: true,
        }
      );
    } catch (joinError) {
      console.error(
        "[MEETING] JOIN ROOM FAILED:",
        joinError
      );

      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join the meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="join-page">
      <div className="join-bg-shape join-bg-one" />
      <div className="join-bg-shape join-bg-two" />
      <div className="join-bg-shape join-bg-three" />

      <AppNavbar className="join-navbar" />

      <section className="join-content">
        <div className="join-layout">
          <div className="join-intro">
            <div className="join-icon">
              <DoorOpen size={23} />
            </div>

            <p className="join-label">
              JOIN A MEETING
            </p>

            <h1>
              Join a room.
            </h1>

            <p className="join-description">
              Enter the room ID shared with you
              and join the conversation directly
              from your browser.
            </p>

            <div className="join-benefits">
              <div className="join-benefit">
                <span>
                  <Check size={15} />
                </span>

                <p>
                  Join directly from your browser
                </p>
              </div>

              <div className="join-benefit">
                <span>
                  <Check size={15} />
                </span>

                <p>
                  No desktop installation required
                </p>
              </div>

              <div className="join-benefit">
                <span>
                  <Check size={15} />
                </span>

                <p>
                  Connect using your shared room ID
                </p>
              </div>
            </div>
          </div>

          <section className="join-card">
            <div className="join-card-header">
              <div className="join-card-icon">
                <DoorOpen size={19} />
              </div>

              <div>
                <h2>
                  Join meeting
                </h2>

                <p>
                  Enter your room ID to continue.
                </p>
              </div>
            </div>

            <div className="join-field">
              <label htmlFor="room-name">
                Room ID
              </label>

              <input
                id="room-name"
                type="text"
                value={roomName}
                placeholder="e.g. wave-a83f21c4"
                autoFocus
                autoComplete="off"
                maxLength={100}
                disabled={loading}
                onChange={(event) => {
                  setRoomName(
                    event.target.value
                  );

                  setError("");
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    void handleJoin();
                  }
                }}
              />

              <span className="join-field-hint">
                Enter the room ID provided by
                the meeting host.
              </span>
            </div>

            {error && (
              <p className="join-error">
                {error}
              </p>
            )}

            <button
              type="button"
              className="join-submit"
              onClick={() =>
                void handleJoin()
              }
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="join-spinner" />
                  Joining meeting...
                </>
              ) : (
                <>
                  Join meeting
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="join-note">
              <Link2 size={17} />

              <p>
                Your room ID is usually shared
                with you by the meeting host.
              </p>
            </div>

            <div className="join-divider">
              <span />
              <p>
                NEW TO VOXBRIDGE?
              </p>
              <span />
            </div>

            <button
              type="button"
              className="join-create-button"
              onClick={() =>
                navigate("/create")
              }
              disabled={loading}
            >
              Create a new meeting
            </button>
          </section>
        </div>
      </section>

      <footer className="join-footer">
        <span>
          © 2026 Voxbridge
        </span>

        <span>
          Communication without barriers.
        </span>
      </footer>
    </main>
  );
}