import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import RequestsPortal from "./pages/RequestsPortal";
import Login from "./pages/Login";

export default function App() {
  const location = useLocation();
  const { user, logout, isAuthenticated, activeConfig, configOptions, updateConfig } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sticky Glassmorphic Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse"></div>
          <span className="font-bold text-base tracking-wide bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            DevOps Autopilot
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              location.pathname === "/" ? "text-blue-400 font-semibold" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Chat
          </Link>
          <Link
            to="/dashboard"
            className={`text-sm font-medium transition-colors ${
              location.pathname === "/dashboard" ? "text-blue-400 font-semibold" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/portal"
            className={`text-sm font-medium transition-colors ${
              location.pathname === "/portal" ? "text-blue-400 font-semibold" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {user.role === "admin" ? "Admin Portal" : "My Requests"}
          </Link>
        </div>

        {/* Target Context and AWS Profile Selectors */}
        <div className="flex items-center gap-4 bg-gray-900/40 border border-gray-800/80 rounded-xl px-3.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
          {/* Kubernetes Context Dropdown */}
          <div className="flex items-center gap-2 border-r border-gray-800/80 pr-3.5">
            <svg className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2v20M2 12h20M12 12L4 4M12 12l8 8" />
            </svg>
            <select
              value={activeConfig.context}
              onChange={(e) => updateConfig(e.target.value, activeConfig.profile)}
              className="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none cursor-pointer max-w-[130px] font-sans"
            >
              <option value="" className="bg-gray-900 text-gray-500">Default Context</option>
              {configOptions.contexts?.map((ctx) => (
                <option key={ctx} value={ctx} className="bg-gray-900 text-gray-200">
                  {ctx}
                </option>
              ))}
            </select>
          </div>

          {/* AWS Profile Dropdown */}
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <select
              value={activeConfig.profile}
              onChange={(e) => updateConfig(activeConfig.context, e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none cursor-pointer max-w-[130px] font-sans"
            >
              <option value="" className="bg-gray-900 text-gray-500">Default Profile</option>
              {configOptions.profiles?.map((prof) => (
                <option key={prof} value={prof} className="bg-gray-900 text-gray-200">
                  {prof}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-gray-200">{user.username}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider font-semibold mt-0.5 ${
              user.role === "admin" 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            }`}>
              {user.role}
            </span>
          </div>
          
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portal" element={<RequestsPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}