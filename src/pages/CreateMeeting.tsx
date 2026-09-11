import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createMeeting, joinMeeting } from "../services/meetings";
import "../styles/CreateMeeting.css";
import AppNavbar from "../components/AppNavbar";

export default function CreateMeeting() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const meeting = await createMeeting(title);

      if (!meeting?.room_id) {
        throw new Error("Server did not return a room ID.");
      }

      await joinMeeting(meeting.room_id);

      navigate(`/call/${encodeURIComponent(meeting.room_id)}`, {
        replace: true,
      });
    } catch (error) {
      console.error("Meeting creation failed:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to create the meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-page">
      <AppNavbar className="create-header" />

      <main className="create-main">
        <section className="create-card">
          <p className="create-label">START A MEETING</p>

          <h1>Create your room.</h1>

          <p className="create-description">
            Give your meeting a name, create the room and invite people with
            the generated room ID.
          </p>

          <div className="create-field">
            <label htmlFor="meeting-title">Meeting name</label>
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
          </div>

          {error && <p className="create-error">{error}</p>}

          <button
            type="button"
            className="create-submit"
            onClick={() => void handleCreate()}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create meeting"}
          </button>

          <div className="create-note">
            <span />
            <p>Your room ID will be available as soon as the meeting starts.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
