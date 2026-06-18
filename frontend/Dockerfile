# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first
COPY package.json package-lock.json ./

# Install packages
RUN npm ci

# Copy source code files
COPY . .

# Run build script
RUN npm run build

# Stage 2: Web Server
FROM nginx:alpine

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configurations
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
