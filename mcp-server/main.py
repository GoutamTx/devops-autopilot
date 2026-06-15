import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent
from tools.k8s import K8S_TOOLS, handle_k8s
from tools.aws import AWS_TOOLS, handle_aws

server = Server("devops-autopilot")

ALL_TOOLS = K8S_TOOLS + AWS_TOOLS
TOOL_NAMES_K8S = {t.name for t in K8S_TOOLS}
TOOL_NAMES_AWS = {t.name for t in AWS_TOOLS}

@server.list_tools()
async def list_tools():
    return ALL_TOOLS

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name in TOOL_NAMES_K8S:
        return await handle_k8s(name, arguments)
    if name in TOOL_NAMES_AWS:
        return await handle_aws(name, arguments)
    return [TextContent(type="text", text=f"Unknown tool: {name}")]

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())