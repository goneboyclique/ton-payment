# ton-payment

Self-hostable payment service for TON and USDT (jetton) payments: create a
payment, have the payer sign it with any TON Connect wallet, and get a
verified result once the transfer lands on-chain.

The product is the API; `apps/mini-app` is a Telegram Mini App kept only as a
test client for exercising a real wallet end to end.

pnpm + Turborepo monorepo:

| path              | package        | what it is                                                        |
| ----------------- | -------------- | ----------------------------------------------------------------- |
| `apps/api`        | `api`          | NestJS REST API (Prisma/PostgreSQL, TON Center, Swagger)          |
| `apps/mini-app`   | `tma`          | Vue 3 + Vite Telegram Mini App (TON Connect, TanStack Query)      |
| `packages/db`     | `@pkg/db`      | Prisma schema/client + generated Zod schemas                      |
| `packages/api`    | `@pkg/api`     | orval-generated API client (fetch / vue-query)                    |
| `packages/shared` | `@pkg/shared`  | shared utilities (tsup, ESM + CJS)                                |
| `packages/madevs` | `@repo/madevs` | dev helper: opens a public tunnel to the API and runs `turbo dev` |
| `tooling/*`       | `@tooling/*`   | shared env loaders (zod), ESLint config, tsconfig bases           |

## Prerequisites

- Node.js 24+ (the Docker image uses Node 26)
- pnpm (`packageManager` is pinned in `package.json`; use `corepack enable`)
- Docker + Docker Compose (PostgreSQL 17 for local dev, and for deploy)
- A Telegram bot token ([@BotFather](https://t.me/BotFather)) and a [TON Center](https://toncenter.com) API key

## Setup

```sh
pnpm install
```

### Environment files

Mixing these up is the usual cause of "works locally, breaks in docker":

| file          | read by                                               | db host     |
| ------------- | ----------------------------------------------------- | ----------- |
| `.env` (root) | `docker compose`, **the API in dev**, Vite (mini-app) | `localhost` |

The API validates its env with `tooling/env/src/tma-api.ts`, which loads
`../../.env` relative to `apps/api` — i.e. the **root `.env`**. Keep all API
variables there;

```sh
cp .env.example .env
```

then set up your variables

API variables (validated with zod at boot; the process exits if a required one is missing):

| variable             | required | default                                           |
| -------------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`       | yes      | —                                                 |
| `TELEGRAM_BOT_TOKEN` | yes      | — (validates Mini App init data)                  |
| `TONCENTER_API_KEY`  | yes      | —                                                 |
| `PAYMENT_WALLET`     | yes      | — (TON address receiving payments)                |
| `USDT_JETTON_MASTER` | yes      | — (testnet master in `.env.example`)              |
| `TONCENTER_API_URL`  | no       | `https://testnet.toncenter.com/api/v2/jsonRPC`    |
| `TONCENTER_WS_URL`   | no       | `wss://testnet.toncenter.com/api/streaming/v2/ws` |
| `PORT`               | no       | `4000`                                            |
| `NODE_ENV`           | no       | `development`                                     |
| `CORS_ORIGINS`       | no       | `*`                                               |

Mini App (Vite, read from the root `.env`):

| variable       | required | notes                                                                                                                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | yes      | API base URL the dev proxy forwards `/api` to. Not in `.env.example`; set it (e.g. `http://localhost:4000`) or use `pnpm start:tg-dev`, which sets it to a tunnel URL |
| `VITE_HTTPS`   | no       | `true` enables a local mkcert certificate                                                                                                                             |

Tooling only: `OPENAPI_INPUT_SRC` (orval input, default `http://localhost:4000/api-json`).

### Start local infrastructure

If you need local postgres you can use repo compose

```sh
docker compose up postgres --detach
```

Insteed you should provide your DATABASE_URL before next step

### Database

Requires `DATABASE_URL`
Generate repo API schemas and run migration

```sh
pnpm db:generate   # prisma client + Zod schemas (packages/db/generated, do not edit)
pnpm db:migrate    # prisma migrate dev (creates + applies migrations)
```

Re-run `pnpm db:generate` after every `schema.prisma` change.

### SDK client

if you want to use orval sdk client methods you should generate client from your openapi json. You can start server `pnpm dev --filter api`.
it starts server on 4000 port and /api-json on them. SDK generator use OPENAPI_INPUT_SRC with `localhost:4000/api-json` by default so you can run
```sh
pnpm sdk:generate
pnpm format  # just for formating sdk generated code
```

## Run (development)

```sh
pnpm dev            # turbo dev: API (nest --watch, :4000) + mini-app (vite)
pnpm start:tg-dev   # same, but first opens a public tunnel (untun) to :4000 and
                    # exports it as VITE_API_URL so Telegram can reach your machine
pnpm dev --filter {specific apps} # start dev server for choised apps
```

API only / mini-app only:
```sh
pnpm --filter api dev
pnpm --filter tma dev
```

## Test and lint

```sh
pnpm lint
pnpm test                                          # vitest (turbo builds deps first)
pnpm --filter api exec vitest run path/to/file.spec.ts   # single test file
```

## Build

```sh
pnpm build          # turbo build (runs db:generate first) + prettier
```

Outputs: `apps/api/dist` (run with `pnpm --filter api start:prod` →
`node dist/main`), `apps/mini-app/dist`.

## Deploy

### API (Docker)

The image is built by `apps/api/Dockerfile`: multi-stage, `turbo prune api --docker`
k `pnpm install` → `pnpm turbo build` → slim Node runtime running
`node apps/api/dist/main.js` as a non-root user. **Build it from the repo root:**

```sh
docker build -f apps/api/Dockerfile -t ton-payment-api:latest .
```

Then deploy on the server with the compose stack (root `.env` is the only file to edit):

```sh
cp .env.example .env    # then set your variables
docker compose up --detach --build
```

Stack (`docker-compose.yaml`):

- `postgres` — published on `127.0.0.1` only. Put a reverse proxy in front of
  `api` for TLS.
- `migrate` — one-shot `prisma migrate deploy`; `api` starts only after it
  exits successfully.
- `api` — configured explicitly from compose (no `env_file`); port `API_PORT`
  (default 4000); healthcheck on `/api-json`.

Missing required variables abort `docker compose` by name before anything starts:
the `api` service passes every variable the env schema requires, and the schema
is validated at boot.

### Mini App

Static Vite build served under the `/tma/` base path (`base` in `vite.config.ts`):

```sh
VITE_API_URL=https://api.example.com pnpm --filter tma build-only   # or `build` (adds vue-tsc type-check)
```

Serve `apps/mini-app/dist` over HTTPS at `/tma/` (any static host / reverse proxy).
The client calls the API at `/api` by default (`packages/api/fetcher.ts`), so the
production gateway must forward `/api/*` to the API **with the `/api` prefix
stripped** (same as the Vite dev proxy), or call `configureClient({ baseUrl })`.
Also update:

- `manifestUrl` / `twaReturnUrl` in `apps/mini-app/src/main.ts` and
  `apps/mini-app/public/tonconnect-manifest.json` (they still point at template values).
- The Mini App URL in BotFather to `https://<your-domain>/tma/`.

## Commits

Conventional commits enforced by commitlint + husky (lowercase subject). Allowed
types: `config | feat | fix | chore | docs | refactor | test | perf | ci | build | revert`.
The pre-commit hook runs `lint-staged` (prettier).
