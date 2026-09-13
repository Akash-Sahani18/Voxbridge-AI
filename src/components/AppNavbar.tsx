import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/AppNavbar.css";

type AppNavbarProps = {
  className?: string;
};

const NAV_ITEMS = [
  { label: "Create Room", path: "/create", route: "/create" },
  { label: "Join Room", path: "/join", route: "/join" },
  { label: "Live Stream", path: "/live", route: "/live" },
];

export default function AppNavbar({ className = "" }: AppNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const currentPath = location.pathname;

  const isCurrentRoute = (route: string) => {
    if (route === "/create") {
      return currentPath === "/create";
    }

    if (route === "/join") {
      return currentPath === "/join";
    }

    if (route === "/live") {
      return currentPath === "/live";
    }

    return false;
  };

  const displayName = user?.name?.trim() || "Account";
  const displayContact = user?.email || user?.phone || "";

  const handleLogout = () => {
    logout();
    navigate("/signin", { replace: true });
  };

  return (
    <nav className={`app-navbar ${className}`.trim()}>
      <button
        type="button"
        className="app-navbar-logo"
        onClick={() => navigate("/")}
      >
        Voxbridge AI
      </button>

      <div className="app-navbar-right">
        <div className="app-navbar-links">
          {NAV_ITEMS.map((item) => {
            if (isCurrentRoute(item.route)) {
              return null;
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            );
          })}

          {!isAuthenticated && (
            <>
              <button
                type="button"
                onClick={() => navigate("/login")}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => navigate("/register")}
              >
                Register
              </button>
            </>
          )}

          {isAuthenticated && (
            <button
              type="button"
              className="app-navbar-logout"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={17} strokeWidth={1.8} />
              <span>Logout</span>
            </button>
          )}
        </div>

        {isAuthenticated && (
          <div className="app-navbar-account">
            <div className="app-navbar-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="app-navbar-user-info">
              <strong>{displayName}</strong>
              {displayContact && <span>{displayContact}</span>}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
