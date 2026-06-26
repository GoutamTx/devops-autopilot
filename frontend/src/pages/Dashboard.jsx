import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthContext";

const API = "/api";

export default function Dashboard() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(30);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await apiFetch("/api/k8s/dashboard");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      setData(result);
      setError(null);
      setSecondsToRefresh(30); // reset countdown
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Handle 30-second auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsToRefresh(prev => {
        if (prev <= 1) {
          fetchDashboardData(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  // Color helper for Pod Status
  const getPodStatusClasses = (status) => {
    const s = status.toLowerCase();
    if (s === "running" || s === "completed" || s === "succeeded") {
      return "bg-green-500/10 text-green-400 border border-green-500/20";
    }
    if (
      s.includes("fail") ||
      s.includes("err") ||
      s.includes("backoff") ||
      s.includes("invalid") ||
      s === "failed"
    ) {
      return "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse";
    }
    return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
  };

  return (
    <div className="flex-1 bg-gray-950 text-gray-100 p-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Kubernetes Cluster Overview
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Monitor real-time status of pods, deployments, nodes, and events
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-gray-500 block">
              Auto-refreshing in <span className="font-semibold text-blue-400">{secondsToRefresh}s</span>
            </span>
            {data && (
              <span className="text-xxs text-gray-650">
                Last updated at {new Date().toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:bg-gray-800 text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 text-blue-400 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"
              />
            </svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-semibold">Failed to query Kubernetes data:</span> {error}. Ensure minikube or your cluster context is active.
          </div>
        </div>
      )}

      {/* Cluster Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {/* Total Pods */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-blue-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Total Pods</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold text-blue-400">
              {loading && !data ? "..." : data?.overview.totalPods ?? 0}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        {/* Running Pods */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-green-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Running Pods</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold text-green-400">
              {loading && !data ? "..." : data?.overview.runningPods ?? 0}
            </span>
            <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Failed Pods */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-red-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Failed Pods</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className={`text-3xl font-extrabold ${data?.overview.failedPods > 0 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
              {loading && !data ? "..." : data?.overview.failedPods ?? 0}
            </span>
            <div className={`p-1.5 rounded-lg ${data?.overview.failedPods > 0 ? "bg-red-500/10 text-red-400" : "bg-gray-800 text-gray-500"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Nodes */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Total Nodes</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold text-indigo-400">
              {loading && !data ? "..." : data?.overview.totalNodes ?? 0}
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Deployments */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-purple-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Deployments</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold text-purple-400">
              {loading && !data ? "..." : data?.overview.totalDeployments ?? 0}
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Services */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-teal-500/30 transition-all duration-200">
          <span className="text-xs font-medium text-gray-400">Total Services</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-3xl font-extrabold text-teal-400">
              {loading && !data ? "..." : data?.overview.totalServices ?? 0}
            </span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pods Table */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Active Pods</h2>
            <span className="text-xxs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {data?.pods.length ?? 0} Pods
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 font-medium">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Namespace</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Node</th>
                  <th className="pb-3 font-semibold text-right">Age</th>
                </tr>
              </thead>
              <tbody>
                {!data && loading ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-gray-500">
                      Loading pods list...
                    </td>
                  </tr>
                ) : data?.pods.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-gray-500">
                      No pods found in the cluster.
                    </td>
                  </tr>
                ) : (
                  data?.pods.map((p, idx) => (
                    <tr key={idx} className="border-b border-gray-850 hover:bg-gray-900/20 transition-colors">
                      <td className="py-3 font-mono font-medium text-gray-200 truncate max-w-[150px] sm:max-w-[200px]" title={p.name}>
                        {p.name}
                      </td>
                      <td className="py-3 text-gray-400">{p.namespace}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xxs font-medium ${getPodStatusClasses(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-gray-400">{p.node || "-"}</td>
                      <td className="py-3 text-right text-gray-400">{p.age}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deployments Table */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Deployments</h2>
            <span className="text-xxs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {data?.deployments.length ?? 0} Deployments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 font-medium">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Namespace</th>
                  <th className="pb-3 font-semibold">Ready / Desired</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {!data && loading ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-500">
                      Loading deployments list...
                    </td>
                  </tr>
                ) : data?.deployments.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-500">
                      No deployments found in the cluster.
                    </td>
                  </tr>
                ) : (
                  data?.deployments.map((d, idx) => (
                    <tr key={idx} className="border-b border-gray-850 hover:bg-gray-900/20 transition-colors">
                      <td className="py-3 font-mono font-medium text-gray-200 truncate max-w-[150px] sm:max-w-[200px]" title={d.name}>
                        {d.name}
                      </td>
                      <td className="py-3 text-gray-400">{d.namespace}</td>
                      <td className="py-3 font-mono">
                        <span className={d.is_out_of_sync ? "text-red-400 font-bold" : "text-gray-300"}>
                          {d.ready} / {d.desired}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {d.is_out_of_sync ? (
                          <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            Degraded
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                            Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Events Table (Spans full width on wide screen) */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5 xl:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Recent Cluster Events</h2>
            <span className="text-xxs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              Last 10 Events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 font-medium">
                  <th className="pb-3 font-semibold w-[100px]">Type</th>
                  <th className="pb-3 font-semibold w-[150px]">Reason</th>
                  <th className="pb-3 font-semibold w-[250px]">Object</th>
                  <th className="pb-3 font-semibold">Message</th>
                </tr>
              </thead>
              <tbody>
                {!data && loading ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-500">
                      Loading cluster events...
                    </td>
                  </tr>
                ) : data?.events.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-500">
                      No events registered in the cluster.
                    </td>
                  </tr>
                ) : (
                  data?.events.map((e, idx) => {
                    const isWarning = e.type === "Warning";
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-gray-850 hover:bg-gray-900/10 transition-colors ${
                          isWarning ? "bg-yellow-500/5 border-l-2 border-l-yellow-500" : ""
                        }`}
                      >
                        <td className="py-3 pl-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xxs font-semibold ${
                              isWarning
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                : "bg-gray-800 text-gray-400"
                            }`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-medium text-gray-300">{e.reason}</td>
                        <td className="py-3 font-mono text-gray-450 text-xxs truncate max-w-[200px]" title={e.object}>
                          {e.object}
                        </td>
                        <td className={`py-3 text-gray-400 break-words ${isWarning ? "text-yellow-350" : ""}`}>
                          {e.message}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
