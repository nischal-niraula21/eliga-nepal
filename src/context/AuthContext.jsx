import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

const PLAYER_TOKEN_KEY = "eliga_player_token";
const ADMIN_TOKEN_KEY = "eliga_admin_token";
const LEGACY_TOKEN_KEY = "eliga_token";

function authRoleError(message) {
  const error = new Error(message);
  error.code = "INVALID_SESSION_ROLE";
  error.response = { data: { message } };
  return error;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [adminRestoreError, setAdminRestoreError] = useState("");

  useEffect(() => {
    // V2.3 separates player and administrator sessions. Remove the old shared token
    // so an admin session can never leak into the player interface (or vice versa).
    localStorage.removeItem(LEGACY_TOKEN_KEY);

    async function restorePlayer() {
      const token = localStorage.getItem(PLAYER_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get("/auth/me", { usePlayerToken: true });
        if (data.user?.role !== "user") throw authRoleError("Invalid player session.");
        if (localStorage.getItem(PLAYER_TOKEN_KEY) !== token) return;
        setUser(data.user);
      } catch (error) {
        if (localStorage.getItem(PLAYER_TOKEN_KEY) !== token) return;
        if ([401, 403].includes(error.response?.status) || error.code === "INVALID_SESSION_ROLE") {
          localStorage.removeItem(PLAYER_TOKEN_KEY);
        } else {
          setRestoreError("Could not reconnect to your account. Your login is saved. Reload to try again.");
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    async function restoreAdmin() {
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) {
        setAdminLoading(false);
        return;
      }

      try {
        const { data } = await api.get("/auth/me", { useAdminToken: true });
        if (data.user?.role !== "admin") throw authRoleError("Invalid administrator session.");
        if (localStorage.getItem(ADMIN_TOKEN_KEY) !== token) return;
        setAdminUser(data.user);
      } catch (error) {
        if (localStorage.getItem(ADMIN_TOKEN_KEY) !== token) return;
        if ([401, 403].includes(error.response?.status) || error.code === "INVALID_SESSION_ROLE") {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
        } else {
          setAdminRestoreError("Could not reconnect to your admin account. Your login is saved. Reload to try again.");
        }
        setAdminUser(null);
      } finally {
        setAdminLoading(false);
      }
    }

    restorePlayer();
    restoreAdmin();
  }, []);

  const value = useMemo(() => ({
    user,
    adminUser,
    loading,
    adminLoading,
    restoreError,
    adminRestoreError,

    async login(email, password) {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.user?.role !== "user") {
        throw authRoleError("Administrator accounts must use the Admin Console login.");
      }
      localStorage.setItem(PLAYER_TOKEN_KEY, data.token);
      setRestoreError("");
      setUser(data.user);
      return data.user;
    },

    async loginAdmin(email, password) {
      const { data } = await api.post("/auth/admin-login", { email, password });
      if (data.user?.role !== "admin") {
        throw authRoleError("This account does not have administrator access.");
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminRestoreError("");
      setAdminUser(data.user);
      return data.user;
    },

    async register(payload) {
      const { data } = await api.post("/auth/register", payload);
      if (data.user?.role !== "user") {
        throw authRoleError("Could not create a player session.");
      }
      localStorage.setItem(PLAYER_TOKEN_KEY, data.token);
      setRestoreError("");
      setUser(data.user);
      return data.user;
    },

    logout() {
      localStorage.removeItem(PLAYER_TOKEN_KEY);
      setRestoreError("");
      setUser(null);
    },

    logoutAdmin() {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setAdminRestoreError("");
      setAdminUser(null);
    },

    async refreshUser() {
      const { data } = await api.get("/auth/me", { usePlayerToken: true });
      if (data.user?.role !== "user") throw authRoleError("Invalid player session.");
      setRestoreError("");
      setUser(data.user);
      return data.user;
    },

    async refreshAdmin() {
      const { data } = await api.get("/auth/me", { useAdminToken: true });
      if (data.user?.role !== "admin") throw authRoleError("Invalid administrator session.");
      setAdminRestoreError("");
      setAdminUser(data.user);
      return data.user;
    },

    setUser,
    setAdminUser
  }), [user, adminUser, loading, adminLoading, restoreError, adminRestoreError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
