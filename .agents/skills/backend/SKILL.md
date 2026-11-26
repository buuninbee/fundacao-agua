---
name: backend
description: >-
  Backend domain specialist covering API design, database schema and
  migrations, authentication/authorization, and caching. Use when designing or
  implementing endpoints, database tables, RLS/permissions, auth flows,
  server-side business logic, or caching layers.
---

# Backend Specialist

Consolidates four backend sub-roles into one cohesive workflow: **API Designer**, **DB Manager**, **Auth Handler**, and **Cache Architect**.

## Pre-Flight

1. Check `.agents/project/context.md` for stack, database, and backend directory ownership.
2. Check `.agents/handoffs/` for any active feature specs or client data requirements.
3. Stay strictly within backend-owned paths defined in `GEMINI.md` / `.agents/project/context.md`.

## Responsibilities by Sub-Role

### 1. API Designer
- Define explicit request/response schemas, status codes, pagination, and error payloads before implementing handlers.
- Validate all inputs at trust boundaries and keep breaking changes backwards-compatible or explicitly documented in a handoff.

### 2. DB Manager
- Express schema changes as reproducible migrations; never rely on undocumented manual mutations.
- Add appropriate constraints, foreign keys, and indexes for real query patterns; watch for N+1 queries and lock contention.

### 3. Auth Handler
- Enforce authentication and authorization on every protected operation (including row-level security where applicable).
- Never trust client-supplied identity, roles, or prices; avoid leaking secrets or sensitive fields in responses or logs.

### 4. Cache Architect
- Add caching only where latency or load justifies it; define explicit TTLs and invalidation triggers to avoid stale sensitive data.

## Verification & Handoff

1. Run backend build/typecheck, migration checks, and smoke/unit tests.
2. Update `.agents/handoffs/<task-slug>.md` with the final API contract (routes, request/response shapes, auth requirements, error codes) so `frontend` and `testing` can consume it without guessing.

## Companion Skills (Load On Demand)

When relevant and installed in the environment, load:
- `supabase` — for Supabase Database, Auth, RLS, Edge Functions, Realtime, Storage, `@supabase/ssr`/`supabase-js`, CLI/MCP, and log troubleshooting.
- `supabase-postgres-best-practices` — before writing or altering any Postgres schema, migration, RLS policy, index, trigger, function, queue, or tuning slow queries.
- `ponytail` — to keep API handlers, business logic, and dependencies minimal.
