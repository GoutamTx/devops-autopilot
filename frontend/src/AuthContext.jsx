import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("autopilot_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [activeConfig, setActiveConfig] = useState({ context: "", profile: "" });
  const [configOptions, setConfigOptions] = useState({ contexts: [], profiles: [] });
  const [credentials, setCredentials] = useState({
    target_mode: "host",
    has_kubeconfig: false,
    has_aws: false,
    aws_region: "",
  });

  const login = async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Authentication failed");
      }

      const data = await res.json();
      const userPayload = {
        username: data.username,
        role: data.role,
        token: data.token,
      };

      localStorage.setItem("autopilot_user", JSON.stringify(userPayload));
      setUser(userPayload);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("autopilot_user");
    setUser(null);
    setActiveConfig({ context: "", profile: "" });
    setConfigOptions({ contexts: [], profiles: [] });
    setCredentials({
      target_mode: "host",
      has_kubeconfig: false,
      has_aws: false,
      aws_region: "",
    });
  };

  const apiFetch = async (url, options = {}) => {
    const token = user?.token;
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(url, { ...options, headers });
  };

  const fetchConfig = async () => {
    if (!user) return;
    try {
      const activeRes = await apiFetch("/api/config/active");
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveConfig({
          context: activeData.context || "",
          profile: activeData.profile || "",
        });
      }

      const optionsRes = await apiFetch("/api/config/options");
      if (optionsRes.ok) {
        const optionsData = await optionsRes.json();
        setConfigOptions({
          contexts: optionsData.contexts || [],
          profiles: optionsData.profiles || [],
        });
      }
    } catch (err) {
      console.error("Failed to load configs:", err);
    }
  };

  const fetchCredentials = async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/config/credentials");
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error("Failed to load credentials:", err);
    }
  };

  const updateConfig = async (context, profile) => {
    try {
      const res = await apiFetch("/api/config/active", {
        method: "POST",
        body: JSON.stringify({ context, profile }),
      });
      if (!res.ok) throw new Error("Failed to update config");
      const data = await res.json();
      setActiveConfig({
        context: data.context || "",
        profile: data.profile || "",
      });
      return { success: true };
    } catch (err) {
      console.error("Error updating config:", err);
      return { success: false, error: err.message };
    }
  };

  const updateCredentials = async (payload) => {
    try {
      const res = await apiFetch("/api/config/credentials", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update credentials");
      await fetchCredentials();
      return { success: true };
    } catch (err) {
      console.error("Error updating credentials:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchConfig();
      fetchCredentials();
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        apiFetch,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        activeConfig,
        configOptions,
        updateConfig,
        credentials,
        updateCredentials,
        fetchCredentials,
        refreshConfig: fetchConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
