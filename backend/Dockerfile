FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/v1.29.2/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY backend/requirements.txt /app/backend/requirements.txt
COPY mcp-server/requirements.txt /app/mcp-server/requirements.txt

# Install python dependencies for both backend and mcp-server
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/mcp-server/requirements.txt

# Copy the backend and mcp-server directories
COPY backend/ /app/backend/
COPY mcp-server/ /app/mcp-server/

WORKDIR /app/backend

# Expose port
EXPOSE 8000

# Command to run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
