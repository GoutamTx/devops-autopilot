import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const location = useLocation();

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
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}