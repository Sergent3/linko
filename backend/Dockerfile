FROM node:20-alpine AS base
WORKDIR /app

# ── Development: hot-reload via tsx ──────────────────────────────────────────
# node_modules è montato dall'host via volume (con binary Prisma musl pre-generati)
FROM base AS development
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "watch", "src/index.ts"]

# ── Prebuilt: codice compilato da scripts/build-prod.sh ───────────────────────
# Il codice (dist/ e node_modules con i binary Prisma musl) è montato dall'host:
# tsc gira fuori da docker build perché AppArmor vieta di avviare processi lì dentro.
FROM base AS prebuilt
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "--enable-source-maps", "dist/index.js"]

# ── Builder: compila TypeScript ───────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npx tsc

# ── Production: immagine leggera ──────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
