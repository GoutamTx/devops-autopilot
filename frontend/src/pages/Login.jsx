import React, { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setError("");
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Invalid username or password.");
    }
  };

  const handlePreFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError("");
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-950 px-4">
      {/* Background glow effects */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none top-1/4 left-1/3"></div>
      <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none bottom-1/4 right-1/3"></div>

      <div className="w-full max-w-md bg-gray-900/40 border border-gray-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            DevOps Autopilot
          </h2>
          <p className="text-sm text-gray-400 mt-2">Sign in to manage your cluster</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2.5">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-gray-100 transition-all placeholder-gray-600"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-gray-100 transition-all placeholder-gray-600"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-[0_4px_20px_rgba(59,130,246,0.25)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.35)] active:scale-[0.98] transition-all"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Development Quick Fill Options */}
        <div className="mt-8 border-t border-gray-800/80 pt-6">
          <p className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider mb-4">
            Development Quick Accounts
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePreFill("admin", "admin")}
              type="button"
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-800 hover:border-blue-500/40 bg-gray-950/50 hover:bg-blue-500/5 transition-all text-xs"
            >
              <span className="font-semibold text-gray-200">Admin Account</span>
              <span className="text-gray-500 mt-1 font-mono">admin / admin</span>
            </button>
            <button
              onClick={() => handlePreFill("developer", "developer")}
              type="button"
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-800 hover:border-indigo-500/40 bg-gray-950/50 hover:bg-indigo-500/5 transition-all text-xs"
            >
              <span className="font-semibold text-gray-200">Developer Account</span>
              <span className="text-gray-500 mt-1 font-mono">developer / dev</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
