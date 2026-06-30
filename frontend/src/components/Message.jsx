import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ToolOutput from "./ToolOutput";
import ApprovalCard from "./ApprovalCard";
import ConfirmationCard from "./ConfirmationCard";

export default function Message({ msg, isStreaming, onExecuted }) {
  const isUser = msg.role === "user";

  // Extract tool results from message history
  const toolResults = msg.toolResults || [];

  // Parse approval request ID if present
  const requestRegex = /(?:approval request|request) #(\d+)/i;
  let reqId = null;
  const match = msg.content?.match(requestRegex);
  if (match) {
    reqId = parseInt(match[1], 10);
  } else {
    for (const r of toolResults) {
      const rMatch = typeof r === "string" && r.match(requestRegex);
      if (rMatch) {
        reqId = parseInt(rMatch[1], 10);
        break;
      }
    }
  }

  // Detect restricted tool calls that are pending confirmation
  const unsubmittedRequests = [];
  if (!isUser && msg.tool_calls) {
    msg.tool_calls.forEach((tc, idx) => {
      const resVal = toolResults[idx];
      if (
        typeof resVal === "string" &&
        resVal.includes("requires manager approval") &&
        resVal.includes("It has NOT been submitted yet")
      ) {
        unsubmittedRequests.push({
          toolName: tc.tool,
          toolInput: tc.input,
          key: `${tc.tool}-${idx}`
        });
      }
    });
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? "order-2" : "order-1"}`}>
        {!isUser && msg.tool_calls?.length > 0 && (
          <ToolOutput toolCalls={msg.tool_calls} toolResults={toolResults} />
        )}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed relative
          ${isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700"
          }`}>
          {isStreaming && !msg.content ? (
            <div className="flex gap-1 py-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <>
              <ReactMarkdown
                components={{
                  code({ inline, className, children }) {
                    const lang = /language-(\w+)/.exec(className || "")?.[1];
                    return !inline && lang ? (
                      <SyntaxHighlighter style={oneDark} language={lang} PreTag="div">
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500/80 animate-pulse align-middle rounded-sm" />
              )}
            </>
          )}
        </div>
        
        {/* Render Approval Card if request ID detected */}
        {!isUser && reqId && (
          <ApprovalCard requestId={reqId} onExecuted={(resultText) => onExecuted(resultText, reqId)} />
        )}

        {/* Render Confirmation Card for restricted actions not yet submitted */}
        {!isUser && unsubmittedRequests.map(req => (
          <ConfirmationCard
            key={req.key}
            toolName={req.toolName}
            toolInput={req.toolInput}
            onExecuted={onExecuted}
          />
        ))}
      </div>
    </div>
  );
}