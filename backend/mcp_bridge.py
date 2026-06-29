import asyncio
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MCP_SERVER_PATH = "../mcp-server/main.py"

async def get_tools_and_session():
    """Start MCP server, return (session, tools_as_anthropic_format)"""
    server_params = StdioServerParameters(
        command="python",
        args=[MCP_SERVER_PATH],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools_result = await session.list_tools()
            # convert MCP tool format → Anthropic tool format
            anthropic_tools = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.inputSchema
                }
                for t in tools_result.tools
            ]
            return session, anthropic_tools

async def call_mcp_tool(tool_name: str, tool_input: dict, context: str = None, profile: str = None) -> str:
    """Spawn MCP server, call one tool, return text result"""
    import os
    env = dict(os.environ)
    if context:
        env["KUBECONTEXT"] = context
    if profile:
        env["AWS_PROFILE"] = profile

    server_params = StdioServerParameters(
        command="python",
        args=[MCP_SERVER_PATH],
        env=env,
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, tool_input)
            return result.content[0].text if result.content else "No output"