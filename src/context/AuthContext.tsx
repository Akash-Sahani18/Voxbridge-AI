import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  clearAuth,
  getStoredToken,
  getStoredUser,
  saveAuth,
  type User,
} from "../services/auth";

import {
  disconnectSocket,
} from "../services/socket";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (response: {
    token: string;
    user: User;
  }) => void;
  logout: () => void;
}

export const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const storedToken =
      getStoredToken();

    const storedUser =
      getStoredUser();

    if (
      storedToken &&
      storedUser
    ) {
      setToken(storedToken);
      setUser(storedUser);
    }

    setLoading(false);
  }, []);

  const login = (response: {
    token: string;
    user: User;
  }) => {
    saveAuth(response);

    setToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    disconnectSocket();
    clearAuth();

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated:
          Boolean(token && user),
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}