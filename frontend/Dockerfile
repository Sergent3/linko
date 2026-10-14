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
# Il rewrite /api → backend di next.config viene fissato qui, al momento della build
ARG INTERNAL_API_URL=http://backend:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production
# HOSTNAME: senza, il server standalone ascolta solo sull'indirizzo del nome del container
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# ── Production da build già fatta ────────────────────────────────────────────
# Su questo host AppArmor impedisce a `next build` di avviare processi dentro
# docker build: la build la fa build-prod.sh in un container senza AppArmor,
# qui si copia solo il risultato (.next/standalone).
FROM base AS prebuilt
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
