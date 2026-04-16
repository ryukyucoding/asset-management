# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build TypeScript ─────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# Generate Prisma Client before compiling TypeScript
RUN pnpm db:generate
RUN pnpm build

# ── Stage 3: Production image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
ENV NODE_ENV=production

# Install production-only dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema + generated client
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled app
COPY --from=builder /app/dist ./dist

# Create uploads dir (only used when STORAGE_DRIVER=local)
RUN mkdir -p uploads

EXPOSE 3000

# Run DB migrations then start server
# On Cloud Run migrations run fast (idempotent); only pending ones are applied.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
