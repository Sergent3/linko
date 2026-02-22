# Linko

Piattaforma web per salvare e organizzare segnalibri del browser con tagging automatico via AI.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Backend | Express + TypeScript |
| ORM | Prisma 5 + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Auth | JWT (access 15 min + refresh 7 giorni) |
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

- **Import** segnalibri da file HTML (formato Netscape — Chrome/Firefox/Safari)
- **Tagging ibrido**: regex su dominio (gratuito) + AI placeholder (Claude API)
- **Arricchimento asincrono**: titolo, favicon, immagine OpenGraph, HTTP status
- **De-duplicazione** via SHA-256 dell'URL normalizzato
- **Soft delete** — i record rimangono nel DB con `deletedAt`
- **Auth JWT**: register, login, refresh token con rotation, logout
- **Worker scalabile**: `docker compose up --scale worker=N`

## Setup locale

### Prerequisiti

- Docker + Docker Compose
- Node.js 20+ (per migrate e `prisma generate` sull'host)

### 1. Variabili d'ambiente

```bash
cp .env.example .env
# Edita .env: cambia password, genera JWT secrets con:
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET
```

### 2. Avvio infrastruttura

```bash
docker compose up -d postgres redis
```

### 3. Migrate e genera client Prisma

```bash
# Dal repo root — adatta DATABASE_URL se cambi la password nel .env
cd backend
DATABASE_URL="postgresql://linko:changeme_strong_password@localhost:5433/linkodb" \
  npx prisma migrate dev --name init

npx prisma generate   # genera client backend

cd ../worker
npx prisma generate   # genera client worker (schema condiviso)
```

### 4. Avvio completo

```bash
docker compose up -d --scale worker=2
```

### 5. Verifica

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"linko-backend","ts":"..."}

# Registra utente
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
| GET | `/api/v1/bookmarks` | Lista bookmark (paginata, filtrabile) |
| POST | `/api/v1/bookmarks` | Crea bookmark |
| PATCH | `/api/v1/bookmarks/:id` | Aggiorna bookmark |
| DELETE | `/api/v1/bookmarks/:id` | Soft delete |
| GET | `/api/v1/folders` | Lista cartelle |
| POST | `/api/v1/folders` | Crea cartella |
| GET | `/api/v1/tags` | Lista tag |
| POST | `/api/v1/import` | Import file HTML (multipart) |

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
│       │   ├── auth/          # register, login, refresh, logout
│       │   ├── bookmarks/
│       │   ├── folders/
│       │   ├── tags/
│       │   └── import/        # parser HTML Netscape
│       ├── middleware/
│       │   ├── auth.middleware.ts
│       │   └── error.middleware.ts
│       └── utils/
│           ├── tag-engine.ts  # regex + AI placeholder
│           └── url-hash.ts    # normalizzazione + SHA-256
├── worker/
│   └── src/processors/
│       ├── enrich.processor.ts    # OpenGraph scraping
│       ├── health-check.processor.ts
│       └── tag.processor.ts       # AI tagging placeholder
├── frontend/                  # Next.js (in sviluppo)
├── docker-compose.yml
└── .env.example
```
