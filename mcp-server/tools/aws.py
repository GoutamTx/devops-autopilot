import time
from mcp.types import Tool, TextContent
from utils.exec import run

AWS_TOOLS = [
    Tool(name="list_ec2",
         description="List EC2 instances with name, type, state, private IP.",
         inputSchema={"type":"object","properties":{
             "region":{"type":"string","default":"us-east-1"},
             "state":{"type":"string","enum":["running","stopped","all"],"default":"running"}
         }}),
    Tool(name="audit_security_groups",
         description="Find security groups with unrestricted inbound (0.0.0.0/0). Use for security audits.",
         inputSchema={"type":"object","properties":{
             "region":{"type":"string","default":"us-east-1"}
         }}),
    Tool(name="get_cloudwatch_logs",
         description="Fetch recent CloudWatch logs. Use when debugging Lambda, ECS, or EC2.",
         inputSchema={"type":"object","required":["log_group"],"properties":{
             "log_group":{"type":"string"},
             "minutes":{"type":"integer","default":30},
             "region":{"type":"string","default":"us-east-1"}
         }}),
    Tool(name="get_cost_by_service",
         description="AWS cost breakdown by service for a date range.",
         inputSchema={"type":"object","required":["start","end"],"properties":{
             "start":{"type":"string","description":"YYYY-MM-DD"},
             "end":{"type":"string","description":"YYYY-MM-DD"}
         }}),
    Tool(name="list_s3_buckets",
         description="List all S3 buckets, optionally checking public access status.",
         inputSchema={"type":"object","properties":{
             "check_public":{"type":"boolean","default":False}
         }}),
    Tool(name="list_rds_instances",
         description="List RDS instances with engine, status, and endpoint.",
         inputSchema={"type":"object","properties":{
             "region":{"type":"string","default":"us-east-1"}
         }}),
    Tool(name="list_lambda_functions",
         description="List Lambda functions with runtime and last modified.",
         inputSchema={"type":"object","properties":{
             "region":{"type":"string","default":"us-east-1"}
         }}),
    Tool(name="get_iam_roles",
         description="List IAM roles. Flags any with AdministratorAccess.",
         inputSchema={"type":"object","properties":{}}),
]

async def handle_aws(name: str, args: dict) -> list:
    out = ""
    region = args.get("region", "us-east-1")

    if name == "list_ec2":
        state  = args.get("state", "running")
        f_arg  = f"--filters Name=instance-state-name,Values={state}" if state != "all" else ""
        query  = "Reservations[*].Instances[*].{Name:Tags[?Key==`Name`].Value|[0],ID:InstanceId,Type:InstanceType,State:State.Name,IP:PrivateIpAddress}"
        out    = run(f"aws ec2 describe-instances {f_arg} --region {region} --query '{query}' --output table")

    elif name == "audit_security_groups":
        out = run(
            f"aws ec2 describe-security-groups --region {region} "
            f"--filters Name=ip-permission.cidr,Values=0.0.0.0/0 "
            f"--query 'SecurityGroups[*].{{ID:GroupId,Name:GroupName,Ports:IpPermissions[*].FromPort}}' "
            f"--output table"
        )

    elif name == "get_cloudwatch_logs":
        start_ms = int(time.time() * 1000) - (args.get("minutes", 30) * 60 * 1000)
        out = run(
            f"aws logs filter-log-events "
            f"--log-group-name \"{args['log_group']}\" "
            f"--start-time {start_ms} --region {region} "
            f"--query 'events[*].message' --output text"
        )

    elif name == "get_cost_by_service":
        out = run(
            f"aws ce get-cost-and-usage "
            f"--time-period Start={args['start']},End={args['end']} "
            f"--granularity MONTHLY --metrics BlendedCost "
            f"--group-by Type=DIMENSION,Key=SERVICE "
            f"--query 'ResultsByTime[*].Groups[*].{{Service:Keys[0],Cost:Metrics.BlendedCost.Amount}}' "
            f"--output table"
        )

    elif name == "list_s3_buckets":
        out = run("aws s3 ls")
        if args.get("check_public"):
            buckets = run("aws s3api list-buckets --query 'Buckets[*].Name' --output text")
            rows = [out, "\n--- Public Access Status ---"]
            for b in buckets.split():
                status = run(f"aws s3api get-public-access-block --bucket {b} "
                             f"--query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>&1")
                rows.append(f"{b}: blocked={status.strip()}")
            out = "\n".join(rows)

    elif name == "list_rds_instances":
        out = run(
            f"aws rds describe-db-instances --region {region} "
            f"--query 'DBInstances[*].{{ID:DBInstanceIdentifier,Engine:Engine,Status:DBInstanceStatus,Endpoint:Endpoint.Address}}' "
            f"--output table"
        )

    elif name == "list_lambda_functions":
        out = run(
            f"aws lambda list-functions --region {region} "
            f"--query 'Functions[*].{{Name:FunctionName,Runtime:Runtime,Modified:LastModified}}' "
            f"--output table"
        )

    elif name == "get_iam_roles":
        out = run(
            "aws iam list-roles "
            "--query 'Roles[*].{Name:RoleName,Created:CreateDate}' "
            "--output table"
        )
        # check for admin roles
        admin = run(
            "aws iam list-entities-for-policy "
            "--policy-arn arn:aws:iam::aws:policy/AdministratorAccess "
            "--query 'PolicyRoles[*].RoleName' --output text 2>&1"
        )
        out += f"\n\n--- Roles with AdministratorAccess ---\n{admin}"

    return [TextContent(type="text", text=out)]