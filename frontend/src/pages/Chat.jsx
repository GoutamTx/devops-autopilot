import React, { useState, useRef, useEffect } from "react";
import Message from "../components/Message";
import { useAuth } from "../AuthContext";

const API = "/api";

const QUICK_PROMPTS = [
  "Show me all failing pods",
  "Any security groups open to 0.0.0.0/0?",
  "What's my AWS cost breakdown this month?",
  "List all nodes and their status",
  "Show recent K8s events",
  "List Lambda functions",
];

export default function Chat() {
  const { apiFetch } = useAuth();
  const [messages, setMessages]   = useState([]);  // display messages
  const [apiHistory, setApiHistory] = useState([]); // Claude API format
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [tools, setTools]         = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/tools")
      .then(r => r.json())
      .then(d => setTools(d.tools))
      .catch(err => console.error("Error loading tools:", err));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleExecuted = async (resultText, reqId) => {
    send(`Manager approved and executed Request #${reqId}. Tool result: ${resultText}`);
  };

  async function send(text) {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    const newHistory = [...apiHistory, userMsg];

    // Append a new empty assistant message that will be populated via the SSE stream
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "",
      tool_calls: [],
      toolResults: []
    }]);

    try {
      const res = await apiFetch("/api/chat/stream", {
        method: "POST",
        body: JSON.stringify({ messages: newHistory })
      });

      if (!res.body) throw new Error("No response stream available");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const parsed = JSON.parse(dataStr);

              if (parsed.type === "text") {
                setMessages(prev => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.content += parsed.content;
                  next[next.length - 1] = last;
                  return next;
                });
              } else if (parsed.type === "tool_call") {
                setMessages(prev => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.tool_calls = [...(last.tool_calls || []), { tool: parsed.tool, input: parsed.input }];
                  next[next.length - 1] = last;
                  return next;
                });
              } else if (parsed.type === "tool_result") {
                setMessages(prev => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  last.toolResults = [...(last.toolResults || []), parsed.result];
                  next[next.length - 1] = last;
                  return next;
                });
              } else if (parsed.type === "done") {
                setApiHistory(parsed.updated_messages || []);
                setMessages(prev => {
                  const next = [...prev];
                  const last = { ...next[next.length - 1] };
                  if (parsed.response) last.content = parsed.response;
                  if (parsed.tool_calls) last.tool_calls = parsed.tool_calls;
                  next[next.length - 1] = last;
                  return next;
                });
              }
            } catch (err) {
              console.error("Error parsing SSE chunk:", err);
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.content = last.content 
          ? `${last.content}\n\n❌ Error: ${err.message}` 
          : `❌ Error: ${err.message}`;
        next[next.length - 1] = last;
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-950 text-gray-100 overflow-hidden">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                DevOps Autopilot Chat
              </h2>
              <p className="text-gray-400 text-sm max-w-sm mx-auto">
                Ask anything about your cluster. Your local DevOps helper is ready.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)}
                  className="text-left px-4 py-3 rounded-2xl border border-gray-800
                    bg-gray-900/40 hover:bg-gray-800/80 hover:border-gray-700 text-xs text-gray-300 transition-all duration-200">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((m, i) => (
          <Message 
            key={i} 
            msg={m} 
            isStreaming={loading && i === messages.length - 1} 
            onExecuted={(resultText, reqId) => handleExecuted(resultText, reqId)}
          />
        ))}
        
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <div className="px-4 pb-6 pt-3 border-t border-gray-850 bg-gray-950">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end bg-gray-900 border border-gray-800
            rounded-2xl px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask anything about your infrastructure..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm
                text-gray-100 placeholder-gray-500 max-h-32 leading-relaxed"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/10">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xxs text-gray-600 mt-2.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
