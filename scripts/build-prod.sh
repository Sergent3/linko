#!/bin/sh
# Compila backend e worker (TypeScript → dist/) e li riavvia in modalità produzione.
#
#   ./scripts/build-prod.sh            # entrambi
#   ./scripts/build-prod.sh worker     # solo uno
#
# tsc gira in un container con apparmor=unconfined: su questo host AppArmor
# vieta di avviare processi dentro docker build (vedi frontend/build-prod.sh).
set -e
cd "$(dirname "$0")/.."
SERVICES="${*:-backend worker}"
for svc in $SERVICES; do
  echo "· compilo $svc"
  docker run --rm --security-opt apparmor=unconfined --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PWD/$svc":/app -w /app node:20-alpine \
    sh -c 'rm -rf dist && npx tsc -p . && node -e "require(\"fs\").accessSync(\"dist/index.js\")"'
done
docker compose up -d --build --no-deps $SERVICES
