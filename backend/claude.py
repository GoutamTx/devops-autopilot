import os
import asyncio
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """You are DevOps Autopilot — an expert DevOps AI assistant with direct, read-write access to a Kubernetes cluster. Your goal is to help users monitor, troubleshoot, and manage their cluster efficiently and safely.

### 1. Tool Mapping Rules
When the user asks about the cluster, you MUST call the appropriate tool(s):
- "show pods" / "list pods" → `get_pods()`
- "show logs" / "pod logs" → `get_pod_logs(pod_name)`
- "show deployments" → `get_deployments()`
- "show services" → `get_services()`
- "show nodes" → `get_nodes()`
- "describe X" (where X is a resource type and name) → `describe_resource(resource_type, resource_name)`
- "delete pod X" / "kill pod X" → `delete_pod(pod=X)`
- "run pod X with image Y" → `run_pod(name=X, image=Y)`

### 2. Multi-Step Troubleshooting ("What's broken?" / "Any issues?")
If the user asks for general troubleshooting or reports an issue without specifying a pod, you must execute a 2-step investigation:
1. First, call `get_events()` to look for recent cluster warnings, BackOff errors, or scheduling failures.
2. Second, call `get_pods()` to check for non-Running or non-Ready states (e.g., CrashLoopBackOff, ImagePullBackOff, Pending).
Combine these insights into your final response.

### 3. Safety Guardrails
- ALWAYS ask the user for confirmation before calling `delete_pod()` or `run_pod()`. Explain what you are going to do and wait for their approval.
- ALWAYS set `dry_run=true` when calling `apply_manifest()` by default.
- You may only set `dry_run=false` (actually applying changes) if the user explicitly grants permission using phrases like "apply it", "yes do it", or "go ahead".

### 4. Response Guidelines
- **Concise & Actionable:** Do not dump raw JSON or endless log lines. Summarize the root cause in 2–3 sentences.
- **Next Steps:** Always suggest the exact next command or fix the user should apply (e.g., "The image tag is wrong. Would you like me to update the deployment with the correct image?")."""
# SYSTEM_PROMPT = """You are DevOps Autopilot — a DevOps AI assistant with direct access 
# to Kubernetes. You have tools to inspect pods, logs, events, deployments, services, and nodes.

# When the user asks about their cluster, you MUST call the appropriate tool:
# - "show pods" or "list pods" → call get_pods
# - "show logs" or "pod logs" → call get_pod_logs
# - "what's broken" or "any issues" → call get_events then get_pods
# - "show deployments" → call get_deployments
# - "show services" → call get_services
# - "show nodes" → call get_nodes
# - "describe X" → call describe_resource

# Always dry_run=true for apply_manifest unless user explicitly says "apply it" or "yes do it".
# Be concise and actionable in your summaries."""


def build_tools(tools: list):
    declarations = []
    for t in tools:
        properties = {}
        for k, v in t["input_schema"].get("properties", {}).items():
            type_map = {
                "string":  types.Type.STRING,
                "integer": types.Type.INTEGER,
                "boolean": types.Type.BOOLEAN,
                "number":  types.Type.NUMBER,
                "array":   types.Type.ARRAY,
                "object":  types.Type.OBJECT,
            }
            prop_type = type_map.get(v.get("type", "string"), types.Type.STRING)
            schema_kwargs = {
                "type":        prop_type,
                "description": v.get("description", ""),
            }
            if "enum" in v:
                schema_kwargs["enum"] = v["enum"]

            properties[k] = types.Schema(**schema_kwargs)

        declarations.append(types.FunctionDeclaration(
            name=t["name"],
            description=t["description"],
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties=properties,
                required=t["input_schema"].get("required", [])
            )
        ))
    return declarations


async def chat(messages: list, tools: list, user: dict = None) -> dict:
    tool_calls_made = []

    # convert messages to Gemini Content format
    contents = []
    for m in messages:
        if isinstance(m.get("content"), str) and m["content"].strip():
            role = "user" if m["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part(text=m["content"])]
            ))

    gemini_tools = [types.Tool(function_declarations=build_tools(tools))]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=gemini_tools,
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO")
        )
    )

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        #model="gemini-2.5-flash-lite",
        contents=contents,
        config=config
    )

    # agentic loop — keep calling tools until Claude is done
    max_iterations = 5
    for _ in range(max_iterations):

        # collect any function calls from the response
        fn_calls = []
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                    fn_calls.append(part.function_call)

        if not fn_calls:
            break

        # add model's response (with tool calls) to contents
        contents.append(response.candidates[0].content)

        # execute each tool and collect results
        tool_result_parts = []
        for fn in fn_calls:
            args = dict(fn.args) if fn.args else {}
            tool_calls_made.append({"tool": fn.name, "input": args})

            is_restricted = fn.name in ["rollout_restart", "scale_deployment", "apply_manifest", "delete_pod", "run_pod"]
            if user and user.get("role") != "admin" and is_restricted:
                result_text = f"Action intercepted: The action '{fn.name}' requires manager approval. It has NOT been submitted yet. The user must confirm if they want to submit this request."
            else:
                from mcp_bridge import call_mcp_tool
                result_text = await call_mcp_tool(fn.name, args, user)

            tool_result_parts.append(types.Part(
                function_response=types.FunctionResponse(
                    name=fn.name,
                    response={"result": result_text}
                )
            ))

        # feed tool results back to the model
        contents.append(types.Content(role="user", parts=tool_result_parts))

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            #model="gemini-2.5-flash-lite",
            contents=contents,
            config=config
        )

    # extract final text response
    final_text = ""
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if hasattr(part, "text") and part.text:
                final_text += part.text

    return {
        "response": final_text,
        "tool_calls": tool_calls_made,
        "updated_messages": messages + [{"role": "assistant", "content": final_text}]
    }


async def chat_stream(messages: list, tools: list, user: dict = None):
    tool_calls_made = []

    # convert messages to Gemini Content format
    contents = []
    for m in messages:
        if isinstance(m.get("content"), str) and m["content"].strip():
            role = "user" if m["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part(text=m["content"])]
            ))

    gemini_tools = [types.Tool(function_declarations=build_tools(tools))]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=gemini_tools,
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO")
        )
    )

    max_iterations = 5
    final_text = ""

    for _ in range(max_iterations):
        response_stream = await client.aio.models.generate_content_stream(
            model="gemini-3.1-flash-lite",
            contents=contents,
            config=config
        )

        fn_calls = []
        model_parts = []

        async for chunk in response_stream:
            if chunk.text:
                final_text += chunk.text
                model_parts.append(types.Part(text=chunk.text))
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"

            if chunk.candidates:
                for candidate in chunk.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                                fn_calls.append(part.function_call)
                                model_parts.append(part)
                                args = dict(part.function_call.args) if part.function_call.args else {}
                                tool_calls_made.append({"tool": part.function_call.name, "input": args})
                                yield f"data: {json.dumps({'type': 'tool_call', 'tool': part.function_call.name, 'input': args})}\n\n"

        if not fn_calls:
            break

        contents.append(types.Content(role="model", parts=model_parts))

        tool_result_parts = []
        for fn in fn_calls:
            args = dict(fn.args) if fn.args else {}

            is_restricted = fn.name in ["rollout_restart", "scale_deployment", "apply_manifest", "delete_pod", "run_pod"]
            if user and user.get("role") != "admin" and is_restricted:
                result_text = f"Action intercepted: The action '{fn.name}' requires manager approval. It has NOT been submitted yet. The user must confirm if they want to submit this request."
            else:
                from mcp_bridge import call_mcp_tool
                result_text = await call_mcp_tool(fn.name, args, user)

            # Stream tool result back in real-time
            yield f"data: {json.dumps({'type': 'tool_result', 'tool': fn.name, 'result': result_text})}\n\n"

            tool_result_parts.append(types.Part(
                function_response=types.FunctionResponse(
                    name=fn.name,
                    response={"result": result_text}
                )
            ))

        contents.append(types.Content(role="user", parts=tool_result_parts))

    # Send final done message with full updated conversation details
    yield f"data: {json.dumps({'type': 'done', 'response': final_text, 'tool_calls': tool_calls_made, 'updated_messages': messages + [{'role': 'assistant', 'content': final_text}]})}\n\n"

# import json
# import ollama
# import re
# from mcp_bridge import call_mcp_tool

# SYSTEM_PROMPT = """You are DevOps Autopilot — a DevOps AI assistant with access to AWS and Kubernetes.
# You have tools to manage infrastructure, inspect clusters, and execute operations.

# IMPORTANT: When the user asks about their infrastructure, you MUST call the appropriate tool.
# Return tool calls in this exact JSON format:
# {"name":"tool_name","parameters":{"param1":"value1"}}

# After receiving tool results, provide a clear summary of the findings."""

# async def chat(messages: list, tools: list) -> dict:
#     tool_calls_made = []
#     max_iterations = 5
#     iteration = 0

#     # build messages for ollama
#     ollama_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

#     # agentic loop - iterate until no more tool calls
#     while iteration < max_iterations:
#         iteration += 1
        
#         response = ollama.chat(
#             model="llama3.1",
#             messages=ollama_messages
#         )

#         response_text = response.message.content or ""
        
#         # Parse JSON tool calls from response text
#         # Look for {"name":"...", "parameters":{...}} patterns
#         json_pattern = r'\{"name"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[^}]+\})\}'
#         matches = re.findall(json_pattern, response_text)
        
#         if not matches:
#             # No tool calls found, we're done
#             final_text = response_text
#             break
        
#         # Execute each tool call found
#         tool_results = []
#         for tool_name, params_str in matches:
#             try:
#                 params = json.loads(params_str)
#                 tool_calls_made.append({"tool": tool_name, "input": params})
                
#                 # Call the tool via MCP
#                 result_text = await call_mcp_tool(tool_name, params)
#                 tool_results.append(result_text)
                
#             except (json.JSONDecodeError, Exception) as e:
#                 tool_results.append(f"Error calling {tool_name}: {str(e)}")
        
#         # Add assistant response and tool results to history
#         if tool_results:
#             tool_results_text = "\n".join([f"Tool result: {r}" for r in tool_results])
#             ollama_messages.append({"role": "assistant", "content": response_text})
#             ollama_messages.append({"role": "user", "content": f"Tool execution results:\n{tool_results_text}\n\nPlease summarize these results for the user."})
#         else:
#             # No valid tool calls, return response as-is
#             final_text = response_text
#             break

#     final_text = response.message.content or ""
#     updated_messages = messages + [{"role": "assistant", "content": final_text}]

#     return {
#         "response": final_text,
#         "tool_calls": tool_calls_made,
#         "updated_messages": updated_messages
#     }