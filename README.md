# Voxbridge

Voxbridge is a real-time multilingual video communication platform for browser-based video calls, live captions, translation, and live streaming.

## Live Application

https://voxbridge.online

## Features

### Authentication

- Email OTP authentication
- Google authentication
- JWT-based authentication
- Protected application routes
- Authenticated Socket.IO connections
- Persistent user sessions

### Real-Time Video Calling

- Browser-to-browser audio and video communication
- Multi-participant video rooms
- Microphone controls
- Camera controls
- Participant join and leave handling
- WebRTC peer connections
- ICE negotiation
- Socket.IO signaling
- Leave and rejoin support
- Responsive call interface

### Live Captions

Voxbridge includes an automatic speech-processing pipeline:

    Microphone
        |
        v
    Web Audio API / Voice Activity Detection
        |
        v
    Speech Segment
        |
        v
    Socket.IO
        |
        v
    Whisper
        |
        v
    Detected Language + Transcript
        |
        v
    Live Caption

The speech pipeline supports:

- Automatic speech detection
- Voice activity detection
- Speech segmentation
- Multilingual transcription
- Automatic language detection
- Live captions
- Per-participant caption state
- Language-switch stabilization
- Rate-limit retry handling

### Translation

Participants can activate translation independently for another participant's speech.

    Spoken Audio
         |
         v
    Whisper Transcription
         |
         v
    Detected Language
         |
         v
    Translation
         |
         v
    Translated Caption

The spoken language does not need to be manually selected during a call.

### Live Streaming

Voxbridge also supports one-to-many live streaming.

- Start a live stream
- Configure stream name
- Generate viewer URL
- Watch a live stream
- Live viewer count
- Live chat
- Screen sharing
- Stop stream

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- WebRTC APIs
- Socket.IO Client
- Web Audio API
- Browser Speech Recognition API
- Responsive CSS

### Backend

- Node.js
- Express.js
- TypeScript
- Socket.IO
- JWT
- PostgreSQL
- REST APIs

### AI and Speech

- Whisper
- `whisper-large-v3-turbo`
- Automatic language detection
- Translation pipeline
- Voice Activity Detection

### Infrastructure

- AWS EC2
- Nginx
- HTTPS
- Node.js
- PostgreSQL

## Architecture

    Browser
       |
       +----------------------+
       |                      |
       v                      v
    React UI             Node.js Backend
                              |
                    +---------+---------+
                    |                   |
                    v                   v
                Express.js          Socket.IO
                    |                   |
                    v                   v
                PostgreSQL          Signaling
                                        |
                                        v
                                   WebRTC Setup
                                        |
                                        v
                                Audio / Video Media

Socket.IO is used for signaling and coordination. WebRTC handles the real-time audio and video media between participants.

## Speech Processing Architecture

    Microphone
        |
        v
    AudioContext
        |
        v
    AnalyserNode
        |
        v
    Voice Activity Detection
        |
        +---- No speech ----> Ignore
        |
        +---- Speech -------> Capture segment
                                  |
                                  v
                              Socket.IO
                                  |
                                  v
                             Whisper API
                                  |
                                  v
                       Transcript + Language
                                  |
                                  v
                              Caption UI
                                  |
                                  v
                         Optional Translation

Speech segments are processed instead of continuously sending audio, reducing unnecessary transcription requests.

The implementation also includes bounded retries for rate limiting and language-switch confirmation logic.

## Deployment

The production application is deployed on AWS EC2.

    Internet
       |
       v
    https://voxbridge.online
       |
       v
    Nginx
       |
       v
    Node.js / Express / Socket.IO
       |
       +---- PostgreSQL
       |
       +---- AI transcription services

Nginx provides the public HTTP/HTTPS layer while the Node.js backend runs internally on port 5001.

## Testing

Voxbridge was tested using automated real-browser testing with Playwright, Chromium, and Firefox.

The final regression covered:

1. Call UI
2. Captions and translation UI
3. Browser compatibility
4. Authentication and negative testing
5. Network recovery
6. Media permissions
7. Responsive UI
8. Live streaming

### Final Regression Result

    Regression scripts:      8/8 PASS
    Individual assertions:   79/79 PASS

### Call UI

Validated:

- Two participants joining
- Audio mute
- Audio unmute
- Camera off
- Camera on
- Leaving a room
- Rejoining a room

Result:

    7/7 PASS

### Captions and Translation UI

Validated:

- Live Captions control
- Caption UI/state
- Translate control
- Translation UI/state

Result:

    5/5 PASS

### Browser Compatibility

Tested:

- Chromium
- Firefox

Result:

    10/10 PASS

Firefox has a known limitation described below because browser-native SpeechRecognition is not supported there.

### Authentication and Negative Testing

Validated:

- Protected call route redirects unauthenticated users to login
- Empty/invalid call route handling
- No page errors

Result:

    3/3 PASS

### Network Recovery

A participant was deliberately disconnected from the network and then reconnected.

Validated:

- Participant remained on the call page
- Network restoration
- Video after recovery
- Final room state
- No application/page errors

Result:

    6/6 PASS

The deliberate offline simulation produced expected browser/network errors such as `ERR_INTERNET_DISCONNECTED` and Socket.IO `xhr poll error`.

### Media Permissions

Validated:

- Call page loading
- Media elements
- Media/permission state
- No page errors

Result:

    4/4 PASS

### Responsive Testing

Tested at:

    Mobile:   390 x 844
    Tablet:   768 x 1024
    Desktop:  1440 x 900

Result:

    18/18 PASS

### Live Streaming

Validated:

- Live streaming page
- Stream name
- Start stream
- Streamer live state
- Viewer URL
- Viewer connection
- Viewer video
- Viewer count
- Stop stream
- Streamer returning to non-live state
- Page errors
- Application console errors

Result:

    13/13 PASS

## WebRTC Load Testing

Separate automated production-browser testing was performed with multiple concurrent Chromium participants.

| Participants | Expected peers/client | Unique remote streams | ICE failures | WebRTC connection failures |
|---:|---:|---:|---:|---:|
| 2 | 1 | 4 | 0 | 0 |
| 3 | 2 | 6 | 0 | 0 |
| 4 | 3 | 12 | 0 | 0 |
| 6 | 5 | 30 | 0 | 16* |

At 6 participants, all clients ultimately maintained 5 connected peers and 30 unique remote streams.

The WebRTC failures at 6 participants were transient connection failures followed by peer reconnections rather than 16 permanently failed participants.

This testing exposed the scalability characteristics of the current peer-to-peer mesh architecture.

## WebRTC Scaling

The current calling architecture uses peer-to-peer WebRTC.

For a room with N participants, each participant may need connections to the other participants.

This architecture is appropriate for small rooms but becomes increasingly expensive as participant count grows.

For larger production rooms, the scaling path would be an SFU architecture such as:

- mediasoup
- LiveKit
- Janus

Voxbridge does not claim an unlimited participant capacity.

## Backend Resource Testing

The production EC2 instance was observed during testing.

Representative measurement:

    RAM Total:       ~913 MB
    RAM Used:        ~285 MB
    RAM Free:        ~232 MB
    RAM Available:   ~471 MB
    Swap:            0 MB

Representative Node.js measurement:

    CPU:             ~0%
    RSS:             ~98 MB

Short vmstat sampling showed approximately 99-100% CPU idle during the observed period.

These are observed measurements during testing and are not theoretical capacity guarantees.

## Known Limitations

### WebRTC Mesh Scaling

The current architecture uses peer-to-peer WebRTC. At 6 participants, communication ultimately recovered successfully, but transient WebRTC reconnections were observed.

An SFU would be preferable for larger rooms.

### Firefox Speech Recognition

Firefox does not support the Web Speech Recognition API used by the browser speech-recognition portion of Voxbridge.

The call interface and WebRTC tests still passed in Firefox.

### Automated Speech Testing

The automated captions test validates the captions and translation controls and UI/state.

It does not claim complete automated validation of real human speech through:

    Real Speech
        ->
    Whisper
        ->
    Transcript
        ->
    Translation

because the automated microphone does not contain meaningful human speech.

## Security

The application includes:

- JWT authentication
- Protected routes
- Authenticated Socket.IO connections
- Server-side token verification
- User identity attached to authenticated sockets
- Room-level access through authenticated sessions

Secrets and API keys should be supplied through environment variables and should not be committed to the repository.

## Project Structure

A simplified structure:

    Voxbridge/
    |
    +-- src/
    |   +-- components/
    |   +-- pages/
    |   +-- services/
    |   +-- App.tsx
    |   +-- main.tsx
    |
    +-- server/
    |   +-- server.ts
    |   +-- routes/
    |   +-- services/
    |   +-- ...
    |
    +-- public/
    |
    +-- package.json
    +-- tsconfig.json
    +-- vite.config.ts
    +-- README.md

## Local Development

### Requirements

- Node.js
- npm
- PostgreSQL
- Modern browser
- Git

Clone the repository:

    git clone <your-repository-url>
    cd Voxbridge

Install dependencies:

    npm install

Configure the required environment variables.

Example:

    VITE_API_URL=http://localhost:5001

Build the application:

    npm run build

Use the project's configured npm scripts to start the development environment.

## Environment Variables

Typical configuration includes:

    DATABASE_URL=
    JWT_SECRET=
    VITE_API_URL=
    GROQ_API_KEY=
    GOOGLE_CLIENT_ID=

The exact variables used by the application should be configured in the deployment environment.

Never commit secrets or API keys to Git.

## Testing Scripts

The automated testing workflow includes:

    ui-test.mjs
    captions-test.mjs
    browser-test.mjs
    negative-test.mjs
    network-test.mjs
    permissions-test.mjs
    responsive-test.mjs
    live-stream-test.mjs
    webrtc-load-test.mjs

## Engineering Highlights

Voxbridge demonstrates practical full-stack engineering across:

- Real-time WebRTC communication
- WebRTC signaling
- Socket.IO event architecture
- JWT authentication
- PostgreSQL integration
- React and TypeScript
- Node.js backend development
- AI speech processing
- Automatic language detection
- Translation
- Voice activity detection
- Live streaming
- Network recovery
- Browser compatibility testing
- Responsive UI testing
- Automated end-to-end testing
- AWS deployment
- Nginx reverse proxy
- Production debugging
- WebRTC load testing

## Future Improvements

Potential production improvements include:

- SFU-based video architecture for larger rooms
- TURN server configuration
- Redis Socket.IO adapter for distributed signaling
- Horizontal backend scaling
- Persistent room management
- Improved speech-recognition fallback for unsupported browsers
- Real-audio automated transcription tests
- Advanced observability and monitoring
- Usage and rate-limit dashboards
- Improved streaming scalability
- CI/CD deployment pipeline

## Project Status

Voxbridge is deployed and tested as a small-scale real-time multilingual communication and streaming platform.

Final automated regression:

    8/8 test suites passed
    79/79 assertions passed

The separate WebRTC load test reached 6 concurrent participants and successfully demonstrated multi-peer communication while exposing the transient reconnection behavior and scalability limitations of the current mesh architecture.

## Production

https://voxbridge.online

## Author

Aakash Sahani

Full-Stack / Software Engineering Project

Voxbridge - Real-Time Multilingual Video Communication Platform
