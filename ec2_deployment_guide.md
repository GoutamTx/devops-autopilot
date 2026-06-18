# AWS EC2 Deployment Guide - DevOps Autopilot

Follow these steps to deploy the containerized application on a fresh Ubuntu EC2 instance.

---

## Step 1: Launch your EC2 Instance
1. Go to your **AWS Console** -> **EC2** -> **Launch Instance**.
2. **AMI**: Choose `Ubuntu 24.04 LTS` (or `Ubuntu 22.04 LTS`).
3. **Instance Type**: Select at least `t3.medium` or `t3.large` (2 vCPUs, 4GB+ RAM) to comfortably run Docker, Node builds, and any local Kubernetes tools.
4. **Security Group**:
   - Allow **SSH (Port 22)** from your IP.
   - Allow **TCP (Port 8080)** (or Port 80) from anywhere (`0.0.0.0/0`) or restricted IPs, depending on who needs access to the UI.
5. **IAM Role (Highly Recommended)**:
   - Attach an **IAM Instance Profile** to this EC2 instance that has the necessary AWS permissions (e.g., AdministratorAccess or custom DevOps policies) so the container doesn't need static keys.

---

## Step 2: Install Docker and Docker Compose on EC2
Once you SSH into your EC2 instance (`ssh -i your-key.pem ubuntu@your-ec2-ip`), run the following commands to install Docker and Docker Compose:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install prerequisite packages
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker’s official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and plugins
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-v2

# Add your user to the docker group so you don't need 'sudo' for every docker command
sudo usermod -aG docker $USER

# Log out and log back in, or run the following to apply group changes
newgrp docker
```

To verify the installation:
```bash
docker --version
docker compose version
```

---

## Step 3: Setup Credentials on the EC2 Host
The containerized backend mounts `~/.kube` and `~/.aws` from the host VM. You must create and configure these on the EC2 host:

### For AWS:
If you attached an IAM Role to your EC2 instance (recommended), you only need to specify your region:
```bash
mkdir -p ~/.aws
cat <<EOF > ~/.aws/config
[default]
region = us-east-1
EOF
```
If you are NOT using an IAM role and want to use static keys instead:
```bash
aws configure
```

### For Kubernetes:
Choose one of the options below to configure Kubernetes on the EC2 instance:

#### Option 1: Run Minikube on the EC2 Instance (Free / Local testing)
Running Minikube directly on the EC2 VM is free and doesn't require any cloud provider cluster costs.

1. **Install Minikube**:
   ```bash
   curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
   sudo install minikube-linux-amd64 /usr/local/bin/minikube
   rm minikube-linux-amd64
   ```

2. **Install kubectl**:
   ```bash
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   rm kubectl
   ```

3. **Start Minikube**:
   ```bash
   # Start minikube with the Docker driver
   minikube start --driver=docker
   ```

> [!NOTE]
> Once Minikube starts, it will **automatically** generate all the configuration files and certificates in `~/.kube` and `~/.minikube` on the EC2 host. **You do NOT need to copy any files** from your laptop. The docker-compose setup is pre-configured to mount these folders from the EC2 host automatically.

#### Option 2: Connect to a Managed EKS Cluster (AWS Production)
If you already have a managed cluster running:

1. **Install the AWS CLI**:
   ```bash
   sudo apt install -y awscli
   ```
2. **Fetch the Kubeconfig**:
   ```bash
   aws eks update-kubeconfig --region us-east-1 --name your-eks-cluster-name
   ```

#### Option 3: Copy an existing Kubeconfig manually
If you want to manage a cluster whose config is on your local machine:
```bash
# Run this from your local computer
scp -i your-key.pem ~/.kube/config ubuntu@your-ec2-ip:~/.kube/config
```
*(Note: If your local config references certificates using absolute paths on your computer, ensure you copy those certificate files to the EC2 VM at the exact same path and update the volume mapping).*

---

## Step 4: Clone the Code and Configure Environment
1. Clone your repository to the EC2 host:
   ```bash
   git clone <your-repository-url> ui-mcp-project
   cd ui-mcp-project
   ```
2. Set up your backend environment variables (the Gemini/Anthropic API Key):
   ```bash
   # Create/edit the backend .env
   nano backend/.env
   ```
   Paste your API keys and configuration, e.g.:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   AWS_PROFILE=default
   AWS_REGION=us-east-1
   ```

---

## Step 5: Build and Run the App
From the root of the project (`~/ui-mcp-project`), build and launch the containers:

```bash
docker compose up --build -d
```

### Verification Commands:
- Check container logs to make sure there are no startup errors:
  ```bash
  docker compose logs -f
  ```
- Test that `kubectl` and `aws-cli` work inside the running container:
  ```bash
  docker exec devops-autopilot-backend kubectl get pods --all-namespaces
  docker exec devops-autopilot-backend aws sts get-caller-identity
  ```

---

## Step 6: Access the Application
Open your web browser and navigate to:
```
http://<your-ec2-public-ip>:8080
```

*(Note: Ensure that port `8080` is allowed in your EC2 Security Group rules).*
