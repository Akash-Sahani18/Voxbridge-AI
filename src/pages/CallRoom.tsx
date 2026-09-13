import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getSocket,
  connectSocket,
  disconnectSocket,
} from "../services/socket";

import {
  createPeerConnection,
  getLocalMedia,
  getScreenMedia,
  setCamera,
  setMicrophone,
  stopLocalMedia,
  addLocalTracks,
} from "../services/webrtc";

import {
  speechRecognition,
  type SpeechLanguage,
} from "../services/transcription";


import "../styles/CallRoom.css";

import CallVideos from "./CallVideos";
import CallControls from "./CallControls";
import CallSidebar from "./CallSidebar";
import type { Caption, Translation, MeetingSummary, OfferData, AnswerData, IceCandidateData } from "../types";

/* =========================================================
   TYPES
   ========================================================= */

/* =========================================================
   COMPONENT
   ========================================================= */

export default function CallRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const actualRoom = roomId
    ? decodeURIComponent(roomId)
    : "";

  /* =======================================================
     STATE
     ======================================================= */

  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState<
    "connecting" |
    "connected" |
    "disconnected" |
    "error"
  >("connecting");

  const [
    cameraEnabled,
    setCameraEnabled,
  ] = useState(true);

  const [
    microphoneEnabled,
    setMicrophoneEnabled,
  ] = useState(true);

  const [
    screenSharing,
    setScreenSharing,
  ] = useState(false);

  const [
    remoteParticipants,
    setRemoteParticipants,
  ] = useState<Record<string, MediaStream | null>>({});

  const [
    captionsEnabled,
    setCaptionsEnabled,
  ] = useState(false);

  const [
    captionText,
    setCaptionText,
  ] = useState("");

  const [
    speakerCaptions,
    setSpeakerCaptions,
  ] = useState<Record<string, string>>({});

  const [
    sidebarVisible,
    setSidebarVisible,
  ] = useState(true);

  const [
    localSpeaking,
    setLocalSpeaking,
  ] = useState(false);


  const [
    transcript,
    setTranscript,
  ] = useState<Caption[]>([]);

  const [
    translations,
    setTranslations,
  ] = useState<Translation[]>([]);

  const [
    speechLanguage,
    setSpeechLanguage,
  ] = useState<SpeechLanguage>(
    "en-US"
  );

  const [
    translationEnabled,
    setTranslationEnabled,
  ] = useState(false);

  const [
    translationTargetLanguage,
    setTranslationTargetLanguage,
  ] = useState<SpeechLanguage>(
    "en-US"
  );

  const [
    mediaError,
    setMediaError,
  ] = useState("");

  const [
    aiSummary,
    setAiSummary,
  ] = useState<MeetingSummary | null>(null);

  const [
    summaryGenerating,
    setSummaryGenerating,
  ] = useState(false);

  /* =======================================================
     REFS
     ======================================================= */

  const localVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const screenStreamRef =
    useRef<MediaStream | null>(null);

  const peerConnectionsRef =
    useRef<Map<string, RTCPeerConnection>>(new Map());

  const pendingIceCandidatesRef =
    useRef<Map<string, RTCIceCandidateInit[]>>(new Map());


  const mountedRef =
    useRef(true);

  const lastCaptionRef =
    useRef("");

  /*
   * Prevent duplicate offers per participant.
   */
  const offerStartedRef =
    useRef<Set<string>>(new Set());

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const localAnalyserRef =
    useRef<AnalyserNode | null>(null);

  const localAudioSourceRef =
    useRef<MediaStreamAudioSourceNode | null>(null);

  const audioAnimationFrameRef =
    useRef<number | null>(null);

  const localSpeakingRef =
    useRef(false);

  const localSilentSinceRef =
    useRef<number | null>(null);

  /*
   * Keep the latest caption/translation settings available
   * inside long-lived callbacks without restarting socket
   * or WebRTC effects.
   */
  const translationEnabledRef =
    useRef(translationEnabled);

  const speechLanguageRef =
    useRef<SpeechLanguage>(speechLanguage);

  const translationTargetLanguageRef =
    useRef<SpeechLanguage>(
      translationTargetLanguage
    );

  useEffect(() => {
    translationEnabledRef.current =
      translationEnabled;
  }, [translationEnabled]);

  useEffect(() => {
    speechLanguageRef.current =
      speechLanguage;
  }, [speechLanguage]);

  useEffect(() => {
    translationTargetLanguageRef.current =
      translationTargetLanguage;
  }, [translationTargetLanguage]);

  /* =======================================================
     ACTIVE SPEAKER DETECTION
     ======================================================= */

  const updateSpeakingState = useCallback(
    (
      level: number,
      speakingRef: MutableRefObject<boolean>,
      silentSinceRef: MutableRefObject<number | null>,
      setSpeaking: Dispatch<SetStateAction<boolean>>
    ) => {
      const now = performance.now();
      const startThreshold = 0.045;
      const stopThreshold = 0.025;
      const silenceDuration = 280;

      if (speakingRef.current) {
        if (level <= stopThreshold) {
          if (silentSinceRef.current === null) {
            silentSinceRef.current = now;
          }

          if (now - silentSinceRef.current >= silenceDuration) {
            speakingRef.current = false;
            silentSinceRef.current = null;
            setSpeaking(false);
          }
        } else {
          silentSinceRef.current = null;
        }

        return;
      }

      if (level >= startThreshold) {
        speakingRef.current = true;
        silentSinceRef.current = null;
        setSpeaking(true);
      }
    },
    []
  );

  const setupLocalAudioAnalyser = useCallback(
    (stream: MediaStream) => {
      if (!stream.getAudioTracks().length) {
        return;
      }

      let context = audioContextRef.current;

      if (!context) {
        context = new AudioContext();
        audioContextRef.current = context;
      }

      if (context.state === "suspended") {
        void context.resume().catch(() => {});
      }

      try {
        localAudioSourceRef.current?.disconnect();
        localAnalyserRef.current?.disconnect();
      } catch {
        // Ignore stale audio nodes.
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      localAudioSourceRef.current = source;
      localAnalyserRef.current = analyser;
      localSilentSinceRef.current = null;

      if (audioAnimationFrameRef.current === null) {
        const data = new Uint8Array(analyser.fftSize);

        const getRms = (
          target: AnalyserNode,
          targetData: Uint8Array<ArrayBuffer>
        ) => {
          target.getByteTimeDomainData(targetData);
          let sum = 0;

          for (const value of targetData) {
            const normalized = (value - 128) / 128;
            sum += normalized * normalized;
          }

          return Math.sqrt(sum / targetData.length);
        };

        const monitor = () => {
          const localAnalyser = localAnalyserRef.current;

          if (localAnalyser) {
            updateSpeakingState(
              getRms(localAnalyser, data),
              localSpeakingRef,
              localSilentSinceRef,
              setLocalSpeaking
            );
          }

          audioAnimationFrameRef.current =
            window.requestAnimationFrame(monitor);
        };

        audioAnimationFrameRef.current =
          window.requestAnimationFrame(monitor);
      }
    },
    [updateSpeakingState]
  );

  const clearAudioAnalyser = useCallback(
    () => {
      try {
        localAudioSourceRef.current?.disconnect();
        localAnalyserRef.current?.disconnect();
      } catch {
        // Ignore stale audio nodes.
      }

      localAudioSourceRef.current = null;
      localAnalyserRef.current = null;
      localSpeakingRef.current = false;
      localSilentSinceRef.current = null;
      setLocalSpeaking(false);

      if (audioAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(
          audioAnimationFrameRef.current
        );
        audioAnimationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    },
    []
  );

  /* =======================================================
     CREATE PEER CONNECTION
     ======================================================= */

  const createPeer = useCallback(
    (
      remoteSocketId: string
    ): RTCPeerConnection | null => {
      const socket = getSocket();

      if (!socket) {
        console.error(
          "Socket is not available."
        );

        return null;
      }

      const existingPeer =
        peerConnectionsRef.current.get(
          remoteSocketId
        );

      if (existingPeer) {
        return existingPeer;
      }

      const peer =
        createPeerConnection(
          (candidate) => {
            if (
              !socket.connected ||
              !remoteSocketId
            ) {
              return;
            }

            socket.emit(
              "ice-candidate",
              {
                target: remoteSocketId,
                candidate,
              }
            );
          },

          (remoteStream) => {
            console.log(
              "Remote stream received:",
              remoteSocketId
            );

            if (!mountedRef.current) {
              return;
            }

            setRemoteParticipants((previous) => ({
              ...previous,
              [remoteSocketId]: remoteStream,
            }));
          }
        );

      peerConnectionsRef.current.set(
        remoteSocketId,
        peer
      );

      if (localStreamRef.current) {
        addLocalTracks(
          peer,
          localStreamRef.current
        );
      }

      return peer;
    },
    []
  );

  /* =======================================================
     CLOSE PEER CONNECTION
     ======================================================= */

  const closePeer = useCallback(
    (remoteSocketId: string) => {
      const peer =
        peerConnectionsRef.current.get(
          remoteSocketId
        );

      if (peer) {
        try {
          peer.close();
        } catch {
          // Ignore.
        }
      }

      peerConnectionsRef.current.delete(
        remoteSocketId
      );
      pendingIceCandidatesRef.current.delete(
        remoteSocketId
      );
      offerStartedRef.current.delete(
        remoteSocketId
      );
    },
    []
  );

  const closeAllPeers = useCallback(() => {
    for (const peer of peerConnectionsRef.current.values()) {
      try {
        peer.close();
      } catch {
        // Ignore.
      }
    }

    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    offerStartedRef.current.clear();
  }, []);

  /* =======================================================
     CREATE OFFER
     ======================================================= */

  const createOffer = useCallback(
    async (
      remoteSocketId: string
    ) => {
      const socket = getSocket();

      if (
        !socket ||
        !socket.connected ||
        !localStreamRef.current
      ) {
        return;
      }

      if (
        offerStartedRef.current.has(
          remoteSocketId
        )
      ) {
        console.log(
          "Offer already started for:",
          remoteSocketId
        );

        return;
      }

      offerStartedRef.current.add(
        remoteSocketId
      );

      const peer =
        createPeer(remoteSocketId);

      if (!peer) {
        offerStartedRef.current.delete(
          remoteSocketId
        );

        return;
      }

      try {
        console.log(
          "Creating offer for:",
          remoteSocketId
        );

        const offer =
          await peer.createOffer();

        await peer.setLocalDescription(
          offer
        );

        socket.emit(
          "offer",
          {
            target: remoteSocketId,
            offer: peer.localDescription,
          }
        );

        console.log(
          "Offer sent to:",
          remoteSocketId
        );
      } catch (error) {
        console.error(
          "Offer creation failed:",
          error
        );

        offerStartedRef.current.delete(
          remoteSocketId
        );
        closePeer(remoteSocketId);
      }
    },
    [closePeer, createPeer]
  );

  /* =======================================================
     INITIALIZE CAMERA + MICROPHONE
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const initializeMedia =
      async () => {
        try {
          setMediaError("");

          console.log(
            "Requesting camera and microphone..."
          );

          const stream =
            await getLocalMedia();

          if (cancelled) {
            stopLocalMedia(
              stream
            );

            return;
          }

          localStreamRef.current =
            stream;

          setupLocalAudioAnalyser(
            stream
          );

          if (
            localVideoRef.current
          ) {
            localVideoRef.current.srcObject =
              stream;

            localVideoRef.current
              .play()
              .catch(() => {
                // Ignore autoplay errors.
              });
          }

          setCameraEnabled(true);
          setMicrophoneEnabled(true);

          console.log(
            "Camera and microphone ready."
          );
        } catch (error) {
          console.error(
            "Media initialization failed:",
            error
          );

          if (!cancelled) {
            setMediaError(
              "Camera or microphone permission was denied."
            );
          }
        }
      };

    initializeMedia();

    return (
) => {
      cancelled = true;
    };
  }, [setupLocalAudioAnalyser]);

  /* =======================================================
     SOCKET + WEBRTC SIGNALING
     ======================================================= */

  useEffect(() => {
    mountedRef.current = true;

    if (!actualRoom) {
      setConnectionStatus(
        "error"
      );

      setMediaError(
        "Invalid room name."
      );

      return;
    }

    const socket =
      connectSocket();

    /* =====================================================
       CONNECT
       ===================================================== */

    const handleConnect =
      () => {
        console.log(
          "Connected to signaling server:",
          socket.id
        );

        if (!mountedRef.current) {
          return;
        }

        setConnectionStatus(
          "connected"
        );

        /*
         * Reset offer state for this connection.
         */
        offerStartedRef.current.clear();

        /*
         * Join the requested room.
         */
        socket.emit(
          "join-room",
          actualRoom
        );

        socket.emit(
          "translation-preference",
          {
            enabled: translationEnabledRef.current,
            targetLanguage:
              translationTargetLanguageRef.current,
          }
        );

        console.log(
          "Joined room:",
          actualRoom
        );
      };

    /* =====================================================
       DISCONNECT
       ===================================================== */

    const handleDisconnect =
      (reason: string) => {
        console.log(
          "Socket disconnected:",
          reason
        );

        if (!mountedRef.current) {
          return;
        }

        setConnectionStatus(
          "disconnected"
        );

        closeAllPeers();
        setRemoteParticipants({});
      };

    /* =====================================================
       CONNECTION ERROR
       ===================================================== */

    const handleConnectError =
      (error: Error) => {
        console.error(
          "Socket connection error:",
          error
        );

        if (!mountedRef.current) {
          return;
        }

        setConnectionStatus(
          "error"
        );
      };

    /* =====================================================
       EXISTING PARTICIPANTS
       ===================================================== */

    const handleRoomUsers =
      (
        users:
          | string[]
          | {
              users?: string[];
            }
      ) => {
        console.log(
          "Existing participants:",
          users
        );

        const participantIds =
          Array.isArray(users)
            ? users
            : users?.users ?? [];

        const otherUsers =
          participantIds.filter(
            (id) => id !== socket.id
          );

        setRemoteParticipants((previous) => {
          const next: Record<string, MediaStream | null> = {};

          for (const id of otherUsers) {
            next[id] = previous[id] ?? null;
          }

          return next;
        });

        if (otherUsers.length === 0) {
          console.log(
            "I am the first participant in this room."
          );
          return;
        }

        const startOffers = () => {
          for (const remoteId of otherUsers) {
            void createOffer(remoteId);
          }
        };

        if (localStreamRef.current) {
          startOffers();
          return;
        }

        let attempts = 0;
        const waitForMedia =
          window.setInterval(() => {
            attempts++;

            if (localStreamRef.current) {
              window.clearInterval(waitForMedia);
              startOffers();
            }

            if (attempts >= 100) {
              window.clearInterval(waitForMedia);
              console.warn(
                "Timed out waiting for local media."
              );
            }
          }, 100);
      };

    /* =====================================================
       NEW PARTICIPANT
       ===================================================== */

    const handleUserJoined =
      (socketId: string) => {
        console.log(
          "New participant joined:",
          socketId
        );

        if (socketId === socket.id) {
          return;
        }

        setRemoteParticipants((previous) => ({
          ...previous,
          [socketId]: previous[socketId] ?? null,
        }));
      };

    /* =====================================================
       OFFER
       ===================================================== */

    const handleOffer =
      async ({
        sender,
        offer,
      }: OfferData) => {
        console.log(
          "Offer received from:",
          sender
        );

        setRemoteParticipants((previous) => ({
          ...previous,
          [sender]: previous[sender] ?? null,
        }));

        const peer =
          createPeer(sender);

        if (!peer) {
          return;
        }

        try {
          await peer.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          const pending =
            pendingIceCandidatesRef.current.get(
              sender
            ) ?? [];

          pendingIceCandidatesRef.current.delete(
            sender
          );

          for (const candidate of pending) {
            try {
              await peer.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (error) {
              console.error(
                "Pending ICE candidate error:",
                error
              );
            }
          }

          const answer =
            await peer.createAnswer();

          await peer.setLocalDescription(
            answer
          );

          const currentSocket = getSocket();

          if (
            !currentSocket ||
            !currentSocket.connected
          ) {
            return;
          }

          currentSocket.emit(
            "answer",
            {
              target: sender,
              answer: peer.localDescription,
            }
          );

          console.log(
            "Answer sent to:",
            sender
          );
        } catch (error) {
          console.error(
            "Offer handling failed:",
            error
          );
        }
      };

    /* =====================================================
       ANSWER
       ===================================================== */

    const handleAnswer =
      async ({
        sender,
        answer,
      }: AnswerData) => {
        console.log(
          "Answer received from:",
          sender
        );

        const peer =
          peerConnectionsRef.current.get(
            sender
          );

        if (!peer) {
          console.warn(
            "No peer connection for answer:",
            sender
          );
          return;
        }

        if (
          peer.signalingState !==
          "have-local-offer"
        ) {
          console.warn(
            "Ignoring answer. Current signaling state:",
            peer.signalingState
          );
          return;
        }

        try {
          await peer.setRemoteDescription(
            new RTCSessionDescription(answer)
          );

          const pending =
            pendingIceCandidatesRef.current.get(
              sender
            ) ?? [];

          pendingIceCandidatesRef.current.delete(
            sender
          );

          for (const candidate of pending) {
            try {
              await peer.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (error) {
              console.error(
                "Pending ICE candidate error:",
                error
              );
            }
          }

          console.log(
            "Remote answer applied:",
            sender
          );
        } catch (error) {
          console.error(
            "Answer handling failed:",
            error
          );
        }
      };

    /* =====================================================
       ICE CANDIDATE
       ===================================================== */

    const handleIceCandidate =
      async ({
        sender,
        candidate,
      }: IceCandidateData) => {
        console.log(
          "ICE candidate received from:",
          sender
        );

        const peer =
          peerConnectionsRef.current.get(
            sender
          );

        if (!peer) {
          const pending =
            pendingIceCandidatesRef.current.get(
              sender
            ) ?? [];

          pending.push(candidate);

          pendingIceCandidatesRef.current.set(
            sender,
            pending
          );

          return;
        }

        if (!peer.remoteDescription) {
          const pending =
            pendingIceCandidatesRef.current.get(
              sender
            ) ?? [];

          pending.push(candidate);

          pendingIceCandidatesRef.current.set(
            sender,
            pending
          );

          console.log(
            "ICE candidate queued:",
            sender
          );

          return;
        }

        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error(
            "ICE candidate error:",
            error
          );
        }
      };

    /* =====================================================
       USER LEFT
       ===================================================== */

    const handleUserLeft =
      (socketId: string) => {
        console.log(
          "Participant left:",
          socketId
        );

        closePeer(socketId);

        setRemoteParticipants((previous) => {
          if (!(socketId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[socketId];
          return next;
        });

        setSpeakerCaptions((previous) => {
          if (!previous[socketId]) {
            return previous;
          }

          const next = { ...previous };
          delete next[socketId];
          return next;
        });

        setTranslations((previous) =>
          previous.filter(
            (item) => item.sender !== socketId
          )
        );
      };

    /* =====================================================
       CAPTION RECEIVED
       ===================================================== */

    const handleCaption =
      (
        caption: Caption
      ) => {
        if (
          !caption ||
          !caption.text
        ) {
          return;
        }

        if (
          !mountedRef.current
        ) {
          return;
        }

        console.log(
          "Caption received:",
          caption
        );

        setSpeakerCaptions((previous) => ({
          ...previous,
          [caption.sender]: caption.text,
        }));

        if (caption.sender === socket.id) {
          setCaptionText(caption.text);
        }

        setTranscript(
          (previous) => {
            if (
              previous.some(
                (item) =>
                  item.id ===
                  caption.id
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              caption,
            ].slice(-100);
          }
        );
      };

    /* =====================================================
       TRANSLATION RECEIVED
       ===================================================== */

    const handleTranslation =
      (
        translation: Translation
      ) => {
        if (
          !translation ||
          !translation.translatedText
        ) {
          return;
        }

        if (
          !mountedRef.current
        ) {
          return;
        }

        console.log(
          "Translation received:",
          translation
        );

        setTranslations(
          (previous) => {
            if (
              previous.some(
                (item) =>
                  item.id ===
                  translation.id
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              translation,
            ].slice(-100);
          }
        );
      };

    const handleAISummary =
      (summary: MeetingSummary) => {
        if (!mountedRef.current || !summary) {
          return;
        }

        setAiSummary(summary);
        setSummaryGenerating(false);
      };

    const handleAISummaryError =
      (data: { message?: string }) => {
        console.error(
          "AI summary error:",
          data?.message || "AI summary generation failed."
        );
        setSummaryGenerating(false);
      };

    const handleRoomTranscript =
      (items: Caption[]) => {
        if (!mountedRef.current || !Array.isArray(items)) {
          return;
        }

        setTranscript(items.slice(-100));
      };

    const handleTranslationError =
      (data: { message?: string }) => {
        const message =
          data?.message || "Translation failed.";

        console.error(
          "[TRANSLATION] Server error:",
          message
        );

        if (mountedRef.current) {
          console.warn(message);
        }
      };

    /* =====================================================
       CLEAR CAPTIONS
       ===================================================== */

    const handleCaptionsCleared =
      () => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setTranscript([]);
        setTranslations([]);
        setCaptionText("");
        setSpeakerCaptions({});
        setAiSummary(null);
      };

    /* =====================================================
       REGISTER SOCKET EVENTS
       ===================================================== */

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    socket.on(
      "room-users",
      handleRoomUsers
    );

    socket.on(
      "user-joined",
      handleUserJoined
    );

    socket.on(
      "offer",
      handleOffer
    );

    socket.on(
      "answer",
      handleAnswer
    );

    socket.on(
      "ice-candidate",
      handleIceCandidate
    );

    socket.on(
      "user-left",
      handleUserLeft
    );

    socket.on(
      "caption",
      handleCaption
    );

    socket.on(
      "translation",
      handleTranslation
    );

    socket.on(
      "translation-error",
      handleTranslationError
    );

    socket.on(
      "room-transcript",
      handleRoomTranscript
    );

    socket.on(
      "ai-summary",
      handleAISummary
    );

    socket.on(
      "ai-summary-error",
      handleAISummaryError
    );

    socket.on(
      "captions-cleared",
      handleCaptionsCleared
    );

    /*
     * Socket may already be connected.
     */
    if (socket.connected) {
      handleConnect();
    }

    /* =====================================================
       CLEANUP SOCKET LISTENERS
       ===================================================== */

    return () => {
      mountedRef.current =
        false;

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.off(
        "room-users",
        handleRoomUsers
      );

      socket.off(
        "user-joined",
        handleUserJoined
      );

      socket.off(
        "offer",
        handleOffer
      );

      socket.off(
        "answer",
        handleAnswer
      );

      socket.off(
        "ice-candidate",
        handleIceCandidate
      );

      socket.off(
        "user-left",
        handleUserLeft
      );

      socket.off(
        "caption",
        handleCaption
      );

      socket.off(
        "translation",
        handleTranslation
      );

      socket.off(
        "translation-error",
        handleTranslationError
      );

      socket.off(
        "room-transcript",
        handleRoomTranscript
      );

      socket.off(
        "ai-summary",
        handleAISummary
      );

      socket.off(
        "ai-summary-error",
        handleAISummaryError
      );

      socket.off(
        "captions-cleared",
        handleCaptionsCleared
      );
    };
  }, [
    actualRoom,
    clearAudioAnalyser,
    closeAllPeers,
    closePeer,
    createOffer,
    createPeer,
  ]);

  /* =======================================================
     CAMERA
     ======================================================= */

  const toggleCamera =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const next =
        !cameraEnabled;

      setCamera(
        stream,
        next
      );

      setCameraEnabled(
        next
      );
    };

  /* =======================================================
     MICROPHONE
     ======================================================= */

  const toggleMicrophone =
    () => {
      const stream =
        localStreamRef.current;

      if (!stream) {
        return;
      }

      const next =
        !microphoneEnabled;

      setMicrophone(
        stream,
        next
      );

      setMicrophoneEnabled(
        next
      );
    };

  /* =======================================================
     SCREEN SHARE
     ======================================================= */

  const toggleScreenShare =
    async () => {
      const cameraStream =
        localStreamRef.current;

      if (!cameraStream) {
        return;
      }

      /*
       * STOP SCREEN SHARE
       */
      if (screenSharing) {
        if (
          screenStreamRef.current
        ) {
          stopLocalMedia(
            screenStreamRef.current
          );

          screenStreamRef.current =
            null;
        }

        const cameraTrack =
          cameraStream
            .getVideoTracks()[0];

        if (cameraTrack) {
          const replacements: Promise<void>[] = [];

          for (const peer of peerConnectionsRef.current.values()) {
            const sender =
              peer
                .getSenders()
                .find(
                  (item) =>
                    item.track?.kind ===
                    "video"
                );

            if (sender) {
              replacements.push(
                sender.replaceTrack(cameraTrack)
              );
            }
          }

          await Promise.all(replacements);
        }

        if (
          localVideoRef.current
        ) {
          localVideoRef.current.srcObject =
            cameraStream;

          localVideoRef.current
            .play()
            .catch(() => {});
        }

        setScreenSharing(
          false
        );

        return;
      }

      /*
       * START SCREEN SHARE
       */
      try {
        const screenStream =
          await getScreenMedia();

        screenStreamRef.current =
          screenStream;

        const screenTrack =
          screenStream
            .getVideoTracks()[0];

        if (screenTrack) {
          const replacements: Promise<void>[] = [];

          for (const peer of peerConnectionsRef.current.values()) {
            const sender =
              peer
                .getSenders()
                .find(
                  (item) =>
                    item.track?.kind ===
                    "video"
                );

            if (sender) {
              replacements.push(
                sender.replaceTrack(screenTrack)
              );
            }
          }

          await Promise.all(replacements);
        }

        if (
          localVideoRef.current
        ) {
          localVideoRef.current.srcObject =
            screenStream;

          localVideoRef.current
            .play()
            .catch(() => {});
        }

        setScreenSharing(
          true
        );

        /*
         * Browser share button can stop
         * screen sharing independently.
         */
        screenTrack.onended =
          () => {
            if (
              mountedRef.current
            ) {
              void toggleScreenShare();
            }
          };
      } catch (error) {
        console.error(
          "Screen sharing failed:",
          error
        );
      }
    };

  /* =======================================================
     TRANSLATION
     ======================================================= */

  const translateCaption =
    (
      text: string,
      language: SpeechLanguage,
      socket: ReturnType<typeof getSocket>,
      captionId: string
    ) => {
      const cleanText = text.trim();

      if (!cleanText) {
        return;
      }

      if (!socket || !socket.connected) {
        console.warn(
          "[TRANSLATION] Request skipped because Socket.IO is not connected."
        );
        return;
      }

      console.log(
        "[TRANSLATION] Request sent:",
        {
          roomId: actualRoom,
          captionId,
          sourceLanguage: language,
          text: cleanText,
        }
      );

      socket.emit(
        "translate-caption",
        {
          roomId: actualRoom,
          captionId,
          text: cleanText,
          sourceLanguage: language,
        }
      );
    };

  /* =======================================================
     START CAPTIONS
     ======================================================= */

  const startCaptions =
    () => {
      console.log(
        "Starting captions:",
        speechLanguage
      );

      const socket =
        getSocket();

      if (!socket) {
        return;
      }

      speechRecognition.start(
        speechLanguageRef.current,
        {
          onInterim: (
            text
          ) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setCaptionText(text);
            const currentSocketId = socket.id;
            if (currentSocketId) {
              setSpeakerCaptions((previous) => ({
                ...previous,
                [currentSocketId]: text,
              }));
            }
          },

          onFinal: (
            text
          ) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            const cleanText =
              text
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();

            if (!cleanText) {
              return;
            }

            if (
              cleanText ===
              lastCaptionRef.current
            ) {
              return;
            }

            lastCaptionRef.current =
              cleanText;

            setCaptionText(cleanText);
            const currentSocketId = socket.id;
            if (currentSocketId) {
              setSpeakerCaptions((previous) => ({
                ...previous,
                [currentSocketId]: cleanText,
              }));
            }

            const activeLanguage =
              speechLanguageRef.current;

            const captionId =
              `${socket.id}-${Date.now()}`;

            console.log(
              "[CAPTION] Final caption:",
              {
                captionId,
                language: activeLanguage,
                text: cleanText,
              }
            );

            socket.emit(
              "caption",
              {
                roomId: actualRoom,
                captionId,
                text: cleanText,
                language: activeLanguage,
              }
            );

            translateCaption(
              cleanText,
              activeLanguage,
              socket,
              captionId
            );
          },

          onStart: () => {
            if (
              mountedRef.current
            ) {
              setCaptionsEnabled(
                true
              );
            }
          },

          onEnd: () => {
            /*
             * speechRecognition service
             * controls restarting.
             */
          },

          onError: (
            error
          ) => {
            console.error(
              "Speech recognition error:",
              error
            );

            if (
              mountedRef.current
            ) {
              setCaptionText(
                error
              );
            }
          },
        }
      );

      setCaptionsEnabled(
        true
      );
    };

  /* =======================================================
     STOP CAPTIONS
     ======================================================= */

  const stopCaptions =
    () => {
      console.log(
        "Stopping captions."
      );

      speechRecognition.stop();

      setCaptionsEnabled(
        false
      );

      setCaptionText("");

      lastCaptionRef.current =
        "";
    };

  /* =======================================================
     TOGGLE CAPTIONS
     ======================================================= */

  const toggleCaptions =
    () => {
      if (
        captionsEnabled
      ) {
        stopCaptions();
      } else {
        startCaptions();
      }
    };

  /* =======================================================
     AUTO-START CAPTIONS
     ======================================================= */

  useEffect(() => {
    if (
      connectionStatus === "connected" &&
      !captionsEnabled
    ) {
      startCaptions();
    }
  }, [connectionStatus]);

  /* =======================================================
     CHANGE LANGUAGE
     ======================================================= */

  const changeSpeechLanguage =
    (
      language: SpeechLanguage
    ) => {
      speechLanguageRef.current =
        language;

      setSpeechLanguage(
        language
      );

      if (
        captionsEnabled
      ) {
        speechRecognition.setLanguage(
          language
        );
      }
    };

  /* =======================================================
     TRANSLATION LANGUAGE
     ======================================================= */

  const changeTranslationTargetLanguage =
    (language: SpeechLanguage) => {
      translationTargetLanguageRef.current =
        language;

      setTranslationTargetLanguage(
        language
      );

      const socket = getSocket();

      if (socket?.connected) {
        socket.emit(
          "translation-preference",
          {
            enabled:
              translationEnabledRef.current,
            targetLanguage: language,
          }
        );
      }

      setTranslations([]);
    };

  /* =======================================================
     TRANSLATION TOGGLE
     ======================================================= */

  const toggleTranslation =
    () => {
      /*
       * Translation is a participant preference.
       * Captions are produced by each speaker and the server
       * routes translations only to participants who enabled them.
       */
      setTranslationEnabled(
        (previous) => {
          const next = !previous;
          translationEnabledRef.current = next;

          const socket = getSocket();
          if (socket?.connected) {
            socket.emit(
              "translation-preference",
              {
                enabled: next,
                targetLanguage:
                  translationTargetLanguageRef.current,
              }
            );
          }

          if (!next) {
            setTranslations([]);
          }

          return next;
        }
      );
    };

  const generateAISummary =
    () => {
      const socket = getSocket();

      if (!socket?.connected) {
        console.error(
          "Cannot generate AI summary: socket is not connected."
        );
        return;
      }

      if (transcript.length === 0) {
        return;
      }

      setSummaryGenerating(true);
      socket.emit(
        "generate-ai-summary",
        actualRoom
      );
    };

  /* =======================================================
     CLEAR TRANSCRIPT
     ======================================================= */

  const clearTranscript =
    () => {
      const socket =
        getSocket();

      setTranscript([]);
      setTranslations([]);
      setCaptionText("");
      setSpeakerCaptions({});

      if (
        socket?.connected
      ) {
        socket.emit(
          "clear-captions",
          actualRoom
        );
      }
    };

  /* =======================================================
     LEAVE CALL
     ======================================================= */

  const leaveCall =
    () => {
      console.log(
        "Leaving call..."
      );

      speechRecognition.stop();

      try {
        const socket =
          getSocket();

        if (
          socket?.connected
        ) {
          socket.emit(
            "leave-room"
          );
        }
      } catch {
        // Ignore.
      }

      closeAllPeers();

      clearAudioAnalyser();

      stopLocalMedia(
        localStreamRef.current
      );

      stopLocalMedia(
        screenStreamRef.current
      );

      localStreamRef.current =
        null;

      screenStreamRef.current =
        null;

      if (
        localVideoRef.current
      ) {
        localVideoRef.current.srcObject =
          null;
      }

      setRemoteParticipants({});

      disconnectSocket();

      navigate("/");
    };

  /* =======================================================
     FINAL CLEANUP
     ======================================================= */

  useEffect(() => {
    return () => {
      mountedRef.current =
        false;

      speechRecognition.stop();

      closeAllPeers();

      clearAudioAnalyser();

      stopLocalMedia(
        localStreamRef.current
      );

      stopLocalMedia(
        screenStreamRef.current
      );

      localStreamRef.current =
        null;

      screenStreamRef.current =
        null;

      setRemoteParticipants({});
    };
  }, [clearAudioAnalyser, closeAllPeers]);


  /* =======================================================
     UI
     ======================================================= */

  const localSocketId = getSocket()?.id;

  const remoteParticipantList =
    Object.entries(remoteParticipants).map(
      ([id, stream]) => {
        const latestTranslation =
          translations
            .filter(
              (item) =>
                item.sender === id &&
                item.translatedText
            )
            .slice(-1)[0];

        return {
          id,
          stream,
          caption: speakerCaptions[id] || "",
          translation:
            translationEnabled
              ? latestTranslation?.translatedText || ""
              : "",
        };
      }
    );

  return (
    <div className="call-room">

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="call-header">

        <div className="call-brand">
          Voxbridge
        </div>

        <div className="call-room-name">
          Room:
          <strong>
            {actualRoom}
          </strong>
        </div>

        <div
          className={`connection-status ${connectionStatus}`}
        >
          <span className="status-dot" />

          {connectionStatus ===
            "connected" &&
            "Connected"}

          {connectionStatus ===
            "connecting" &&
            "Connecting..."}

          {connectionStatus ===
            "disconnected" &&
            "Disconnected"}

          {connectionStatus ===
            "error" &&
            "Connection error"}
        </div>

      </header>

      {/* =================================================
          MAIN
          ================================================= */}

      <main className={`call-main ${sidebarVisible ? "sidebar-open" : "sidebar-closed"}`}>
        <CallVideos
          localVideoRef={localVideoRef}
          localStreamAvailable={Boolean(localStreamRef.current)}
          localSpeaking={localSpeaking}
          mediaError={mediaError}
          captionsEnabled={captionsEnabled}
          localCaptionText={
            localSocketId
              ? speakerCaptions[localSocketId] || captionText
              : captionText
          }
          translationEnabled={translationEnabled}
          participants={remoteParticipantList}
          audioContextRef={audioContextRef}
        />

        <CallSidebar
          transcript={transcript}
          onClearTranscript={clearTranscript}
          localSocketId={localSocketId}
          aiSummary={aiSummary}
          summaryGenerating={summaryGenerating}
          onGenerateSummary={generateAISummary}
          onVisibilityChange={setSidebarVisible}
        />
      </main>

      <CallControls
        microphoneEnabled={microphoneEnabled}
        cameraEnabled={cameraEnabled}
        screenSharing={screenSharing}
        captionsEnabled={captionsEnabled}
        translationEnabled={translationEnabled}
        speechLanguage={speechLanguage}
        translationTargetLanguage={translationTargetLanguage}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleCaptions={toggleCaptions}
        onToggleTranslation={toggleTranslation}
        onChangeSpeechLanguage={changeSpeechLanguage}
        onChangeTranslationTargetLanguage={changeTranslationTargetLanguage}
        onLeave={leaveCall}
      />

    </div>
  );
}
