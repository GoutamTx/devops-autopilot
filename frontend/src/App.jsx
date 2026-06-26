import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import RequestsPortal from "./pages/RequestsPortal";
import Login from "./pages/Login";

export default function App() {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

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