import asyncio
import os
# Reload triggered for new MCP tools
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from datetime import datetime, timezone
import json
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from mcp_bridge import call_mcp_tool
from claude import chat
from tools_cache import get_cached_tools   # see below

# Authentication & Database imports
from auth import get_current_user, require_admin, verify_password, create_access_token
from database import (
    get_user_by_username,
    get_request_by_id,
    update_request_status,
    get_all_requests,
    get_db_connection,
)

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

class LoginRequest(BaseModel):
    username: str
    password: str

class ReviewRequest(BaseModel):
    status: str

class ConfigUpdateRequest(BaseModel):
    context: str | None = None
    profile: str | None = None

class CredentialsUpdateRequest(BaseModel):
    target_mode: str
    kubeconfig_yaml: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str | None = None

class CreateRequestInput(BaseModel):
    tool_name: str
    tool_input: dict



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

def get_local_options():
    import subprocess
    contexts = []
    try:
        res = subprocess.run("kubectl config get-contexts -o name", shell=True, capture_output=True, text=True, timeout=5)
        contexts = [c.strip() for c in res.stdout.splitlines() if c.strip()]
    except Exception:
        pass
        
    profiles = []
    try:
        res = subprocess.run("aws configure list-profiles", shell=True, capture_output=True, text=True, timeout=5)
        profiles = [p.strip() for p in res.stdout.splitlines() if p.strip()]
    except Exception:
        pass
        
    return {"contexts": contexts, "profiles": profiles}

@app.get("/config/options")
def list_config_options(current_user: dict = Depends(get_current_user)):
    return get_local_options()

@app.get("/config/active")
def get_active_config(current_user: dict = Depends(get_current_user)):
    return {
        "context": current_user.get("active_context"),
        "profile": current_user.get("active_profile")
    }

@app.post("/config/active")
def set_active_config(req: ConfigUpdateRequest, current_user: dict = Depends(get_current_user)):
    from database import update_user_config
    update_user_config(current_user["id"], req.context, req.profile)
    return {"status": "ok", "context": req.context, "profile": req.profile}

@app.get("/config/credentials")
def get_user_credentials(current_user: dict = Depends(get_current_user)):
    return {
        "target_mode": current_user.get("target_mode", "host"),
        "has_kubeconfig": bool(current_user.get("kubeconfig_yaml")),
        "has_aws": bool(current_user.get("aws_access_key_id") and current_user.get("aws_secret_access_key")),
        "aws_region": current_user.get("aws_region")
    }

@app.post("/config/credentials")
def set_user_credentials(req: CredentialsUpdateRequest, current_user: dict = Depends(get_current_user)):
    from database import update_user_credentials
    update_user_credentials(
        current_user["id"],
        req.target_mode,
        req.kubeconfig_yaml,
        req.aws_access_key_id,
        req.aws_secret_access_key,
        req.aws_region
    )
    return {"status": "ok"}

@app.post("/auth/login")
def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    token = create_access_token({"sub": user["username"], "id": user["id"], "role": user["role"]})
    return {"token": token, "username": user["username"], "role": user["role"]}

@app.get("/admin/requests")
def list_admin_requests(current_user: dict = Depends(require_admin)):
    return {"requests": get_all_requests()}

@app.post("/admin/requests/{id}/review")
def review_request(id: int, req: ReviewRequest, current_user: dict = Depends(require_admin)):
    r = get_request_by_id(id)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if r["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is already resolved")
    if req.status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be approved or denied")
    
    update_request_status(id, req.status, current_user["id"])
    return {"status": "ok", "request_id": id, "new_status": req.status}

@app.get("/requests")
def list_user_requests(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    if current_user["role"] == "admin":
        cursor.execute("""
            SELECT r.*, u.username as requester_name, rev.username as reviewer_name
            FROM approval_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users rev ON r.reviewed_by = rev.id
            ORDER BY r.created_at DESC
        """)
    else:
        cursor.execute("""
            SELECT r.*, u.username as requester_name, rev.username as reviewer_name
            FROM approval_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users rev ON r.reviewed_by = rev.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        """, (current_user["id"],))
    rows = cursor.fetchall()
    conn.close()
    return {"requests": [dict(r) for r in rows]}

@app.post("/requests/submit")
def submit_new_request(req: CreateRequestInput, current_user: dict = Depends(get_current_user)):
    from database import create_approval_request
    request_id = create_approval_request(current_user["id"], req.tool_name, req.tool_input)
    return {"status": "ok", "request_id": request_id}


@app.post("/chat/execute-request/{id}")
async def execute_approved_request(id: int, current_user: dict = Depends(get_current_user)):
    r = get_request_by_id(id)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Verify ownership or admin rights
    if current_user["role"] != "admin" and r["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to execute this request")
        
    if r["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"Request is not approved (current status: {r['status']})")
        
    # Execute the tool
    tool_name = r["tool_name"]
    tool_input = json.loads(r["tool_input"])
    
    try:
        from database import get_user_by_id
        requester = get_user_by_id(r["user_id"])
        
        result_text = await call_mcp_tool(tool_name, tool_input, requester)
        update_request_status(id, "executed")
        return {"status": "executed", "result": result_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing tool: {str(e)}")

@app.get("/tools")
async def list_tools(current_user: dict = Depends(get_current_user)):
    tools = await get_cached_tools()
    return {"tools": tools}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    tools = await get_cached_tools()
    result = await chat(req.messages, tools, current_user)
    return result

@app.get("/k8s/dashboard")
async def k8s_dashboard(current_user: dict = Depends(get_current_user)):
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
async def chat_stream_endpoint(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    tools = await get_cached_tools()
    from claude import chat_stream
    return StreamingResponse(
        chat_stream(req.messages, tools, current_user),
        media_type="text/event-stream"
    )