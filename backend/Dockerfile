# Build context: repo root  →  docker build -f backend/Dockerfile .
#
# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN npm install -g pnpm@10.32.1
WORKDIR /app

# Copy root workspace manifest so pnpm can resolve the workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy backend package.json for dependency resolution
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter asset-management-backend

# ── Stage 2: Build TypeScript ──────────────────────────────────────────────────
FROM deps AS builder
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm db:generate && pnpm build

# ── Stage 3: Production image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled app and all node_modules (includes Prisma client)
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend_modules

# Copy Prisma schema for migrate deploy at startup
COPY backend/prisma ./prisma

# Create uploads dir (used when STORAGE_DRIVER=local)
RUN mkdir -p uploads

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
