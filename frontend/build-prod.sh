#!/bin/sh
# Build ottimizzata del frontend e riavvio del container.
# `next build` deve poter avviare processi: su questo host AppArmor lo vieta dentro
# docker build, quindi la build gira in un container con apparmor=unconfined
# (come il backend) e l'immagine copia solo il risultato (stage "prebuilt").
set -e
cd "$(dirname "$0")"
docker build -q --target development -t linko-frontend-deps . >/dev/null
docker run --rm --security-opt apparmor=unconfined \
  -e INTERNAL_API_URL=http://backend:3001 -e NEXT_TELEMETRY_DISABLED=1 \
  -v "$PWD":/app -v /app/node_modules -w /app \
  linko-frontend-deps sh -c "npm run build && chown -R $(id -u):$(id -g) .next"
cd .. && docker compose up -d --build --no-deps frontend
