const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
  ],
};


/*
 * Camera + microphone
 */
export async function getLocalMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Camera and microphone are not supported."
    );
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      width: {
        ideal: 1280,
      },
      height: {
        ideal: 720,
      },
      frameRate: {
        ideal: 30,
        max: 30,
      },
    },

    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}


/*
 * Screen sharing
 */
export async function getScreenMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen sharing is not supported."
    );
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
}


/*
 * Create WebRTC peer
 */
export function createPeerConnection(
  onIceCandidate?: (
    candidate: RTCIceCandidate
  ) => void,

  onRemoteStream?: (
    stream: MediaStream
  ) => void
): RTCPeerConnection {
  const peer =
    new RTCPeerConnection(
      ICE_SERVERS
    );


  peer.onicecandidate = (event) => {
    if (
      event.candidate &&
      onIceCandidate
    ) {
      onIceCandidate(
        event.candidate
      );
    }
  };


  peer.ontrack = (event) => {
    if (
      event.streams &&
      event.streams.length > 0
    ) {
      onRemoteStream?.(
        event.streams[0]
      );
    }
  };


  peer.onconnectionstatechange = () => {
    console.log(
      "WebRTC connection:",
      peer.connectionState
    );
  };


  peer.oniceconnectionstatechange = () => {
    console.log(
      "WebRTC ICE:",
      peer.iceConnectionState
    );
  };


  return peer;
}


/*
 * Add local tracks
 */
export function addLocalTracks(
  peer: RTCPeerConnection,
  stream: MediaStream
): void {
  stream.getTracks().forEach(
    (track) => {
      peer.addTrack(
        track,
        stream
      );
    }
  );
}


/*
 * Camera
 */
export function setCamera(
  stream: MediaStream,
  enabled: boolean
): void {
  stream
    .getVideoTracks()
    .forEach((track) => {
      track.enabled = enabled;
    });
}


/*
 * Microphone
 */
export function setMicrophone(
  stream: MediaStream,
  enabled: boolean
): void {
  stream
    .getAudioTracks()
    .forEach((track) => {
      track.enabled = enabled;
    });
}


/*
 * Stop media
 */
export function stopLocalMedia(
  stream: MediaStream | null
): void {
  if (!stream) {
    return;
  }

  stream
    .getTracks()
    .forEach((track) => {
      track.stop();
    });
}


/*
 * Replace video track
 */
export async function replaceVideoTrack(
  peer: RTCPeerConnection,
  stream: MediaStream
): Promise<void> {
  const videoTrack =
    stream.getVideoTracks()[0];

  if (!videoTrack) {
    return;
  }

  const sender =
    peer
      .getSenders()
      .find(
        (item) =>
          item.track?.kind === "video"
      );

  if (sender) {
    await sender.replaceTrack(
      videoTrack
    );
  }
}