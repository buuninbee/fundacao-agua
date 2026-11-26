# Project Context: fundacao-agua (MIPC)

> This folder (`.agents/project/`) holds configuration and specifications **specific to this repository**. When copying the multi-agent template (`GEMINI.md`, `.agents/skills/`, `.agents/handoffs/`) to another project, omit or replace `.agents/project/`.

## Stack & Commands

- **Frontend** (`Frontend/`): React 19, TypeScript, Vite 6, Tailwind CSS v4, Radix UI, React Router 7, Leaflet, Recharts, jsPDF. Package manager: `pnpm`.
  - Dev server: `pnpm --dir Frontend dev`
  - Build + typecheck: `pnpm --dir Frontend build`
  - Lint: `pnpm --dir Frontend lint`
  - Domain check script: `Frontend/scripts/check-water-rules.ts`
- **Backend / Database**: Supabase Postgres project (`wqpsgcpqqrrkqnjpungg`).
  - Client: `Frontend/src/lib/supabase.ts` + `Frontend/src/lib/mipcApi.ts` (`@supabase/supabase-js` with publishable key via `Frontend/.env.local`).
  - Tables in `public`: `pocos`, `leituras_iot`, `usuarios`, `visitas_tecnicas`, `manutencoes`, `boletins_tecnicos`, `comunicados`, `ouvidoria_chamados`, `emergencias`, `workshops`, `dispositivos_iot`, `calibracoes`, `trocas_hardware`, `auditoria_logs`.
- **DevOps / Tests**: Check script in `Frontend/scripts/check-water-rules.ts`.

## Ownership Overrides

- `frontend`: `Frontend/`
- `testing`: `Frontend/scripts/` and future `tests/` / `*.test.*`
- `backend`: `Backend/` or `supabase/` (when added)
- `devops`: `.github/`, `Dockerfile*`, deployment configs (when added)

## Project Specifications

- **Design System & Visual Rules**: Read [design.md](./design.md) before creating or styling UI components (custom Blue/Orange/Purple Tailwind palette, `Inria Serif` + `Instrument Sans`, WCAG AAA CTA contrast).
- **User Stories (HUs)**: See [hu/](./hu/) (`HU-MIPC-01` through `HU-MIPC-13` covering Fiscal ONG, Morador, Liderança, Técnico IoT, and Administrador TI).
