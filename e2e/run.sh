#!/usr/bin/env bash
# Test end-to-end di Linko nel browser del servizio `browser` (Playwright).
#
#   ./e2e/run.sh
#
# Crea un utente temporaneo (uitest-…@example.invalid) con una fonte a feed,
# esegue e2e/smoke.js dentro linko-browser-1 e alla fine cancella l'utente.
# Richiede Linko avviato (docker compose up) e il .env nella cartella del progetto.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${LINKO_API:-http://localhost:3000/api/v1}"
BROWSER="${LINKO_BROWSER_CONTAINER:-linko-browser-1}"
POSTGRES="${LINKO_POSTGRES_CONTAINER:-linko-postgres-1}"
WORK=/tmp/linko-e2e

set -a; . "$ROOT/.env"; set +a

psql_q() {
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES" psql -h 127.0.0.1 -U linko -d linkodb -tAc "$1"
}

EMAIL="uitest-$(date +%s)-$RANDOM@example.invalid"
PASSWORD="Test-$(openssl rand -hex 12)"

cleanup() {
  # Solo utenti di test: il filtro sull'email evita qualsiasi altro account
  psql_q "delete from \"User\" where email = '$EMAIL' and email like 'uitest-%@example.invalid';" >/dev/null || true
  docker exec "$BROWSER" rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

echo "· utente di prova $EMAIL"
REG=$(curl -sf -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"UI test\"}")
TOKEN=$(printf '%s' "$REG" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')

curl -sf -o /dev/null -X POST "$API/watch/sources" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"War on the Rocks","url":"https://warontherocks.com/","feedUrl":"https://warontherocks.com/feed/","category":"Notizie"}'

# Playwright è installato da npx nell'immagine del servizio browser
PW=$(docker exec "$BROWSER" sh -c 'dirname "$(find /root/.npm/_npx -path "*node_modules/playwright-core/package.json" | head -1)"')
[ -n "$PW" ] || { echo "playwright-core non trovato in $BROWSER"; exit 1; }

docker exec "$BROWSER" mkdir -p "$WORK"
docker cp "$ROOT/e2e/smoke.js" "$BROWSER:$WORK/smoke.js"
printf '%s' "$REG" | docker exec -i "$BROWSER" sh -c "cat > $WORK/auth.json"

docker exec -w "$WORK" -e PW="$PW" -e WORK="$WORK" "$BROWSER" node smoke.js
