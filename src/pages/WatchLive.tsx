import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  connectSocket,
} from "../services/socket";

import AppNavbar from "../components/AppNavbar";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

import LiveChat from "../components/LiveChat";
import { useAuth } from "../context/AuthContext";
import "../styles/WatchLive.css";

interface RoomJoinedData {
  roomId: string;
  users: string[];
  streamer?: string | null;
}

interface OfferData {
  sender: string;
  offer: RTCSessionDescriptionInit;
}

interface IceCandidateData {
  sender: string;
  candidate: RTCIceCandidateInit;
}

export default function WatchLive() {
  const {
    roomId: routeRoomId,
  } = useParams();

  const navigate =
    useNavigate();

  const { user } = useAuth();

  const roomId =
    routeRoomId
      ? decodeURIComponent(
          routeRoomId
        ).trim()
      : "";

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const watchVideoRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const peerRef =
    useRef<RTCPeerConnection | null>(
      null
    );

  const streamerIdRef =
    useRef<string | null>(
      null
    );

  const pendingIceRef =
    useRef<RTCIceCandidateInit[]>(
      []
    );

  const remoteStreamRef =
    useRef<MediaStream | null>(null);

  const mountedRef =
    useRef(true);

  const [status, setStatus] =
    useState(
      "Connecting"
    );

  const [error, setError] =
    useState("");

  const [hasVideo, setHasVideo] =
    useState(false);

  const [isChatVisible, setIsChatVisible] =
    useState(true);

  const [isMuted, setIsMuted] =
    useState(false);

  const [volume, setVolume] =
    useState(1);

  const [isPlaying, setIsPlaying] =
    useState(true);

  const previousVolumeRef =
    useRef(1);

  const displayName =
    user?.name?.trim() ||
    user?.email?.trim() ||
    user?.phone?.trim() ||
    "Viewer";

  /*
   * ---------------------------------------------------------
   * CREATE PEER
   * ---------------------------------------------------------
   */
  const createPeerConnection =
    (
      streamerId: string
    ) => {
      const socket =
        connectSocket();

      /*
       * Close previous peer.
       */
      if (
        peerRef.current
      ) {
        try {
          peerRef.current.close();
        } catch {
          // Ignore.
        }

        peerRef.current =
          null;
      }

      streamerIdRef.current =
        streamerId;

      const peer =
        new RTCPeerConnection({
          iceServers: [
            {
              urls:
                "stun:stun.l.google.com:19302",
            },
            {
              urls:
                "stun:stun1.l.google.com:19302",
            },
          ],
        });

      peerRef.current =
        peer;

      /*
       * Explicitly reserve receive transceivers for the
       * streamer's video and audio tracks.
       */
      peer.addTransceiver(
        "video",
        { direction: "recvonly" }
      );

      peer.addTransceiver(
        "audio",
        { direction: "recvonly" }
      );

      remoteStreamRef.current =
        null;

      /*
       * -----------------------------------------------------
       * REMOTE TRACK
       * -----------------------------------------------------
       */
      peer.ontrack =
        async (event) => {
          console.log(
            "Remote track received:",
            event.track.kind
          );

          const stream =
            event.streams[0] ||
            remoteStreamRef.current ||
            new MediaStream();

          if (!remoteStreamRef.current) {
            remoteStreamRef.current = stream;
          }

          if (!stream.getTracks().some((track) => track.id === event.track.id)) {
            stream.addTrack(event.track);
          }

          const video =
            videoRef.current;

          if (!video) {
            console.warn(
              "Video element not available when remote track arrived."
            );
            return;
          }

          video.srcObject =
            stream;
          video.autoplay =
            true;
          video.playsInline =
            true;

          /*
           * Start muted so browser autoplay policies do not
           * block the live video. The viewer can unmute using
           * the native video controls.
           */
          video.muted =
            true;

          setHasVideo(
            true
          );
          setStatus(
            "Live"
          );
          setError("");

          const playVideo = async () => {
            try {
              await video.play();
              console.log(
                "Viewer video started."
              );
            } catch (playError) {
              console.warn(
                "Viewer autoplay blocked:",
                playError
              );
            }
          };

          if (video.readyState >= 2) {
            await playVideo();
          } else {
            video.onloadedmetadata = () => {
              void playVideo();
            };
          }
        };

      /*
       * -----------------------------------------------------
       * ICE
       * -----------------------------------------------------
       */
      peer.onicecandidate =
        (event) => {
          if (
            !event.candidate
          ) {
            return;
          }

          if (
            !socket.connected
          ) {
            return;
          }

          socket.emit(
            "ice-candidate",
            {
              target:
                streamerId,

              candidate:
                event.candidate.toJSON(),
            }
          );
        };

      /*
       * -----------------------------------------------------
       * CONNECTION STATE
       * -----------------------------------------------------
       */
      peer.onconnectionstatechange =
        () => {
          console.log(
            "Viewer connection:",
            peer.connectionState
          );

          switch (
            peer.connectionState
          ) {
            case "connected":
              setStatus(
                "Live"
              );

              setError("");

              break;

            case "connecting":
              setStatus(
                "Connecting to streamer"
              );

              break;

            case "disconnected":
              setStatus(
                "Stream disconnected"
              );

              break;

            case "failed":
              setStatus(
                "Connection failed"
              );

              setError(
                "Unable to establish the live stream connection."
              );

              break;

            case "closed":
              if (videoRef.current) {
                videoRef.current.srcObject = null;
              }

              remoteStreamRef.current = null;

              setStatus(
                "Waiting for streamer"
              );

              setHasVideo(
                false
              );

              break;
          }
        };

      /*
       * -----------------------------------------------------
       * ICE CONNECTION STATE
       * -----------------------------------------------------
       */
      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "Viewer ICE state:",
            peer.iceConnectionState
          );

          if (
            peer.iceConnectionState ===
            "failed"
          ) {
            setError(
              "Network connection to the streamer failed."
            );
          }
        };

      return peer;
    };

  /*
   * ---------------------------------------------------------
   * APPLY PENDING ICE
   * ---------------------------------------------------------
   */
  const addPendingIce =
    async (
      peer: RTCPeerConnection
    ) => {
      const candidates =
        pendingIceRef.current;

      pendingIceRef.current =
        [];

      for (
        const candidate of candidates
      ) {
        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );
        } catch (error) {
          console.error(
            "Pending ICE error:",
            error
          );
        }
      }
    };

  /*
   * ---------------------------------------------------------
   * SOCKET + WEBRTC
   * ---------------------------------------------------------
   */
  useEffect(() => {
    mountedRef.current =
      true;

    if (
      !roomId
    ) {
      setStatus(
        "Connection error"
      );

      setError(
        "Invalid stream room."
      );

      return;
    }

    const socket =
      connectSocket();

    /*
     * -------------------------------------------------------
     * JOIN
     * -------------------------------------------------------
     */
    const joinRoom =
      () => {
        if (
          !socket.connected
        ) {
          return;
        }

        console.log(
          "Viewer joining:",
          roomId,
          socket.id
        );

        setStatus(
          "Waiting for streamer"
        );

        setError("");

        socket.emit(
          "join-room",
          {
            roomId,
            role:
              "viewer",
          }
        );
      };

    /*
     * -------------------------------------------------------
     * CONNECT
     * -------------------------------------------------------
     */
    const handleConnect =
      () => {
        console.log(
          "Viewer connected:",
          socket.id
        );

        joinRoom();
      };

    /*
     * -------------------------------------------------------
     * ROOM JOINED
     * -------------------------------------------------------
     */
    const handleRoomJoined =
      (
        data: RoomJoinedData
      ) => {
        console.log(
          "Room joined:",
          data
        );

        if (
          data.streamer
        ) {
          streamerIdRef.current =
            data.streamer;

          setStatus(
            "Connecting to streamer"
          );

          if (
            !peerRef.current ||
            peerRef.current.connectionState === "closed"
          ) {
            createPeerConnection(
              data.streamer
            );
          }
        } else {
          setStatus(
            "Waiting for streamer"
          );
        }
      };

    /*
     * -------------------------------------------------------
     * STREAMER PRESENT
     * -------------------------------------------------------
     */
    const handleStreamerPresent =
      (
        streamerId: string
      ) => {
        if (
          !streamerId
        ) {
          return;
        }

        console.log(
          "Streamer present:",
          streamerId
        );

        streamerIdRef.current =
          streamerId;

        setStatus(
          "Connecting to streamer"
        );

        setError("");

        /*
         * The streamer will send us
         * the offer.
         *
         * We create the peer now so
         * the offer can be handled.
         */
        createPeerConnection(
          streamerId
        );
      };

    /*
     * -------------------------------------------------------
     * STREAM STARTED
     * -------------------------------------------------------
     */
    const handleStreamStarted =
      (data?: {
        streamerId?: string;
      }) => {
        console.log(
          "Stream started:",
          data
        );

        if (
          data?.streamerId
        ) {
          streamerIdRef.current =
            data.streamerId;

          setStatus(
            "Connecting to streamer"
          );

          /*
           * Make sure peer exists.
           */
          if (
            !peerRef.current
          ) {
            createPeerConnection(
              data.streamerId
            );
          }
        } else {
          setStatus(
            "Connecting to streamer"
          );
        }
      };

    /*
     * -------------------------------------------------------
     * OFFER
     * -------------------------------------------------------
     */
    const handleOffer =
      async ({
        sender,
        offer,
      }: OfferData) => {
        console.log(
          "Offer received from:",
          sender
        );

        try {
          streamerIdRef.current =
            sender;

          let peer =
            peerRef.current;

          /*
           * Create peer if streamer
           * sent offer before
           * streamer-present.
           */
          if (
            !peer ||
            peer.connectionState ===
              "closed"
          ) {
            peer =
              createPeerConnection(
                sender
              );
          }

          /*
           * Ignore stale offers.
           */
          if (
            peer.signalingState !==
            "stable"
          ) {
            console.warn(
              "Peer is not stable. Current state:",
              peer.signalingState
            );

            return;
          }

          setStatus(
            "Connecting to streamer"
          );

          await peer.setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );

          /*
           * ICE candidates may have arrived
           * before the offer.
           */
          await addPendingIce(
            peer
          );

          const answer =
            await peer.createAnswer();

          await peer.setLocalDescription(
            answer
          );

          const localDescription =
            peer.localDescription;

          if (
            !localDescription
          ) {
            throw new Error(
              "Viewer local description was not created."
            );
          }

          socket.emit(
            "answer",
            {
              target:
                sender,

              answer:
                localDescription,
            }
          );

          console.log(
            "Answer sent to streamer:",
            sender
          );
        } catch (error) {
          console.error(
            "Offer handling error:",
            error
          );

          setStatus(
            "Connection error"
          );

          setError(
            "Unable to connect to the live stream."
          );
        }
      };

    /*
     * -------------------------------------------------------
     * ICE CANDIDATE
     * -------------------------------------------------------
     */
    const handleIceCandidate =
      async ({
        sender,
        candidate,
      }: IceCandidateData) => {
        console.log(
          "ICE candidate received from:",
          sender
        );

        /*
         * Ignore ICE from an old streamer.
         */
        if (
          streamerIdRef.current &&
          sender !==
            streamerIdRef.current
        ) {
          return;
        }

        const peer =
          peerRef.current;

        /*
         * Peer might not exist yet.
         */
        if (
          !peer
        ) {
          pendingIceRef.current.push(
            candidate
          );

          return;
        }

        /*
         * Remote description might not
         * exist yet.
         */
        if (
          !peer.remoteDescription
        ) {
          pendingIceRef.current.push(
            candidate
          );

          return;
        }

        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );
        } catch (error) {
          console.error(
            "ICE candidate error:",
            error
          );
        }
      };

    /*
     * -------------------------------------------------------
     * STREAM STOPPED
     * -------------------------------------------------------
     */
    const handleStreamStopped =
      () => {
        console.log(
          "Stream stopped."
        );

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            null;
        }

        if (
          peerRef.current
        ) {
          try {
            peerRef.current.close();
          } catch {
            // Ignore.
          }

          peerRef.current =
            null;
        }

        streamerIdRef.current =
          null;

        pendingIceRef.current =
          [];

        remoteStreamRef.current =
          null;

        setHasVideo(
          false
        );

        setStatus(
          "Waiting for streamer"
        );

        setError("");
      };

    /*
     * -------------------------------------------------------
     * ROOM ERROR
     * -------------------------------------------------------
     */
    const handleRoomError =
      (data: {
        message?: string;
      }) => {
        console.error(
          "Room error:",
          data
        );

        setStatus(
          "Connection error"
        );

        setError(
          data?.message ||
            "Unable to join the stream room."
        );
      };

    /*
     * -------------------------------------------------------
     * SOCKET DISCONNECT
     * -------------------------------------------------------
     */
    const handleDisconnect =
      () => {
        console.log(
          "Viewer socket disconnected."
        );

        setStatus(
          "Connection lost"
        );
      };

    /*
     * Register.
     */
    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "room-joined",
      handleRoomJoined
    );

    socket.on(
      "streamer-present",
      handleStreamerPresent
    );

    socket.on(
      "stream-started",
      handleStreamStarted
    );

    socket.on(
      "offer",
      handleOffer
    );

    socket.on(
      "ice-candidate",
      handleIceCandidate
    );

    socket.on(
      "stream-stopped",
      handleStreamStopped
    );

    socket.on(
      "room-error",
      handleRoomError
    );

    /*
     * Already connected?
     */
    if (
      socket.connected
    ) {
      handleConnect();
    }

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     */
    return () => {
      mountedRef.current =
        false;

      socket.emit(
        "leave-room"
      );

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "room-joined",
        handleRoomJoined
      );

      socket.off(
        "streamer-present",
        handleStreamerPresent
      );

      socket.off(
        "stream-started",
        handleStreamStarted
      );

      socket.off(
        "offer",
        handleOffer
      );

      socket.off(
        "ice-candidate",
        handleIceCandidate
      );

      socket.off(
        "stream-stopped",
        handleStreamStopped
      );

      socket.off(
        "room-error",
        handleRoomError
      );

      if (
        peerRef.current
      ) {
        try {
          peerRef.current.close();
        } catch {
          // Ignore.
        }

        peerRef.current =
          null;
      }

      pendingIceRef.current =
        [];

      streamerIdRef.current =
        null;

      remoteStreamRef.current =
        null;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }
    };
  }, [roomId]);

  const toggleMute = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.muted || video.volume === 0) {
      const nextVolume =
        previousVolumeRef.current > 0
          ? previousVolumeRef.current
          : 1;

      video.volume = nextVolume;
      video.muted = false;
      setVolume(nextVolume);
      setIsMuted(false);
      return;
    }

    previousVolumeRef.current = video.volume;
    video.muted = true;
    setIsMuted(true);
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = value;
    video.muted = value === 0;

    if (value > 0) {
      previousVolumeRef.current = value;
    }

    setVolume(value);
    setIsMuted(value === 0);
  };

  const toggleFullscreen = async () => {
    const player = watchVideoRef.current;

    if (!player) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await player.requestFullscreen();
    } catch {
      // Fullscreen is not available in this browser.
    }
  };



  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <div className="watch-page">
      <AppNavbar />

      <main className="watch-main">
        <section className="watch-card">
          <div
            ref={watchVideoRef}
            className="watch-video"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="watch-live-badge">
              LIVE
            </div>

            <div className="watch-video-top-right">
              <div className="watch-stream-name">
                <span>STREAM NAME</span>
                <strong>{roomId}</strong>
              </div>

            </div>

            {isChatVisible && (
              <LiveChat
                roomId={roomId}
                userName={displayName}
                role="viewer"
                onHide={() => setIsChatVisible(false)}
              />
            )}

            {!hasVideo && (
              <div className="watch-placeholder">
                <div className="watch-avatar">
                  W
                </div>

                <span>
                  {error ||
                    status}
                </span>
              </div>
            )}

            <div className="watch-video-controls">
              <button
                type="button"
                onClick={() => navigate("/")}
              >
                Back to Voxbridge AI
              </button>
            </div>

            <div className="watch-player-controls">
              {!isChatVisible && (
                <button
                  type="button"
                  className="watch-chat-show-button"
                  onClick={() => setIsChatVisible(true)}
                >
                  Show Chat
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const video = videoRef.current;

                  if (!video) {
                    return;
                  }

                  if (video.paused) {
                    video.play().catch(() => {});
                  } else {
                    video.pause();
                  }
                }}
                disabled={!hasVideo}
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
              </button>

              <div className="watch-volume-control">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!hasVideo}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={20} strokeWidth={2} /> : <Volume2 size={20} strokeWidth={2} />}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(event) =>
                    handleVolumeChange(Number(event.target.value))
                  }
                  disabled={!hasVideo}
                  aria-label="Volume"
                  title="Volume"
                />
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                disabled={!hasVideo}
                aria-label="Fullscreen"
                title="Fullscreen"
              >
                <Maximize size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}