FROM node:20-alpine AS base
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────────────
# node_modules viene preparato durante il build con --ignore-scripts
# (AppArmor blocca i postinstall scripts); le anonymous volumes in docker-compose
# preservano questo layer e impediscono che il mount dell'host li sovrascriva.
FROM base AS development
COPY package*.json ./
RUN npm install --ignore-scripts
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
