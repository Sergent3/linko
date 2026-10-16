#!/usr/bin/env bash
# Controllo di salute di Linko, da cron ogni 5 minuti:
#
#   */5 * * * * $HOME/linko/scripts/healthcheck.sh
#
# Avvisa solo quando qualcosa cambia (problema nuovo o risolto), così non arriva
# lo stesso messaggio ogni 5 minuti. Canali:
#   - campanella e notifica push di Linko (endpoint interno, segreto del viewer);
#   - Telegram, se esiste ~/.linko-secrets/telegram.env con TELEGRAM_TOKEN e TELEGRAM_CHAT_ID
#     (unico canale che funziona anche con il backend fermo).
# Opzione --dry-run: stampa i problemi trovati senza inviare né salvare lo stato.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${LINKO_HEALTH_STATE:-$HOME/.local/state/linko-health}"
BACKUP_DIR="${LINKO_BACKUP_DIR:-$HOME/backups/postgres/daily}"
VIEWER_ENV="${LINKO_VIEWER_ENV:-$HOME/linko-viewer/.env}"
TELEGRAM_ENV="$HOME/.linko-secrets/telegram.env"
BACKEND="${LINKO_BACKEND:-http://localhost:3001}"
FRONTEND="${LINKO_FRONTEND:-http://localhost:3000}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

mkdir -p "$STATE_DIR"
set -a; . "$ROOT/.env"; set +a

psql_q() {
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" linko-postgres-1 psql -h 127.0.0.1 -U linko -d linkodb -tAc "$1" 2>/dev/null
}

# Problemi attuali: una riga "chiave<TAB>descrizione" ciascuno
problems=()
add() { problems+=("$1"$'\t'"$2"); }

# ── Container ────────────────────────────────────────────────────────────────
for svc in postgres redis backend worker frontend browser; do
  st=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "linko-$svc-1" 2>/dev/null || echo "assente")
  case "$st" in
    "running "|"running healthy"|"running starting") ;;
    *) add "container:$svc" "Il servizio $svc non è attivo ($st)" ;;
  esac
done

# ── Raggiungibilità ──────────────────────────────────────────────────────────
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BACKEND/health")
[ "$code" = "200" ] || add "http:backend" "Il backend non risponde (HTTP $code)"
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$FRONTEND/login")
[ "$code" = "200" ] || add "http:frontend" "L'interfaccia non risponde (HTTP $code)"

# ── Worker: deve controllare le fonti ────────────────────────────────────────
age=$(psql_q "select coalesce(extract(epoch from now() - max(\"startedAt\"))::int, -1) from \"WatchCheck\" where exists (select 1 from \"WatchSource\" where \"isActive\");")
if [ -n "$age" ] && [ "$age" -gt 900 ]; then
  add "worker:stalled" "Il worker non controlla le fonti da $((age / 60)) minuti"
fi

# ── Disco e backup ───────────────────────────────────────────────────────────
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${disk:-0}" -ge 90 ] && add "disk" "Disco quasi pieno: ${disk}% usato"
last=$(find "$BACKUP_DIR" -name 'linkodb-*.dump' -mmin -1560 2>/dev/null | head -1)
[ -n "$last" ] || add "backup" "Nessun backup del database nelle ultime 26 ore"

# ── Fonti in errore persistente (una chiave per fonte) ───────────────────────
# Dal 3° fallimento di fila o sospese dopo troppi errori: gli sbalzi isolati
# (un HTTP 500 passeggero) non generano avvisi
while IFS='|' read -r id name active err; do
  [ -n "$id" ] || continue
  if [ "$active" = t ]; then add "source:$id" "Fonte in errore: $name — ${err:0:160}"
  else add "source:$id" "Fonte sospesa dopo troppi errori: $name — ${err:0:160}"; fi
done < <(psql_q "select id, name, \"isActive\", coalesce(\"lastError\", '') from \"WatchSource\" where status = 'ERROR' and \"failCount\" >= 3;")

# ── Confronto con il giro precedente ─────────────────────────────────────────
now_file=$(mktemp)
printf '%s\n' "${problems[@]+"${problems[@]}"}" | sed '/^$/d' | sort > "$now_file"
prev_file="$STATE_DIR/problems"
[ -f "$prev_file" ] || : > "$prev_file"

new=$(join -t $'\t' -v1 "$now_file" <(cut -f1 "$prev_file" | sort) 2>/dev/null || true)
gone=$(join -t $'\t' -v1 "$prev_file" <(cut -f1 "$now_file" | sort) 2>/dev/null || true)

if [ "$DRY" = 1 ]; then
  echo "Problemi attuali:"; cut -f2 "$now_file" | sed 's/^/  - /'
  echo "Nuovi rispetto al giro precedente:"; printf '%s\n' "$new" | sed '/^$/d' | cut -f2 | sed 's/^/  - /'
  echo "Risolti:"; printf '%s\n' "$gone" | sed '/^$/d' | cut -f2 | sed 's/^/  - /'
  rm -f "$now_file"; exit 0
fi

notify() { # titolo, testo
  local title="$1" body="$2" sent=0
  # Linko: campanella + push (serve il backend attivo)
  if [ -f "$VIEWER_ENV" ]; then
    local secret user
    secret=$(grep -E '^LINKO_INTERNAL_SECRET=' "$VIEWER_ENV" | cut -d= -f2-)
    user=${LINKO_ALERT_USER_ID:-$(psql_q "select id from \"User\" where email not like 'uitest-%' order by \"createdAt\" limit 1;")}
    if [ -n "$secret" ] && [ -n "$user" ]; then
      python3 -c 'import json,sys; print(json.dumps({"userId":sys.argv[1],"kind":"system_health","title":sys.argv[2][:120],"body":sys.argv[3][:500],"url":"/updates"}))' "$user" "$title" "$body" \
        | curl -sf -m 10 -o /dev/null -X POST "$BACKEND/api/v1/internal/notify" -H 'Content-Type: application/json' -H "x-linko-internal: $secret" --data-binary @- \
        && sent=1
    fi
  fi
  # Telegram, se configurato
  if [ -f "$TELEGRAM_ENV" ]; then
    # shellcheck disable=SC1090
    . "$TELEGRAM_ENV"
    curl -sf -m 10 -o /dev/null "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=${title}"$'\n'"${body}" && sent=1
  fi
  echo "$(date '+%F %T') [$([ $sent = 1 ] && echo inviato || echo NON-inviato)] $title — ${body//$'\n'/ | }" >> "$STATE_DIR/health.log"
  return $((1 - sent))
}

ok=1
if [ -n "$new" ]; then
  n=$(printf '%s\n' "$new" | sed '/^$/d' | wc -l)
  notify "Linko: $n $([ "$n" = 1 ] && echo problema || echo problemi)" "$(printf '%s\n' "$new" | cut -f2)" || ok=0
fi
if [ -n "$gone" ]; then
  notify "Linko: risolto" "$(printf '%s\n' "$gone" | cut -f2)" || ok=0
fi

# Lo stato si aggiorna solo se gli avvisi sono partiti: altrimenti si riprova al giro dopo
[ "$ok" = 1 ] && mv "$now_file" "$prev_file" || rm -f "$now_file"

# Il log resta piccolo
[ -f "$STATE_DIR/health.log" ] && [ "$(stat -c %s "$STATE_DIR/health.log")" -gt 1000000 ] && tail -n 500 "$STATE_DIR/health.log" > "$STATE_DIR/health.log.tmp" && mv "$STATE_DIR/health.log.tmp" "$STATE_DIR/health.log"
exit 0
