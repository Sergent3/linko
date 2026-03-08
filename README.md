# Linko

Piattaforma web per salvare e organizzare segnalibri del browser con tagging automatico via AI.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 15 (App Router) |
| Backend | Express + TypeScript |
| ORM | Prisma 5 + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Auth | JWT (access 15 min + refresh 7 giorni) |
| AI | Claude API (claude-haiku) via Anthropic SDK |
| Infra | Docker Compose |

## Architettura

```
┌─────────────┐    REST API    ┌─────────────┐    BullMQ    ┌─────────────┐
│  Frontend   │ ────────────▶ │   Backend   │ ───────────▶ │   Worker    │
│  Next.js    │               │  Express TS │              │  (scalabile)│
│  :3000      │               │  :3001      │              │             │
└─────────────┘               └──────┬──────┘              └──────┬──────┘
                                     │                            │
                              ┌──────▼──────┐              ┌──────▼──────┐
                              │ PostgreSQL  │              │    Redis    │
                              │   :5433     │              │    :6379    │
                              └─────────────┘              └─────────────┘
```

## Funzionalità

### Bookmarks
- **Salvataggio** con de-duplicazione via SHA-256 dell'URL normalizzato
- **Soft delete** — i record rimangono nel DB con `deletedAt`
- **Arricchimento asincrono**: titolo, favicon, immagine OpenGraph, HTTP status
- **Drag & drop** tra cartelle direttamente nell'interfaccia

### Organizzazione
- **Cartelle**: crea, rinomina (doppio click), elimina con tutti i bookmark
- **Tag ibridi**: regex su dominio (gratuito, istantaneo) + AI via Claude API
- **Tagging AI** (claude-haiku): 3-6 tag per bookmark + suggerimento cartella

### Import & Sync
- **Import HTML**: file Netscape Bookmark (Chrome / Firefox / Safari / Edge)
- **Sync da browser**: endpoint `POST /api/v1/import/sync` per albero JSON
- **Chrome Extension** inclusa (`extension/`) — installa in modalità sviluppatore

### Siti .onion (Tor)
- Arricchimento via proxy SOCKS5 se Tor è installato (`127.0.0.1:9050`)
- Tagging AI basato su titolo/descrizione se il sito non è raggiungibile

### Bookmarklet
- Salvataggio rapido dalla pagina corrente con popup minimale
- Onboarding "prima volta": se l'utente non ha bookmark, propone import massivo

### Auth
- Register, login, refresh token con rotation, logout
- JWT: access token 15 min + refresh token 7 giorni (SHA-256 in DB)

## Setup locale

### Prerequisiti

- Docker + Docker Compose
- Node.js 20+ (per migrate e `prisma generate` sull'host)
- (Opzionale) Chiave API Anthropic per il tagging AI

### 1. Variabili d'ambiente

```bash
cp .env.example .env
# Edita .env:
#   - Cambia le password
#   - Genera JWT secrets:
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET
#   - Aggiungi chiave Anthropic (opzionale):
#   ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Avvio infrastruttura

```bash
docker compose up -d postgres redis
```

### 3. Migrate e genera client Prisma

```bash
cd backend
DATABASE_URL="postgresql://linko:changeme_strong_password@localhost:5433/linkodb" \
  npx prisma migrate dev --name init

npx prisma generate   # client backend

cd ../worker
npx prisma generate   # client worker (schema condiviso)
```

### 4. Avvio completo

```bash
docker compose up -d --scale worker=2
```

### 5. Verifica

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"linko-backend","ts":"..."}

curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'
```

## API

### Auth (pubbliche)

| Metodo | Endpoint | Body |
|--------|----------|------|
| POST | `/api/v1/auth/register` | `{ email, password }` |
| POST | `/api/v1/auth/login` | `{ email, password }` |
| POST | `/api/v1/auth/refresh` | `{ refreshToken }` |
| POST | `/api/v1/auth/logout` | `{ refreshToken }` |

### Risorse (richiedono `Authorization: Bearer <token>`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/v1/bookmarks` | Lista bookmark (max 2000, filtrabile) |
| POST | `/api/v1/bookmarks` | Crea bookmark |
| PATCH | `/api/v1/bookmarks/:id` | Aggiorna bookmark (titolo, folderId, tag) |
| DELETE | `/api/v1/bookmarks/:id` | Soft delete |
| GET | `/api/v1/folders` | Lista cartelle |
| POST | `/api/v1/folders` | Crea cartella |
| PATCH | `/api/v1/folders/:id` | Rinomina cartella |
| DELETE | `/api/v1/folders/:id` | Elimina cartella + bookmark (ricorsivo) |
| GET | `/api/v1/tags` | Lista tag |
| POST | `/api/v1/import` | Import file HTML (multipart) |
| POST | `/api/v1/import/sync` | Import albero JSON da estensione browser |

### Import sync — formato payload

```json
{
  "tree": [
    {
      "title": "Barra dei preferiti",
      "children": [
        { "title": "GitHub", "url": "https://github.com" },
        {
          "title": "Dev",
          "children": [
            { "title": "MDN", "url": "https://developer.mozilla.org" }
          ]
        }
      ]
    }
  ]
}
```

## Chrome Extension

La cartella `extension/` contiene un'estensione Manifest V3 pronta all'uso.

**Installazione:**
1. `chrome://extensions` → Modalità sviluppatore → Carica estensione non pacchettizzata
2. Seleziona la cartella `extension/`
3. Inserisci URL API (es. `http://IP-VPS:3001`), email e password
4. Clicca **Sincronizza tutti i segnalibri**

## Note per ambienti con AppArmor restrittivo

In alcuni host Docker, AppArmor blocca `execve` da Node.js nei container.
Il `docker-compose.yml` include già i workaround necessari:

- `security_opt: apparmor:unconfined` su backend e worker
- `PRISMA_QUERY_ENGINE_LIBRARY` forzato al binary `linux-musl-openssl-3.0.x`
- `node_modules` montato dall'host (Prisma generate va fatto fuori dal container)
- Postgres con `unix_socket_directories=''`

## Struttura progetto

```
linko/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── bookmarks/
│       │   ├── folders/
│       │   ├── tags/
│       │   └── import/
│       │       ├── parser.ts        # parser HTML Netscape
│       │       ├── import.service.ts
│       │       ├── sync.service.ts  # import da estensione browser
│       │       └── import.router.ts
│       ├── middleware/
│       └── utils/
│           ├── tag-engine.ts        # regex domini + placeholder AI
│           └── url-hash.ts          # normalizzazione + SHA-256
├── worker/
│   └── src/processors/
│       ├── enrich.processor.ts      # OpenGraph scraping (+ Tor per .onion)
│       ├── health-check.processor.ts
│       └── tag.processor.ts         # AI tagging via Claude API
├── frontend/
│   └── src/
│       ├── app/(app)/bookmarks/     # pagina principale
│       ├── app/save-quick/          # popup bookmarklet
│       └── components/bookmarks/
│           ├── BookmarkWidget.tsx   # widget cartella (drag&drop, rinomina, elimina)
│           └── BookmarkListItem.tsx # riga bookmark (draggabile)
├── extension/                       # Chrome Extension Manifest V3
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   └── popup.js
├── scripts/
│   └── retag-all.ts                 # ri-dispatcha job tagging AI su bookmark esistenti
├── docker-compose.yml
└── .env.example
```
