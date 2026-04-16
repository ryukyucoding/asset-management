# Build context: repo root  →  docker build -f frontend/Dockerfile .
#
# ── Stage 1: Build Vue app ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN npm install -g pnpm@10.32.1
WORKDIR /app

# Copy root workspace manifest
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy frontend package.json for dependency resolution
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter frontend

COPY frontend/ ./frontend/
WORKDIR /app/frontend

# VITE_API_URL is baked into the JS bundle at build time.
# Pass the production backend URL via --build-arg:
#   docker build --build-arg VITE_API_URL=https://api.yourdomain.com -f frontend/Dockerfile .
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm build

# ── Stage 2: Serve with Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
