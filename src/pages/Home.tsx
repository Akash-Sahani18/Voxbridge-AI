import {
  Brain,
  Captions,
  Globe2,
  MonitorUp,
  Radio,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import "../styles/Home.css";
import AppNavbar from "../components/AppNavbar";
import { useAuth } from "../context/AuthContext";
type Feature = {
  number: string;
  title: string;
  description: string;
  icon: typeof Video;
  visual:
    | "video"
    | "captions"
    | "translation"
    | "ai"
    | "screen"
    | "stream";
};

const features: Feature[] = [
  {
    number: "01",
    title: "Video calls",
    description:
      "Real-time browser-based communication for teams and conversations.",
    icon: Video,
    visual: "video",
  },
  {
    number: "02",
    title: "Live captions",
    description:
      "Follow the conversation with captions generated as people speak.",
    icon: Captions,
    visual: "captions",
  },
  {
    number: "03",
    title: "Translation",
    description:
      "Understand conversations across languages in real time.",
    icon: Globe2,
    visual: "translation",
  },
  {
    number: "04",
    title: "Meeting intelligence",
    description:
      "Turn conversations into useful summaries, decisions and takeaways.",
    icon: Brain,
    visual: "ai",
  },
  {
    number: "05",
    title: "Screen sharing",
    description:
      "Present your screen without leaving the conversation.",
    icon: MonitorUp,
    visual: "screen",
  },
  {
    number: "06",
    title: "Live streaming",
    description:
      "Broadcast a live room to an audience beyond the meeting.",
    icon: Radio,
    visual: "stream",
  },
];

function FeatureVisual({
  type,
}: {
  type: Feature["visual"];
}) {
  if (type === "video") {
    return (
      <div className="video-visual">
        <div className="video-tile active">
          <span>A</span>
        </div>

        <div className="video-tile">
          <span>R</span>
        </div>

        <div className="video-tile">
          <span>M</span>
        </div>
      </div>
    );
  }

  if (type === "captions") {
    return (
      <div className="caption-visual">
        <div className="caption-row">
          <small>CC</small>
          <span>Let's get started.</span>
        </div>

        <div className="caption-row">
          <small>CC</small>
          <span>Sounds good.</span>
        </div>

        <div className="caption-row">
          <small>CC</small>
          <span>I'll share the plan.</span>
        </div>
      </div>
    );
  }

  if (type === "translation") {
    return (
      <div className="translation-visual">
        <div className="translation-languages">
          <span>English</span>
          <span>Spanish</span>
        </div>

        <div className="translation-box">
          <span>Hello, everyone</span>
          <strong>→</strong>
          <span>Hola a todos</span>
        </div>

        <small>Translated in real time</small>
      </div>
    );
  }

  if (type === "ai") {
    return (
      <div className="ai-visual">
        <div className="ai-header">
          <span>Meeting summary</span>
          <small>03</small>
        </div>

        <div className="ai-item">
          <span>Key points</span>
        </div>

        <div className="ai-item">
          <span>Decisions</span>
        </div>

        <div className="ai-item">
          <span>Action items</span>
        </div>
      </div>
    );
  }

  if (type === "screen") {
    return (
      <div className="screen-visual">
        <div className="screen-header">
          <span>You are sharing</span>
          <small>Stop</small>
        </div>

        <div className="screen-window">
          <span>PRODUCT</span>
          <strong>Presentation</strong>
          <small>Quarterly review</small>
        </div>
      </div>
    );
  }

  return (
    <div className="stream-visual">
      <div className="stream-header">
        <span>Live now</span>
        <strong>LIVE</strong>
      </div>

      <div className="stream-content">
        <div className="stream-avatar">A</div>

        <div>
          <strong>Product showcase</strong>
          <small>128 viewers</small>
        </div>
      </div>

      <div className="stream-footer">
        <span>Public room</span>
        <strong>128 watching</strong>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const go = (path: string) => {
    navigate(path);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <div className="home">
      <AppNavbar className="home-container" />

      <main>
        <section className="hero">
          <div className="home-container">
            <div className="hero-content">
              <span className="hero-eyebrow">
                REAL-TIME COMMUNICATION
              </span>

              <h1 className="hero-title">
                Meet.
                <br />
                Talk.
                <br />
                <span>Understand.</span>
              </h1>

              <p className="hero-description">
                Video calls with live captions, translation and meeting
                intelligence built into the conversation.
              </p>

              <div className="hero-actions">
                <button
                  className="hero-button"
                  onClick={() => go("/create")}
                  type="button"
                >
                  Start a meeting
                </button>

                <button
                  className="hero-button secondary"
                  onClick={() => go("/join")}
                  type="button"
                >
                  Join a room
                </button>

                <button
                  className="hero-button live"
                  onClick={() => go("/live")}
                  type="button"
                >
                  Live Stream
                </button>
              </div>

              <p className="hero-note">
                No installation required. Works in your browser.
              </p>
            </div>

            <div className="hero-visual">
              <div className="product-stage">
                <div className="meeting-preview">
                  <div className="meeting-preview-header">
                    <div>
                      <span className="preview-label">
                        VOXBRIDGE AI / LIVE ROOM
                      </span>

                      <strong>Team sync</strong>

                      <small>
                        Room: vox-a83f21c4
                      </small>
                    </div>

                    <span className="live-pill">
                      Live
                    </span>
                  </div>

                  <div className="preview-screen">
                    <div className="preview-person">
                      <div className="person-avatar">
                        A
                      </div>

                      <span>You</span>
                    </div>

                    <div className="preview-person">
                      <div className="person-avatar">
                        R
                      </div>

                      <span>Rahul</span>
                    </div>

                    <div className="preview-person">
                      <div className="person-avatar">
                        M
                      </div>

                      <span>Maya</span>
                    </div>
                  </div>

                  <div className="preview-footer">
                    <span>English</span>
                    <span>Captions on</span>
                    <span>Translation off</span>

                    <button type="button">
                      Leave
                    </button>
                  </div>
                </div>

                <div className="floating-card caption-card">
                  <span>LIVE CAPTIONS</span>

                  <strong>
                    Let's review the plan...
                  </strong>
                </div>

                <div className="floating-card insight-card">
                  <span>MEETING INSIGHT</span>

                  <strong>
                    3 key points captured
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-section">
          <div className="home-container trust-inner">
            <span className="trust-label">
              BUILT FOR BETTER CONVERSATIONS
            </span>

            <div className="trust-items">
              <span className="trust-item">
                Video
              </span>

              <span className="trust-item">
                Captions
              </span>

              <span className="trust-item">
                Translation
              </span>

              <span className="trust-item">
                AI insights
              </span>
            </div>
          </div>
        </section>

        <section
          className="features-section"
          id="features"
        >
          <div className="home-container">
            <div className="features-heading">
              <div className="section-eyebrow">
                ONE WORKSPACE
              </div>

              <h2 className="section-title">
                Everything important stays in the conversation.
              </h2>

              <p className="section-description">
                Voxbridge AI brings the core tools for meetings and live
                communication together, without making the experience
                complicated.
              </p>
            </div>

            <div className="features-grid">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    className="feature-card"
                    key={feature.number}
                  >
                    <div className="feature-top">
                      <span className="feature-number">
                        {feature.number}
                      </span>

                      <div className="feature-icon">
                        <Icon
                          size={15}
                          strokeWidth={1.8}
                        />
                      </div>
                    </div>

                    <div className="feature-content">
                      <div className="feature-copy">
                        <h3>
                          {feature.title}
                        </h3>

                        <p>
                          {feature.description}
                        </p>
                      </div>

                      <div className="feature-visual">
                        <FeatureVisual
                          type={feature.visual}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="workflow-section"
          id="workflow"
        >
          <div className="home-container">
            <div className="workflow-header">
              <div>
                <div className="section-eyebrow">
                  HOW IT WORKS
                </div>

                <h2 className="section-title">
                  Simple on the surface.
                  <br />
                  Powerful during the call.
                </h2>
              </div>

              <p className="workflow-description">
                Create a room, invite people and let Voxbridge AI handle the
                communication layer while you focus on the conversation.
              </p>
            </div>

            <div className="workflow-grid">
              <article className="workflow-step">
                <span className="workflow-number">
                  1
                </span>

                <h3>
                  Create a room
                </h3>

                <p>
                  Start a meeting and share the room ID with your participants.
                </p>
              </article>

              <article className="workflow-step">
                <span className="workflow-number">
                  2
                </span>

                <h3>
                  Connect instantly
                </h3>

                <p>
                  Join directly from a supported browser without installing
                  another application.
                </p>
              </article>

              <article className="workflow-step">
                <span className="workflow-number">
                  3
                </span>

                <h3>
                  Make every call useful
                </h3>

                <p>
                  Use captions, translation, screen sharing and meeting
                  intelligence when needed.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="intelligence-section"
          id="intelligence"
        >
          <div className="home-container">
            <div className="intelligence-layout">
              <div className="intelligence-copy">
                <div className="section-eyebrow">
                  MEETING INTELLIGENCE
                </div>

                <h2 className="section-title">
                  Don't just finish the call.
                  <br />
                  Know what came out of it.
                </h2>

                <p className="intelligence-description">
                  Voxbridge AI can turn a conversation into structured meeting
                  takeaways, helping you keep track of what was discussed.
                </p>
              </div>

              <div className="summary-card">
                <div className="summary-header">
                  <span className="summary-label">
                    MEETING SUMMARY
                  </span>

                  <span className="summary-status">
                    READY
                  </span>
                </div>

                <h3 className="summary-title">
                  Weekly product sync
                </h3>

                <div className="summary-section">
                  <strong>
                    Key points
                  </strong>

                  <p>
                    Reviewed the current release and discussed remaining work.
                  </p>
                </div>

                <div className="summary-section">
                  <strong>
                    Decisions
                  </strong>

                  <p>
                    Prioritize the meeting experience for the next update.
                  </p>
                </div>

                <div className="summary-section">
                  <strong>
                    Action items
                  </strong>

                  <p>
                    Finalize the room flow and test the production deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="home-container">
            <div className="cta-content">
              <div className="cta-eyebrow">
                READY WHEN YOU ARE
              </div>

              <h2 className="cta-title">
                Start your next conversation with Voxbridge AI.
              </h2>

              <p className="cta-description">
                Bring your team together with video, captions, translation,
                live streaming and meeting intelligence.
              </p>

              <button
                className="cta-button"
                onClick={() => go("/create")}
                type="button"
              >
                Start a meeting
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container">
          <div className="footer-main">
            <div className="footer-brand-section">
              <button
                className="footer-brand"
                onClick={() => go("/")}
                type="button"
              >
                Voxbridge AI
              </button>

              <p>
                Real-time communication for teams
                <br />
                with captions, translation and AI.
              </p>
            </div>

            <div className="footer-column">
              <h3>
                Product
              </h3>

              <button
                type="button"
                onClick={() => go("/create")}
              >
                Meetings
              </button>

              <button
                type="button"
                onClick={() => go("/live")}
              >
                Live streaming
              </button>

              <button
                type="button"
                onClick={() => scrollTo("features")}
              >
                Live captions
              </button>

              <button
                type="button"
                onClick={() => scrollTo("features")}
              >
                Translation
              </button>
            </div>

            <div className="footer-column">
              <h3>
                Company
              </h3>

              <button
                type="button"
                onClick={() => scrollTo("workflow")}
              >
                About
              </button>

              {!isAuthenticated && (
                <>
                  <button
                    type="button"
                    onClick={() => go("/login")}
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => go("/register")}
                  >
                    Register
                  </button>
                </>
              )}

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={logout}
                >
                  Logout
                </button>
              )}

              <button type="button">
                Privacy
              </button>

              <button type="button">
                Terms
              </button>
            </div>

            <div className="footer-column">
              <h3>
                Resources
              </h3>

              <button
                type="button"
                onClick={() => scrollTo("workflow")}
              >
                How it works
              </button>

              <button
                type="button"
                onClick={() => scrollTo("features")}
              >
                Features
              </button>

              <button
                type="button"
                onClick={() => scrollTo("intelligence")}
              >
                AI insights
              </button>

              <button
                type="button"
                onClick={() => go("/join")}
              >
                Join a room
              </button>
            </div>
          </div>

          <div className="footer-bottom">
            <span>
              © 2026 Voxbridge AI
            </span>

            <span>
              Real-time communication with meeting intelligence.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}