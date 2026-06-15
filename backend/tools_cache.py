# Caches tools so we don't re-spawn the MCP server on every request
_tools_cache = None

async def get_cached_tools():
    global _tools_cache
    if _tools_cache is None:
        from mcp_bridge import call_mcp_tool
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        server_params = StdioServerParameters(command="python", args=["../mcp-server/main.py"])
        async with stdio_client(server_params) as (r, w):
            async with ClientSession(r, w) as session:
                await session.initialize()
                result = await session.list_tools()
                _tools_cache = [
                    {"name": t.name, "description": t.description, "input_schema": t.inputSchema}
                    for t in result.tools
                ]
    return _tools_cache