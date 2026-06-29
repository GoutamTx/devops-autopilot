import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

export default function CredentialsModal({ isOpen, onClose }) {
  const { credentials, updateCredentials } = useAuth();
  const [targetMode, setTargetMode] = useState("host");
  const [kubeconfigYaml, setKubeconfigYaml] = useState("");
  const [awsKeyId, setAwsKeyId] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (isOpen && credentials) {
      setTargetMode(credentials.target_mode || "host");
      setAwsRegion(credentials.aws_region || "us-east-1");
      setKubeconfigYaml(""); // For security, do not prefill large raw files unless requested
      setAwsKeyId("");
      setAwsSecretKey("");
      setMessage({ text: "", type: "" });
    }
  }, [isOpen, credentials]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setKubeconfigYaml(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    const payload = {
      target_mode: targetMode,
      kubeconfig_yaml: kubeconfigYaml || null,
      aws_access_key_id: awsKeyId || null,
      aws_secret_access_key: awsSecretKey || null,
      aws_region: awsRegion || null,
    };

    const res = await updateCredentials(payload);
    setLoading(false);

    if (res.success) {
      setMessage({ text: "Credentials updated successfully!", type: "success" });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setMessage({ text: res.error || "Failed to update credentials", type: "error" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="w-full max-w-xl bg-gray-900 border border-gray-800/80 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.5)] p-6 relative z-10 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
          <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Target Cluster & Credentials Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border text-sm flex items-center gap-3 ${
            message.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Target Mode Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Credentials Source
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTargetMode("host")}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition-all ${
                  targetMode === "host"
                    ? "border-blue-500 bg-blue-500/5 text-blue-400"
                    : "border-gray-800 hover:border-gray-700 bg-gray-950/40 text-gray-400"
                }`}
              >
                <span className="font-semibold text-sm block text-gray-200">Host Configurations</span>
                <span className="text-[11px] text-gray-500 leading-normal">
                  Use the clusters and AWS accounts configured on the host VM.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode("custom")}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition-all ${
                  targetMode === "custom"
                    ? "border-blue-500 bg-blue-500/5 text-blue-400"
                    : "border-gray-800 hover:border-gray-700 bg-gray-950/40 text-gray-400"
                }`}
              >
                <span className="font-semibold text-sm block text-gray-200">Custom Credentials</span>
                <span className="text-[11px] text-gray-500 leading-normal">
                  Upload your own Kubeconfig or AWS Access Keys to use.
                </span>
              </button>
            </div>
          </div>

          {/* Custom Credentials Fields */}
          {targetMode === "custom" && (
            <div className="space-y-6 animate-fade-in border-t border-gray-800 pt-6">
              {/* Kubernetes Kubeconfig */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Kubernetes Kubeconfig (YAML)
                  </label>
                  <input
                    type="file"
                    id="kubeconfig-file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".yaml,.yml,config/*"
                  />
                  <label
                    htmlFor="kubeconfig-file"
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer select-none"
                  >
                    Upload Config File
                  </label>
                </div>
                <textarea
                  value={kubeconfigYaml}
                  onChange={(e) => setKubeconfigYaml(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-gray-100 placeholder-gray-700 resize-none leading-relaxed"
                  placeholder={
                    credentials.has_kubeconfig 
                      ? "[Existing Kubeconfig Loaded] Paste new YAML here to overwrite..." 
                      : "apiVersion: v1\nclusters:\n..."
                  }
                />
              </div>

              {/* AWS Credentials */}
              <div className="space-y-4 border-t border-gray-850 pt-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  AWS Credentials
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[11px] text-gray-500 font-medium mb-1.5">AWS Access Key ID</span>
                    <input
                      type="text"
                      value={awsKeyId}
                      onChange={(e) => setAwsKeyId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-gray-100 placeholder-gray-700"
                      placeholder={credentials.has_aws ? "[Configured]" : "AKIA..."}
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-gray-500 font-medium mb-1.5">AWS Secret Access Key</span>
                    <input
                      type="password"
                      value={awsSecretKey}
                      onChange={(e) => setAwsSecretKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-gray-100 placeholder-gray-700"
                      placeholder={credentials.has_aws ? "[Configured]" : "Secret key..."}
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-gray-500 font-medium mb-1.5">AWS Default Region</span>
                  <select
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-gray-300 font-sans cursor-pointer"
                  >
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-east-2">us-east-2 (Ohio)</option>
                    <option value="us-west-1">us-west-1 (N. California)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                    <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-800 pt-5 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold hover:bg-gray-800 border border-transparent hover:border-gray-800 rounded-xl text-gray-400 hover:text-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.2)] hover:shadow-[0_4px_15px_rgba(59,130,246,0.3)] active:scale-[0.98] transition-all"
            >
              {loading ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
