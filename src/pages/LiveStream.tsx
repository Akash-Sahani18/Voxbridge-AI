import {
  useEffect,
  useRef,
  useState,
} from "react";


import {
  connectSocket,
} from "../services/socket";

import {
  Check,
  Copy,
  Link2,
  Maximize,
  Pause,
  Play,
  Radio,
  Share2,
} from "lucide-react";

import {
  getLocalMedia,
  getScreenMedia,
  stopLocalMedia,
} from "../services/webrtc";

import "../styles/LiveStream.css";
import AppNavbar from "../components/AppNavbar";
import LiveChat from "../components/LiveChat";
import { useAuth } from "../context/AuthContext";

interface ViewerPeer {
  peer: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
}

export default function LiveStream() {
  const { user } = useAuth();
  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const peerRef =
    useRef<Map<string, ViewerPeer>>(
      new Map()
    );

  const roomRef =
    useRef("");

  const streamingRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const previewStreamRef =
    useRef<MediaStream | null>(null);

  const previewVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const [roomName, setRoomName] =
    useState("");

  const [cameraDevices, setCameraDevices] =
    useState<MediaDeviceInfo[]>([]);

  const [microphoneDevices, setMicrophoneDevices] =
    useState<MediaDeviceInfo[]>([]);

  const [selectedCameraId, setSelectedCameraId] =
    useState("");

  const [selectedMicrophoneId, setSelectedMicrophoneId] =
    useState("");

  const [previewCameraEnabled, setPreviewCameraEnabled] =
    useState(true);

  const [previewMicEnabled, setPreviewMicEnabled] =
    useState(true);

  const [isPreparingPreview, setIsPreparingPreview] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [viewerCount, setViewerCount] =
    useState(0);

  const [isChatVisible, setIsChatVisible] =
    useState(true);

  const [isPlaying, setIsPlaying] =
    useState(true);

  const [linkCopied, setLinkCopied] =
    useState(false);

  const displayName =
    user?.name?.trim() ||
    user?.email?.trim() ||
    user?.phone?.trim() ||
    "Host";

  /*
   * Keep React state and signaling state
   * synchronized.
   */
  useEffect(() => {
    streamingRef.current =
      isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const video =
      videoRef.current;
    const stream =
      streamRef.current;

    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    video.play().catch(() => {});
  }, [isStreaming]);

  /*
   * ---------------------------------------------------------
   * LIVE STUDIO PREVIEW
   * ---------------------------------------------------------
   */
  const refreshMediaDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      if (!mountedRef.current) {
        return;
      }

      const cameras = devices.filter(
        (device) => device.kind === "videoinput"
      );

      const microphones = devices.filter(
        (device) => device.kind === "audioinput"
      );

      setCameraDevices(cameras);
      setMicrophoneDevices(microphones);

      setSelectedCameraId((current) =>
        current && cameras.some((device) => device.deviceId === current)
          ? current
          : cameras[0]?.deviceId || ""
      );

      setSelectedMicrophoneId((current) =>
        current && microphones.some((device) => device.deviceId === current)
          ? current
          : microphones[0]?.deviceId || ""
      );
    } catch (error) {
      console.warn("Unable to enumerate media devices:", error);
    }
  };

  const attachPreviewVideo = async (stream: MediaStream) => {
    const video = previewVideoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    try {
      await video.play();
    } catch (error) {
      console.warn("Unable to start live preview:", error);
    }
  };

  const stopPreviewStream = () => {
    const preview = previewStreamRef.current;

    if (preview) {
      preview.getTracks().forEach((track) => track.stop());
    }

    previewStreamRef.current = null;

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  };

  const preparePreview = async (
    cameraId = selectedCameraId,
    microphoneId = selectedMicrophoneId
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPreviewError("Camera and microphone access is not supported by this browser.");
      return;
    }

    setIsPreparingPreview(true);
    setPreviewError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId } }
          : true,
        audio: microphoneId
          ? { deviceId: { exact: microphoneId } }
          : true,
      });

      stopPreviewStream();
      previewStreamRef.current = stream;

      stream.getVideoTracks().forEach((track) => {
        track.enabled = previewCameraEnabled;
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = previewMicEnabled;
      });

      await attachPreviewVideo(stream);
      await refreshMediaDevices();
    } catch (error) {
      console.error("Unable to prepare live preview:", error);
      setPreviewError(
        "Unable to access your camera or microphone. Check browser permissions and try again."
      );
    } finally {
      if (mountedRef.current) {
        setIsPreparingPreview(false);
      }
    }
  };

  const togglePreviewCamera = () => {
    const next = !previewCameraEnabled;
    setPreviewCameraEnabled(next);

    previewStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const togglePreviewMicrophone = () => {
    const next = !previewMicEnabled;
    setPreviewMicEnabled(next);

    previewStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const changeCamera = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    await preparePreview(deviceId, selectedMicrophoneId);
  };

  const changeMicrophone = async (deviceId: string) => {
    setSelectedMicrophoneId(deviceId);
    await preparePreview(selectedCameraId, deviceId);
  };

  /*
   * ---------------------------------------------------------
   * PREPARE PRE-LIVE STUDIO ON PAGE LOAD
   * ---------------------------------------------------------
   */
  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPreviewError("Camera and microphone access is not supported by this browser.");
        return;
      }

      setIsPreparingPreview(true);
      setPreviewError("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled || !mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;

        stream.getVideoTracks().forEach((track) => {
          track.enabled = previewCameraEnabled;
        });

        stream.getAudioTracks().forEach((track) => {
          track.enabled = previewMicEnabled;
        });

        await attachPreviewVideo(stream);
        await refreshMediaDevices();
      } catch (error) {
        console.error("Unable to prepare live preview:", error);
        if (!cancelled && mountedRef.current) {
          setPreviewError(
            "Camera and microphone access is required for the live preview. You can retry below."
          );
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsPreparingPreview(false);
        }
      }
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * ATTACH LOCAL VIDEO
   * ---------------------------------------------------------
   */
  const attachLocalVideo =
    async (stream: MediaStream) => {
      const video =
        videoRef.current;

      if (!video) {
        console.warn(
          "Local video element is not ready yet."
        );
        return;
      }

      video.srcObject = stream;

      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      try {
        await video.play();
      } catch (error) {
        console.warn(
          "Camera stream exists but local preview could not start immediately.",
          error
        );

        /*
         * Try again on the next browser tick.
         */
        window.setTimeout(() => {
          if (
            videoRef.current &&
            videoRef.current.srcObject === stream
          ) {
            videoRef.current
              .play()
              .catch(() => {});
          }
        }, 100);
      }
    };

  /*
   * ---------------------------------------------------------
   * CREATE PEER FOR VIEWER
   * ---------------------------------------------------------
   */
  const createPeer =
    (
      viewerId: string
    ): RTCPeerConnection => {
      const socket =
        connectSocket();

      /*
       * Close an old connection for
       * the same viewer.
       */
      const existing =
        peerRef.current.get(
          viewerId
        );

      if (existing) {
        try {
          existing.peer.close();
        } catch {
          // Ignore.
        }

        peerRef.current.delete(
          viewerId
        );
      }

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

      const viewerPeer: ViewerPeer = {
        peer,
        pendingIce: [],
      };

      peerRef.current.set(
        viewerId,
        viewerPeer
      );

      /*
       * Add current stream tracks.
       */
      const stream =
        streamRef.current;

      if (stream) {
        stream
          .getTracks()
          .forEach((track) => {
            try {
              peer.addTrack(
                track,
                stream
              );
            } catch (error) {
              console.error(
                "Unable to add local track:",
                error
              );
            }
          });
      }

      /*
       * ICE generated by streamer.
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
            console.warn(
              "Socket disconnected. ICE candidate not sent."
            );
            return;
          }

          socket.emit(
            "ice-candidate",
            {
              target:
                viewerId,

              candidate:
                event.candidate.toJSON(),
            }
          );
        };

      /*
       * Connection state.
       */
      peer.onconnectionstatechange =
        () => {
          console.log(
            "Viewer connection:",
            viewerId,
            peer.connectionState
          );

          if (
            peer.connectionState ===
              "failed" ||
            peer.connectionState ===
              "closed" ||
            peer.connectionState ===
              "disconnected"
          ) {
            try {
              peer.close();
            } catch {
              // Ignore.
            }

            peerRef.current.delete(
              viewerId
            );
          }
        };

      /*
       * ICE gathering state.
       */
      peer.onicegatheringstatechange =
        () => {
          console.log(
            "ICE gathering:",
            viewerId,
            peer.iceGatheringState
          );
        };

      return peer;
    };

  /*
   * ---------------------------------------------------------
   * SEND OFFER TO VIEWER
   * ---------------------------------------------------------
   */
  const connectViewer =
    async (
      viewerId: string
    ) => {
      const socket =
        connectSocket();

      if (
        !streamRef.current
      ) {
        console.warn(
          "Cannot connect viewer: local stream does not exist."
        );

        return;
      }

      if (
        !streamingRef.current
      ) {
        console.warn(
          "Cannot connect viewer: stream is not active."
        );

        return;
      }

      try {
        console.log(
          "Creating peer for viewer:",
          viewerId
        );

        const peer =
          createPeer(
            viewerId
          );

        const offer =
          await peer.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
          });

        await peer.setLocalDescription(
          offer
        );

        /*
         * Wait until local description
         * exists before sending.
         */
        const localDescription =
          peer.localDescription;

        if (
          !localDescription
        ) {
          throw new Error(
            "Local WebRTC description was not created."
          );
        }

        socket.emit(
          "offer",
          {
            target:
              viewerId,

            offer:
              localDescription,
          }
        );

        console.log(
          "Offer sent to viewer:",
          viewerId
        );
      } catch (error) {
        console.error(
          "Unable to connect viewer:",
          viewerId,
          error
        );

        peerRef.current.delete(
          viewerId
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * START STREAM
   * ---------------------------------------------------------
   */
  const startStream =
    async () => {
      const cleanRoom =
        roomName.trim();

      if (!cleanRoom) {
        setError(
          "Please enter a room name."
        );

        return;
      }

      if (
        cleanRoom.length < 3
      ) {
        setError(
          "Room name must be at least 3 characters."
        );

        return;
      }

      if (
        streamingRef.current
      ) {
        return;
      }

      setError("");
      setIsLoading(true);

      try {
        const socket =
          connectSocket();

        /*
         * Wait for Socket.IO.
         */
        if (
          !socket.connected
        ) {
          await new Promise<void>(
            (
              resolve,
              reject
            ) => {
              let finished =
                false;

              const cleanup =
                () => {
                  socket.off(
                    "connect",
                    handleConnect
                  );

                  socket.off(
                    "connect_error",
                    handleError
                  );
                };

              const handleConnect =
                () => {
                  if (
                    finished
                  ) {
                    return;
                  }

                  finished = true;

                  cleanup();

                  resolve();
                };

              const handleError =
                (err: Error) => {
                  if (
                    finished
                  ) {
                    return;
                  }

                  finished = true;

                  cleanup();

                  reject(err);
                };

              socket.once(
                "connect",
                handleConnect
              );

              socket.once(
                "connect_error",
                handleError
              );

              window.setTimeout(() => {
                if (
                  finished
                ) {
                  return;
                }

                finished = true;

                cleanup();

                reject(
                  new Error(
                    "Socket connection timeout"
                  )
                );
              }, 10000);
            }
          );
        }

        /*
         * Reuse the pre-live studio stream so the
         * broadcaster does not get a second permission
         * prompt or a different camera feed when going live.
         */
        let stream = previewStreamRef.current;

        if (!stream) {
          stream = await getLocalMedia();
        }

        if (!stream) {
          throw new Error(
            "Camera stream was not created."
          );
        }

        stream.getVideoTracks().forEach((track) => {
          track.enabled = previewCameraEnabled;
        });

        stream.getAudioTracks().forEach((track) => {
          track.enabled = previewMicEnabled;
        });

        previewStreamRef.current = null;
        streamRef.current = stream;

        roomRef.current =
          cleanRoom;

        /*
         * Attach camera immediately.
         */
        await attachLocalVideo(
          stream
        );

        /*
         * Set refs BEFORE join-room.
         *
         * This is important because the server
         * may immediately notify us about viewers.
         */
        streamingRef.current =
          true;

        setIsStreaming(
          true
        );

        /*
         * NOW register as streamer.
         */
        socket.emit(
          "join-room",
          {
            roomId:
              cleanRoom,

            role:
              "streamer",

            title:
              cleanRoom,
          }
        );

        console.log(
          "Streamer joining:",
          cleanRoom,
          socket.id
        );

        setRoomName(
          cleanRoom
        );

        setError("");
      } catch (error) {
        console.error(
          "Unable to start stream:",
          error
        );

        streamingRef.current =
          false;

        setIsStreaming(
          false
        );

        stopLocalMedia(
          streamRef.current
        );

        streamRef.current =
          null;

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            null;
        }

        setError(
          "Unable to start the stream. Check your camera, microphone and server."
        );
      } finally {
        setIsLoading(false);
      }
    };

  /*
   * ---------------------------------------------------------
   * STOP STREAM
   * ---------------------------------------------------------
   */
  const stopStream =
    () => {
      const socket =
        connectSocket();

      const room =
        roomRef.current;

      streamingRef.current =
        false;

      setIsStreaming(
        false
      );

      /*
       * Tell server first.
       */
      if (
        room
      ) {
        socket.emit(
          "stream-stopped",
          room
        );

        socket.emit(
          "leave-room"
        );
      }

      /*
       * Close all viewer peers.
       */
      peerRef.current.forEach(
        ({
          peer,
        }) => {
          try {
            peer.close();
          } catch {
            // Ignore.
          }
        }
      );

      peerRef.current.clear();

      /*
       * Stop camera/mic.
       */
      stopLocalMedia(
        streamRef.current
      );

      streamRef.current =
        null;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }

      roomRef.current =
        "";

      setViewerCount(
        0
      );
    };

  /*
   * ---------------------------------------------------------
   * SCREEN SHARE
   * ---------------------------------------------------------
   */
  const shareScreen =
    async () => {
      if (
        !streamRef.current ||
        !streamingRef.current
      ) {
        return;
      }

      try {
        const screen =
          await getScreenMedia();

        const screenTrack =
          screen.getVideoTracks()[0];

        if (
          !screenTrack
        ) {
          return;
        }

        const oldStream =
          streamRef.current;

        const audioTrack =
          oldStream.getAudioTracks()[0];

        const newStream =
          new MediaStream();

        newStream.addTrack(
          screenTrack
        );

        if (
          audioTrack
        ) {
          newStream.addTrack(
            audioTrack
          );
        }

        streamRef.current =
          newStream;

        await attachLocalVideo(
          newStream
        );

        /*
         * Replace video track for
         * every viewer.
         */
        peerRef.current.forEach(
          ({
            peer,
          }) => {
            const sender =
              peer
                .getSenders()
                .find(
                  (item) =>
                    item.track?.kind ===
                    "video"
                );

            if (
              sender
            ) {
              sender
                .replaceTrack(
                  screenTrack
                )
                .catch(
                  (error) => {
                    console.error(
                      "Unable to replace video track:",
                      error
                    );
                  }
                );
            }
          }
        );

        /*
         * When screen sharing ends,
         * restore camera.
         */
        screenTrack.onended =
          async () => {
            try {
              const camera =
                await getLocalMedia();

              const cameraTrack =
                camera.getVideoTracks()[0];

              if (
                !cameraTrack
              ) {
                return;
              }

              const previousStream =
                streamRef.current;

              const restoredStream =
                new MediaStream();

              restoredStream.addTrack(
                cameraTrack
              );

              const currentAudio =
                previousStream?.getAudioTracks()[0];

              if (
                currentAudio
              ) {
                restoredStream.addTrack(
                  currentAudio
                );
              }

              streamRef.current =
                restoredStream;

              await attachLocalVideo(
                restoredStream
              );

              peerRef.current.forEach(
                ({
                  peer,
                }) => {
                  const sender =
                    peer
                      .getSenders()
                      .find(
                        (item) =>
                          item.track?.kind ===
                          "video"
                      );

                  if (
                    sender
                  ) {
                    sender
                      .replaceTrack(
                        cameraTrack
                      )
                      .catch(
                        () => {}
                      );
                  }
                }
              );

              stopLocalMedia(
                previousStream
              );
            } catch (error) {
              console.error(
                "Unable to restore camera:",
                error
              );
            }
          };
      } catch (error) {
        console.error(
          "Screen sharing failed:",
          error
        );

        setError(
          "Unable to share your screen."
        );
      }
    };

  /*
   * =========================================================
   * SOCKET SIGNALING
   *
   * IMPORTANT:
   *
   * These listeners are installed ONCE.
   * We do not depend on isStreaming.
   *
   * This prevents the viewer-joined race condition.
   * =========================================================
   */
  useEffect(() => {
    mountedRef.current =
      true;

    const socket =
      connectSocket();

    /*
     * -------------------------------------------------------
     * SOCKET CONNECT
     * -------------------------------------------------------
     */
    const handleConnect =
      () => {
        console.log(
          "Socket connected:",
          socket.id
        );

        /*
         * If we were already streaming and
         * Socket.IO reconnected, re-register
         * the streamer.
         *
         * This fixes the:
         *
         * streamer: null
         * users: []
         *
         * problem after reconnect/server restart.
         */
        if (
          streamingRef.current &&
          roomRef.current
        ) {
          console.log(
            "Socket reconnected. Rejoining stream room:",
            roomRef.current
          );

          socket.emit(
            "join-room",
            {
              roomId:
                roomRef.current,

              role:
                "streamer",

              title:
                roomRef.current,
            }
          );
        }
      };

    /*
     * -------------------------------------------------------
     * VIEWER JOINED
     * -------------------------------------------------------
     */
    const handleViewerCount =
      (count: number) => {
        if (!mountedRef.current) {
          return;
        }

        setViewerCount(
          typeof count === "number" && count >= 0
            ? count
            : 0
        );
      };

    const handleViewerJoined =
      (
        viewerId: string
      ) => {
        console.log(
          "Viewer joined:",
          viewerId
        );

        /*
         * At this point the stream should
         * already exist.
         */
        if (
          !streamingRef.current ||
          !streamRef.current
        ) {
          console.warn(
            "Viewer joined but streamer media is not ready."
          );

          return;
        }

        connectViewer(
          viewerId
        );
      };

    /*
     * -------------------------------------------------------
     * ANSWER
     * -------------------------------------------------------
     */
    const handleAnswer =
      async ({
        sender,
        answer,
      }: {
        sender: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        console.log(
          "Answer received from viewer:",
          sender
        );

        const viewerPeer =
          peerRef.current.get(
            sender
          );

        if (
          !viewerPeer
        ) {
          console.warn(
            "No peer found for answer:",
            sender
          );

          return;
        }

        const peer =
          viewerPeer.peer;

        /*
         * An answer is valid only when
         * we previously created an offer.
         */
        if (
          peer.signalingState !==
          "have-local-offer"
        ) {
          console.warn(
            "Ignoring answer. Signaling state:",
            peer.signalingState
          );

          return;
        }

        try {
          await peer.setRemoteDescription(
            new RTCSessionDescription(
              answer
            )
          );

          console.log(
            "Viewer answer applied:",
            sender
          );

          /*
           * Apply any ICE candidates that
           * arrived before the answer.
           */
          const pending =
            viewerPeer.pendingIce;

          viewerPeer.pendingIce =
            [];

          for (
            const candidate of pending
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
        } catch (error) {
          console.error(
            "Unable to apply viewer answer:",
            error
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
      }: {
        sender: string;
        candidate: RTCIceCandidateInit;
      }) => {
        const viewerPeer =
          peerRef.current.get(
            sender
          );

        if (
          !viewerPeer
        ) {
          console.warn(
            "ICE received for unknown viewer:",
            sender
          );

          return;
        }

        const peer =
          viewerPeer.peer;

        /*
         * Candidate may arrive before
         * remote description.
         */
        if (
          !peer.remoteDescription
        ) {
          viewerPeer.pendingIce.push(
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
     * USER LEFT
     * -------------------------------------------------------
     */
    const handleUserLeft =
      (
        socketId: string
      ) => {
        console.log(
          "User left:",
          socketId
        );

        const viewerPeer =
          peerRef.current.get(
            socketId
          );

        if (
          !viewerPeer
        ) {
          return;
        }

        try {
          viewerPeer.peer.close();
        } catch {
          // Ignore.
        }

        peerRef.current.delete(
          socketId
        );
      };

    /*
     * -------------------------------------------------------
     * STREAM STOPPED
     * -------------------------------------------------------
     */
    const handleStreamStopped =
      () => {
        console.log(
          "Stream stopped by server."
        );

        /*
         * If server says stream stopped,
         * do not leave our local UI in an
         * invalid state.
         */
        if (
          !streamingRef.current
        ) {
          return;
        }
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

        setError(
          data?.message ||
            "Unable to join the stream room."
        );

        /*
         * Only reset if stream has not
         * successfully started.
         */
        if (
          !streamRef.current
        ) {
          streamingRef.current =
            false;

          setIsStreaming(
            false
          );
        }
      };

    /*
     * Register listeners.
     */
    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "viewer-count",
      handleViewerCount
    );

    socket.on(
      "viewer-joined",
      handleViewerJoined
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
      "stream-stopped",
      handleStreamStopped
    );

    socket.on(
      "room-error",
      handleRoomError
    );

    /*
     * Socket may already be connected.
     */
    if (
      socket.connected
    ) {
      handleConnect();
    }

    return () => {
      mountedRef.current =
        false;

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "viewer-count",
        handleViewerCount
      );

      socket.off(
        "viewer-joined",
        handleViewerJoined
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
        "stream-stopped",
        handleStreamStopped
      );

      socket.off(
        "room-error",
        handleRoomError
      );
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * COMPONENT CLEANUP
   * ---------------------------------------------------------
   */
  useEffect(() => {
    return () => {
      mountedRef.current =
        false;

      if (roomRef.current) {
        connectSocket().emit(
          "leave-room"
        );
      }

      peerRef.current.forEach(
        ({
          peer,
        }) => {
          try {
            peer.close();
          } catch {
            // Ignore.
          }
        }
      );

      peerRef.current.clear();

      stopLocalMedia(
        streamRef.current
      );

      stopPreviewStream();

      streamRef.current =
        null;

      streamingRef.current =
        false;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }
    };
  }, []);

  const getViewerLink = () => {
    return `${window.location.origin}/watch/${encodeURIComponent(
      roomRef.current
    )}`;
  };

  const copyViewerLink = async () => {
    const link = getViewerLink();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setLinkCopied(true);
      window.setTimeout(() => {
        setLinkCopied(false);
      }, 1800);
    } catch (error) {
      console.error("Unable to copy viewer link:", error);
    }
  };

  const shareViewerLink = async () => {
    const link = getViewerLink();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${roomRef.current} - Voxbridge AI`,
          text: "Join my live stream on Voxbridge AI.",
          url: link,
        });
        return;
      }

      await copyViewerLink();
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        console.error("Unable to share viewer link:", error);
      }
    }
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    const player = video?.closest(".live-video");

    if (!video || !(player instanceof HTMLElement)) {
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
    <div className="live-page">
      <AppNavbar className="live-header" />

      <main className="live-main">
        <section className="live-card">
          {!isStreaming && (
            <div className="live-setup live-studio">
              <div className="live-studio-preview">
                <div className="live-preview-header">
                  <div>
                    <span>LIVE PREVIEW</span>
                    <strong>{previewCameraEnabled ? "Camera ready" : "Camera off"}</strong>
                  </div>

                  <span className="live-preview-status">
                    {isPreparingPreview ? "Preparing" : "READY"}
                  </span>
                </div>

                <div className="live-preview-video">
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                  />

                  {!previewCameraEnabled && (
                    <div className="live-camera-off">
                      Camera is off
                    </div>
                  )}

                  {isPreparingPreview && (
                    <div className="live-preview-loading">
                      Preparing your camera and microphone...
                    </div>
                  )}
                </div>

                <div className="live-preview-controls">
                  <button
                    type="button"
                    className={previewMicEnabled ? "live-control" : "live-control live-control-off"}
                    onClick={togglePreviewMicrophone}
                    disabled={!previewStreamRef.current}
                  >
                    {previewMicEnabled ? "Mic On" : "Mic Off"}
                  </button>

                  <button
                    type="button"
                    className={previewCameraEnabled ? "live-control" : "live-control live-control-off"}
                    onClick={togglePreviewCamera}
                    disabled={!previewStreamRef.current}
                  >
                    {previewCameraEnabled ? "Camera On" : "Camera Off"}
                  </button>
                </div>
              </div>

              <div className="live-studio-form">
                <div className="live-setup-header">
                  <div className="live-setup-icon">
                    <Radio size={21} strokeWidth={1.8} />
                  </div>

                  <div>
                    <h2>Start a live stream</h2>
                    <p>Set up your stream before you go live.</p>
                  </div>
                </div>

                <label htmlFor="live-room">
                  Stream Name
                </label>

                <input
                  id="live-room"
                  type="text"
                  value={roomName}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. Weekly Product Update"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      startStream();
                    }
                  }}
                />

                <p className="live-field-hint">
                  This name identifies your stream and is used in the viewer link.
                </p>

                <div className="live-device-grid">
                  <div>
                    <label htmlFor="live-camera">Camera</label>
                    <select
                      id="live-camera"
                      value={selectedCameraId}
                      onChange={(event) => {
                        void changeCamera(event.target.value);
                      }}
                      disabled={isPreparingPreview || cameraDevices.length === 0}
                    >
                      {cameraDevices.length === 0 ? (
                        <option value="">Default camera</option>
                      ) : (
                        cameraDevices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="live-microphone">Microphone</label>
                    <select
                      id="live-microphone"
                      value={selectedMicrophoneId}
                      onChange={(event) => {
                        void changeMicrophone(event.target.value);
                      }}
                      disabled={isPreparingPreview || microphoneDevices.length === 0}
                    >
                      {microphoneDevices.length === 0 ? (
                        <option value="">Default microphone</option>
                      ) : (
                        microphoneDevices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {previewError && (
                  <div className="live-preview-error">
                    <p>{previewError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        void preparePreview();
                      }}
                      disabled={isPreparingPreview}
                    >
                      {isPreparingPreview ? "Preparing..." : "Retry Camera & Mic"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="live-primary"
                  onClick={startStream}
                  disabled={isLoading || isPreparingPreview}
                >
                  {isLoading ? "Starting..." : "Start Live Stream"}
                </button>

                {error && (
                  <p className="live-error">
                    {error}
                  </p>
                )}

                <div className="live-note">
                  <p>
                    Your camera and microphone stay in preview until you start streaming.
                  </p>
                </div>

                <div className="live-card-divider">
                  <span />
                  <p>READY TO SHARE</p>
                  <span />
                </div>

                <div className="live-share-hint">
                  <Link2 size={15} strokeWidth={1.8} />
                  <p>
                    After going live, Voxbridge AI will provide a viewer link for your audience.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isStreaming && (
            <div className="live-content">
              <div className="live-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="live-badge">
                  LIVE
                </div>

                <div className="live-video-top-right">
                  <div className="live-stream-name">
                    <span>STREAM NAME</span>
                    <strong>{roomRef.current}</strong>
                  </div>

                  <div className="live-viewers">
                    <span>VIEWERS</span>
                    <strong>{viewerCount}</strong>
                  </div>

                  <div className="live-video-link">
                    <div className="live-video-link-header">
                      <span>VIEWER LINK</span>
                      <div className="live-video-link-actions">
                        <button
                          type="button"
                          className="live-link-icon-button"
                          onClick={copyViewerLink}
                          aria-label={linkCopied ? "Viewer link copied" : "Copy viewer link"}
                          title={linkCopied ? "Copied" : "Copy link"}
                        >
                          {linkCopied ? (
                            <Check size={15} strokeWidth={2.2} />
                          ) : (
                            <Copy size={15} strokeWidth={2} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="live-link-icon-button"
                          onClick={shareViewerLink}
                          aria-label="Share viewer link"
                          title="Share link"
                        >
                          <Share2 size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <strong>
                      {getViewerLink()}
                    </strong>
                  </div>
                </div>

                {isChatVisible ? (
                  <LiveChat
                    roomId={roomRef.current}
                    userName={displayName}
                    role="streamer"
                    onHide={() => setIsChatVisible(false)}
                  />
                ) : null}

                <div className="live-video-controls">
                  <div className="live-stream-actions">
                    <button
                      type="button"
                      onClick={shareScreen}
                    >
                      Share Screen
                    </button>

                    <button
                      type="button"
                      className="live-stop"
                      onClick={stopStream}
                    >
                      Stop Stream
                    </button>
                  </div>

                  <div className="live-player-controls">
                    {!isChatVisible && (
                      <button
                        type="button"
                        className="live-chat-show-button"
                        onClick={() => setIsChatVisible(true)}
                      >
                        Show Chat
                      </button>
                    )}

                    <button
                      type="button"
                      className="live-icon-button"
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
                      aria-label={isPlaying ? "Pause" : "Play"}
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
                    </button>

                    <button
                      type="button"
                      className="live-icon-button"
                      onClick={toggleFullscreen}
                      aria-label="Fullscreen"
                      title="Fullscreen"
                    >
                      <Maximize size={20} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {!isStreaming && (
        <footer className="live-footer">
          <strong>
            © 2026 Voxbridge AI
          </strong>

          <span>
            Communication without barriers.
          </span>
        </footer>
      )}
    </div>
  );
}
