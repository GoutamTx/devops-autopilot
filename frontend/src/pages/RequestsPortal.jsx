import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

export default function RequestsPortal() {
  const { user, apiFetch } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch("/api/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReview = async (id, status) => {
    try {
      setReviewingId(id);
      const res = await apiFetch(`/api/admin/requests/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Review failed");
      }

      // Refresh list
      await fetchRequests();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setReviewingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Approved
          </span>
        );
      case "denied":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Denied
          </span>
        );
      case "executed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Executed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            {status}
          </span>
        );
    }
  };

  const formatArgs = (argsStr) => {
    try {
      const parsed = JSON.parse(argsStr);
      return (
        <pre className="text-[11px] font-mono bg-gray-950 p-2.5 rounded-lg border border-gray-800 text-gray-300 overflow-x-auto max-w-full mt-1.5">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span className="text-xs text-gray-500">{argsStr}</span>;
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "unknown";
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-6 relative">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              {user.role === "admin" ? "Manager Approval Portal" : "Approval Requests"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {user.role === "admin"
                ? "Review and authorize restricted developer operations"
                : "Track the status of your requested operations"}
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 active:scale-[0.98] disabled:opacity-50 text-sm font-semibold rounded-xl text-gray-300 transition-all"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17.2"
              />
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Requests List */}
        {loading && requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4"></div>
            <p className="text-gray-400 text-sm">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[350px] border border-dashed border-gray-800 rounded-2xl bg-gray-900/10">
            <div className="w-12 h-12 rounded-xl bg-gray-900/40 border border-gray-800/80 flex items-center justify-center text-gray-500 mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-gray-300 font-semibold mb-1">No requests found</h3>
            <p className="text-gray-500 text-xs max-w-xs text-center">
              When a developer triggers a write tool inside chat, it will appear here for review.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-gray-900/30 border border-gray-800/80 hover:border-gray-800 rounded-xl p-5 shadow-sm transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        #{req.id}
                      </span>
                      <h3 className="text-base font-bold text-gray-200 font-mono">
                        {req.tool_name}
                      </h3>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                      <span>
                        Requester: <strong className="text-gray-300">{req.requester_name}</strong>
                      </span>
                      <span>•</span>
                      <span>Requested: {formatTime(req.created_at)}</span>
                      {req.reviewer_name && (
                        <>
                          <span>•</span>
                          <span>
                            Reviewed by:{" "}
                            <strong className="text-emerald-400">{req.reviewer_name}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions for Admin */}
                  {user.role === "admin" && req.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(req.id, "approved")}
                        disabled={reviewingId !== null}
                        className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-xl text-xs font-semibold active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_2px_10px_rgba(16,185,129,0.05)] hover:shadow-[0_4px_15px_rgba(16,185,129,0.2)]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(req.id, "denied")}
                        disabled={reviewingId !== null}
                        className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-semibold active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_2px_10px_rgba(244,63,94,0.05)] hover:shadow-[0_4px_15px_rgba(244,63,94,0.2)]"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-gray-900/60 pt-4">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
                    Arguments
                  </span>
                  {formatArgs(req.tool_input)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
