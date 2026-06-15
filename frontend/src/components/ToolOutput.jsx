export default function ToolOutput({ toolCalls, toolResults }) {
  if (!toolCalls?.length) return null;
  return (
    <div className="my-2 space-y-2">
      {toolCalls.map((tc, i) => {
        const result = toolResults?.[i];
        return (
          <details key={i} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden" open={!!result}>
            <summary className="px-3 py-2 cursor-pointer flex items-center gap-2 text-xs text-gray-400 hover:bg-gray-800">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <span className="font-mono font-medium text-green-400">{tc.tool}</span>
              <span className="text-gray-600">({JSON.stringify(tc.input)})</span>
            </summary>
            {result && (
              <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-64">
                {result}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}