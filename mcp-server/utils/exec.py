import subprocess
import os

def run(cmd: str, timeout: int = 30) -> str:
    # Auto-inject Kubernetes context if specified in environment
    kubecontext = os.environ.get("KUBECONTEXT")
    if kubecontext and "kubectl" in cmd:
        cmd = cmd.replace("kubectl ", f"kubectl --context {kubecontext} ")

    # Auto-inject AWS profile if specified in environment
    awsprofile = os.environ.get("AWS_PROFILE")
    if awsprofile and "aws" in cmd:
        cmd = cmd.replace("aws ", f"aws --profile {awsprofile} ")

    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True,
            text=True, timeout=timeout
        )
        return result.stdout or result.stderr or "No output"
    except subprocess.TimeoutExpired:
        return f"Error: command timed out after {timeout}s"
    except Exception as e:
        return f"Error: {str(e)}"