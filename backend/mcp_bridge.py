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

async def call_mcp_tool(tool_name: str, tool_input: dict, user: dict = None) -> str:
    """Spawn MCP server, call one tool, return text result"""
    import os
    env = dict(os.environ)
    
    if user:
        target_mode = user.get("target_mode", "host")
        if target_mode == "custom":
            # 1. Kubernetes custom kubeconfig
            kubeconfig_yaml = user.get("kubeconfig_yaml")
            if kubeconfig_yaml:
                user_id = user["id"]
                kubeconfig_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_kubeconfigs")
                os.makedirs(kubeconfig_dir, exist_ok=True)
                kubeconfig_path = os.path.join(kubeconfig_dir, f"kubeconfig_{user_id}.yaml")
                
                with open(kubeconfig_path, "w") as f:
                    f.write(kubeconfig_yaml)
                
                env["KUBECONFIG"] = kubeconfig_path
                env.pop("KUBECONTEXT", None)
            
            # 2. AWS custom credentials
            aws_key = user.get("aws_access_key_id")
            aws_secret = user.get("aws_secret_access_key")
            if aws_key and aws_secret:
                env["AWS_ACCESS_KEY_ID"] = aws_key
                env["AWS_SECRET_ACCESS_KEY"] = aws_secret
                if user.get("aws_region"):
                    env["AWS_DEFAULT_REGION"] = user["aws_region"]
                env.pop("AWS_PROFILE", None)
        else:
            # Use host configurations with selected context/profile
            if user.get("active_context"):
                env["KUBECONTEXT"] = user["active_context"]
            if user.get("active_profile"):
                env["AWS_PROFILE"] = user["active_profile"]

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