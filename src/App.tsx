import {
  Routes,
  Route,
} from "react-router-dom";

import Home from "./pages/Home";
import JoinRoom from "./pages/JoinRoom";
import CreateRoom from "./pages/createRoom";
import CallRoom from "./pages/CallRoom";
import LiveStream from "./pages/LiveStream";
import WatchLive from "./pages/WatchLive";
import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signin"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/join"
            element={<JoinRoom />}
          />

          <Route
            path="/create"
            element={<CreateRoom />}
          />

          <Route
            path="/call/:roomId"
            element={<CallRoom />}
          />

          <Route
            path="/live"
            element={<LiveStream />}
          />

          <Route
            path="/watch/:roomId"
            element={<WatchLive />}
          />
        </Route>

        <Route
          path="*"
          element={<Home />}
        />
      </Routes>
    </AuthProvider>
  );
}