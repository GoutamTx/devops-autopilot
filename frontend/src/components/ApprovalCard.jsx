import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

export default function ApprovalCard({ requestId, onExecuted }) {
  const { apiFetch } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch("/api/requests");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const match = data.requests?.find((r) => r.id === requestId);
      if (match) {
        setRequest(match);
      }
    } catch (err) {
      console.error("Error fetching request status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-poll status every 5 seconds if pending
    const interval = setInterval(() => {
      if (request?.status === "pending") {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [requestId, request?.status]);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      const res = await apiFetch(`/api/chat/execute-request/${requestId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Execution failed");
      }
      const data = await res.json();
      setRequest((prev) => ({ ...prev, status: "executed" }));
      if (onExecuted) {
        onExecuted(data.result);
      }
    } catch (err) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  if (loading && !request) {
    return (
      <div className="my-3 p-4 bg-gray-900/50 border border-gray-800 rounded-xl flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
        <span className="text-xs text-gray-400">Checking request #{requestId} status...</span>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="my-3 p-4 rounded-xl border backdrop-blur-sm bg-gray-900/30 transition-all border-gray-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
            REQUEST #{requestId}
          </span>
          <span className="text-xs font-mono font-semibold text-gray-200">
            {request.tool_name}
          </span>
        </div>

        {/* Status Badge */}
        {request.status === "pending" && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Awaiting Manager Approval
          </span>
        )}
        {request.status === "approved" && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Approved
          </span>
        )}
        {request.status === "denied" && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Denied
          </span>
        )}
        {request.status === "executed" && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Executed
          </span>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-400">
        <span className="font-semibold text-gray-300 block mb-1">Target Arguments:</span>
        <pre className="p-2 bg-gray-950 rounded-lg text-[10px] font-mono border border-gray-800 text-gray-400 overflow-x-auto max-w-full">
          {JSON.stringify(JSON.parse(request.tool_input), null, 2)}
        </pre>
      </div>

      {/* Manual Actions based on status */}
      {request.status === "approved" && (
        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-[0_4px_12px_rgba(16,185,129,0.2)] active:scale-[0.98] transition-all"
          >
            {executing ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                Executing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Execute Approved Tool
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
