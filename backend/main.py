import asyncio
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from datetime import datetime, timezone
import json
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from mcp_bridge import call_mcp_tool
from claude import chat
from tools_cache import get_cached_tools   # see below

load_dotenv()

app = FastAPI(title="DevOps Autopilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# ── request/response models ──────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list = []        # full conversation history
    
class ChatResponse(BaseModel):
    response: str
    tool_calls: list
    updated_messages: list


# ── routes ───────────────────────────────────────────────────────
def get_age(creation_timestamp: str) -> str:
    if not creation_timestamp:
        return "unknown"
    try:
        ts = creation_timestamp.replace("Z", "+00:00")
        created = datetime.fromisoformat(ts)
        now = datetime.now(timezone.utc)
        diff = now - created
        
        days = diff.days
        hours, remainder = divmod(diff.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if days > 0:
            return f"{days}d{hours}h"
        if hours > 0:
            return f"{hours}h{minutes}m"
        if minutes > 0:
            return f"{minutes}m{seconds}s"
        return f"{seconds}s"
    except Exception:
        return "unknown"


def get_pod_status(pod: dict) -> str:
    status = pod.get("status", {})
    phase = status.get("phase", "Unknown")
    
    if pod.get("metadata", {}).get("deletionTimestamp"):
        return "Terminating"
        
    reason = status.get("reason")
    if reason:
        return reason
        
    # Check init containers
    init_statuses = status.get("initContainerStatuses", [])
    for cs in init_statuses:
        state = cs.get("state", {})
        if "waiting" in state:
            w = state["waiting"]
            return w.get("reason", "Init:Waiting")
        elif "terminated" in state:
            t = state["terminated"]
            if t.get("exitCode", 0) != 0:
                return "Init:Error"
                
    # Check containers
    container_statuses = status.get("containerStatuses", [])
    for cs in container_statuses:
        state = cs.get("state", {})
        if "waiting" in state:
            w = state["waiting"]
            return w.get("reason", "Waiting")
        elif "terminated" in state:
            t = state["terminated"]
            if "reason" in t:
                return t["reason"]
            elif t.get("exitCode", 0) != 0:
                return "Error"
                
    return phase


async def run_kubectl_json(args: list) -> dict:
    cmd = ["kubectl"] + args + ["-o", "json"]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            return {"items": []}
        return json.loads(stdout.decode())
    except Exception:
        return {"items": []}


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/tools")
async def list_tools():
    tools = await get_cached_tools()
    return {"tools": tools}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    tools = await get_cached_tools()
    result = await chat(req.messages, tools)
    return result

@app.get("/k8s/dashboard")
async def k8s_dashboard():
    # Fetch all K8s data in parallel
    pods_task = run_kubectl_json(["get", "pods", "-A"])
    nodes_task = run_kubectl_json(["get", "nodes"])
    deployments_task = run_kubectl_json(["get", "deployments", "-A"])
    services_task = run_kubectl_json(["get", "svc", "-A"])
    events_task = run_kubectl_json(["get", "events", "-A"])
    
    pods_data, nodes_data, deployments_data, services_data, events_data = await asyncio.gather(
        pods_task, nodes_task, deployments_task, services_task, events_task
    )
    
    # Process Pods and compute counts
    running_pods = 0
    failed_pods = 0
    pods_list = []
    
    for item in pods_data.get("items", []):
        name = item.get("metadata", {}).get("name", "")
        namespace = item.get("metadata", {}).get("namespace", "")
        node = item.get("spec", {}).get("nodeName", "")
        age = get_age(item.get("metadata", {}).get("creationTimestamp"))
        status_str = get_pod_status(item)
        
        if status_str == "Running":
            running_pods += 1
        elif status_str not in ["Running", "Pending", "Succeeded", "Completed"]:
            failed_pods += 1
            
        pods_list.append({
            "name": name,
            "namespace": namespace,
            "status": status_str,
            "node": node,
            "age": age
        })
        
    # Process Deployments
    deployments_list = []
    for item in deployments_data.get("items", []):
        name = item.get("metadata", {}).get("name", "")
        namespace = item.get("metadata", {}).get("namespace", "")
        desired = item.get("spec", {}).get("replicas", 1)
        ready = item.get("status", {}).get("readyReplicas", 0)
        
        deployments_list.append({
            "name": name,
            "namespace": namespace,
            "desired": desired,
            "ready": ready,
            "is_out_of_sync": desired != ready
        })
        
    # Process Events (Sort by time descending and take top 10)
    event_list = []
    for item in events_data.get("items", []):
        involved = item.get("involvedObject", {})
        obj_str = f"{involved.get('kind', '')}/{involved.get('name', '')}"
        
        ts = item.get("lastTimestamp") or item.get("metadata", {}).get("creationTimestamp") or ""
        
        event_list.append({
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "object": obj_str,
            "message": item.get("message", ""),
            "timestamp": ts
        })
        
    event_list.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_events = event_list[:10]
    
    # Overview metrics
    total_pods = len(pods_list)
    total_nodes = len(nodes_data.get("items", []))
    total_deployments = len(deployments_list)
    total_services = len(services_data.get("items", []))
    
    return {
        "overview": {
            "totalPods": total_pods,
            "runningPods": running_pods,
            "failedPods": failed_pods,
            "totalNodes": total_nodes,
            "totalDeployments": total_deployments,
            "totalServices": total_services
        },
        "pods": pods_list,
        "deployments": deployments_list,
        "events": recent_events
    }

@app.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    tools = await get_cached_tools()
    from claude import chat_stream
    return StreamingResponse(
        chat_stream(req.messages, tools),
        media_type="text/event-stream"
    )