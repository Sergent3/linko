FROM node:20-alpine AS base
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────────────
# node_modules montato dall'host (con binary Prisma musl pre-generati)
FROM base AS development
CMD ["node_modules/.bin/tsx", "watch", "src/index.ts"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx tsc

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
CMD ["node", "dist/index.js"]
