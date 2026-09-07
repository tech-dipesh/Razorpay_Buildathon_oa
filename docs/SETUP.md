# Setup, architecture, and feature reference

## Running it locally
```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env          # fill in the real values
pnpm install
pnpm generate                 # Prisma client
pnpm seed                     # 50-loan synthetic batch + a real batch report
pnpm dev
```

```bash
pnpm test                     # 50 tests across every workspace
pnpm type                     # type-check everything
pnpm build                    # production builds
```

## Environment variables

See `.env.example` at the repo root for the full list with inline comments.
In short: `DATABASE_URL` and `REDIS_URL` match `docker-compose.yml` by
default, `JWT_ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` control
session length, Razorpay/SMTP/OAuth credentials are needed for those
integrations to work, and the five AI provider keys are all optional — the
app degrades gracefully to whichever subset is actually configured.

## Architecture

Turborepo monorepo.

| | |
|---|---|
| `apps/web` | Next.js 16 |
| `apps/api` | Fastify 5, oRPC, versioned under `/api/v1` |
| `apps/worker` | BullMQ consumers |
| `packages/database` | Prisma 7 + `pg` driver adapter |
| `packages/redis` | Shared connection: sessions, rate limiting, cache-aside, single-use tokens |
| `packages/queue` | Shared BullMQ queue/job definitions |
| `packages/ai` | Multi-provider registry, circuit breaker, consensus check |
| `packages/mail` | Shared mailer |
| `packages/shared` | Zod schemas shared by frontend and backend |

27 routes total: auth (9), loans (12), ai (2), notifications (1), users (2),
reports (1), plus the Razorpay webhook and PDF download as plain REST
endpoints outside the RPC router.
