from mcp.types import Tool, TextContent
from utils.exec import run

K8S_TOOLS = [
    Tool(
        name="get_pods",
        description="List pods with status and node. Use when asked about running/failing/pending pods. To list all pods do not pass status parameter.",
        inputSchema={
            "type": "object",
            "properties": {
                "namespace": {
                    "type": "string",
                    "description": "K8s namespace. Omit for all namespaces."
                },
                "status": {
                    "type": "string",
                    "enum": ["Running", "Failed", "Pending", "CrashLoopBackOff"],
                    "description": "Filter by status. Omit this field entirely to get all pods."
                }
            },
            "additionalProperties": False
        }
    ),
    Tool(name="get_pod_logs",
         description="Get stdout/stderr from a pod. Use when debugging crashes or errors.",
         inputSchema={"type":"object","required":["pod"],"properties":{
             "pod":{"type":"string"},
             "namespace":{"type":"string","default":"default"},
             "lines":{"type":"integer","default":50},
             "previous":{"type":"boolean","default":False}
         }}),
    Tool(name="get_events",
         description="Get K8s events sorted by time. Best first tool when something is broken.",
         inputSchema={"type":"object","properties":{
             "namespace":{"type":"string"}
         }}),
    Tool(name="describe_resource",
         description="kubectl describe: pod, deployment, service, node, pvc, ingress",
         inputSchema={"type":"object","required":["kind","name"],"properties":{
             "kind":{"type":"string"},
             "name":{"type":"string"},
             "namespace":{"type":"string"}
         }}),
    Tool(name="get_deployments",
         description="List deployments with desired vs ready replicas.",
         inputSchema={"type":"object","properties":{
             "namespace":{"type":"string"}
         }}),
    Tool(name="rollout_restart",
         description="Restart a deployment by doing a rollout restart.",
         inputSchema={"type":"object","required":["deployment"],"properties":{
             "deployment":{"type":"string"},
             "namespace":{"type":"string","default":"default"}
         }}),
    Tool(name="scale_deployment",
         description="Scale a deployment to N replicas.",
         inputSchema={"type":"object","required":["deployment","replicas"],"properties":{
             "deployment":{"type":"string"},
             "replicas":{"type":"integer"},
             "namespace":{"type":"string","default":"default"}
         }}),
    Tool(name="get_nodes",
         description="List cluster nodes with status, roles, and resource pressure.",
         inputSchema={"type":"object","properties":{}}),
    Tool(name="get_services",
         description="List services and their endpoints/ports.",
         inputSchema={"type":"object","properties":{
             "namespace":{"type":"string"}
         }}),
    Tool(name="apply_manifest",
         description="Apply a YAML manifest. Dry-runs by default unless confirmed.",
         inputSchema={"type":"object","required":["yaml"],"properties":{
             "yaml":{"type":"string"},
             "dry_run":{"type":"boolean","default":True}
         }}),
]

async def handle_k8s(name: str, args: dict) -> list:
    out = ""

    if name == "get_pods":
        ns = f"-n {args['namespace']}" if args.get("namespace") else "--all-namespaces"
        out = run(f"kubectl get pods {ns} -o wide")
        if status := args.get("status"):
            lines = [l for l in out.splitlines() if status in l or l.startswith("NAME")]
            out = "\n".join(lines) or f"No pods with status: {status}"

    elif name == "get_pod_logs":
        ns   = args.get("namespace", "default")
        prev = "--previous" if args.get("previous") else ""
        out  = run(f"kubectl logs {args['pod']} -n {ns} --tail={args.get('lines',50)} {prev}")

    elif name == "get_events":
        ns  = f"-n {args['namespace']}" if args.get("namespace") else "--all-namespaces"
        out = run(f"kubectl get events {ns} --sort-by='.lastTimestamp'")

    elif name == "describe_resource":
        ns  = f"-n {args['namespace']}" if args.get("namespace") else ""
        out = run(f"kubectl describe {args['kind']} {args['name']} {ns}")

    elif name == "get_deployments":
        ns  = f"-n {args['namespace']}" if args.get("namespace") else "--all-namespaces"
        out = run(f"kubectl get deployments {ns}")

    elif name == "rollout_restart":
        ns  = args.get("namespace", "default")
        out = run(f"kubectl rollout restart deployment/{args['deployment']} -n {ns}")

    elif name == "scale_deployment":
        ns  = args.get("namespace", "default")
        out = run(f"kubectl scale deployment/{args['deployment']} --replicas={args['replicas']} -n {ns}")

    elif name == "get_nodes":
        out = run("kubectl get nodes -o wide") + "\n\n" + run("kubectl describe nodes | grep -A5 'Conditions:'")

    elif name == "get_services":
        ns  = f"-n {args['namespace']}" if args.get("namespace") else "--all-namespaces"
        out = run(f"kubectl get svc {ns}")

    elif name == "apply_manifest":
        flag = "--dry-run=client" if args.get("dry_run", True) else ""
        safe = args["yaml"].replace("'", "'\\''")
        out  = run(f"echo '{safe}' | kubectl apply {flag} -f -")

    return [TextContent(type="text", text=out)]