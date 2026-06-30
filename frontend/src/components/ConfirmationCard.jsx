import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import ApprovalCard from "./ApprovalCard";

export default function ConfirmationCard({ toolName, toolInput, onExecuted }) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState("pending_confirmation"); // 'pending_confirmation', 'cancelled', 'submitted'

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/requests/submit", {
        method: "POST",
        body: JSON.stringify({
          tool_name: toolName,
          tool_input: toolInput,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to submit request");
      }

      const data = await res.json();
      setRequestId(data.request_id);
      setStatus("submitted");
    } catch (err) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStatus("cancelled");
  };

  if (status === "submitted" && requestId) {
    return <ApprovalCard requestId={requestId} onExecuted={onExecuted} />;
  }

  if (status === "cancelled") {
    return (
      <div className="my-3 p-4 rounded-xl border border-gray-800 bg-gray-900/10 text-gray-500 text-xs italic flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Request submission cancelled by user.</span>
      </div>
    );
  }

  return (
    <div className="my-3 p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 backdrop-blur-md shadow-lg animate-fade-in text-left">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
          <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-semibold text-gray-200">Restricted Operation Confirmation</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            The action <strong className="text-amber-400 font-mono">{toolName}</strong> requires manager approval. Would you like to submit an approval request to the manager/admin?
          </p>
        </div>
      </div>

      <div className="mt-4 bg-gray-950/80 rounded-xl border border-gray-900 p-3">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Arguments:</span>
        <pre className="text-[10px] font-mono text-gray-300 overflow-x-auto leading-relaxed max-w-full">
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-900/50 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 text-xs font-semibold hover:bg-gray-800/50 border border-transparent hover:border-gray-800 rounded-xl text-gray-400 hover:text-gray-200 active:scale-[0.98] transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-[0_4px_12px_rgba(245,158,11,0.2)] active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Request Manager Approval
            </>
          )}
        </button>
      </div>
    </div>
  );
}
