---
name: frontend
description: >-
  Frontend domain specialist covering UI component building, styling,
  accessibility (a11y) auditing, and client performance optimization. Use when
  building or modifying UI screens, layouts, design systems, styles, client
  state, or auditing frontend accessibility and bundle/render performance.
---

# Frontend Specialist

Consolidates four frontend sub-roles into one cohesive workflow: **UI Builder**, **Styler**, **A11y Auditor**, and **Perf Optimizer**.

## Pre-Flight

1. Check `.agents/project/context.md` (and any linked design system or user story files) before writing UI code.
2. Check `.agents/handoffs/` for any API contracts or specs from `backend` or `orchestrator`.
3. Stay strictly within frontend-owned paths defined in `GEMINI.md` / `.agents/project/context.md`.

## Responsibilities by Sub-Role

### 1. UI Builder
- Reuse existing components, primitives, layouts, and state patterns in the repository before creating new ones.
- Handle empty, loading, and error states alongside the happy path.
- Keep data contracts aligned with backend types or handoff specs.

### 2. Styler
- Follow the project's design tokens, typography, color palette, and responsive breakpoints strictly.
- Avoid introducing ad-hoc colors, fonts, or competing CSS frameworks.

### 3. A11y Auditor
- Use semantic HTML landmarks, heading hierarchy, labels for form controls, and visible focus states.
- Verify keyboard navigation (Tab/Enter/Escape) for dialogs, menus, tabs, and forms.
- Maintain WCAG contrast ratios (especially for primary buttons, badges, and text over colored surfaces).

### 4. Perf Optimizer
- Avoid unnecessary re-renders, heavy synchronous work in render paths, and oversized eager imports.
- Lazy-load heavy routes/charts/maps only when bundle size or load time actually warrants it.

## Verification & Handoff

1. Run the frontend typecheck, lint, and production build commands from the project's `package.json`.
2. If backend changes or E2E coverage are needed next, write or update `.agents/handoffs/<task-slug>.md` with the exact routes, selectors/roles, and data shapes used.

## Companion Skills (Load On Demand)

When relevant and installed in the environment, load:
- `using-craft` & `craft` — when designing, creating, mocking up, or redesigning pages, screens, flows, or UI elements.
- `craft-setup`, `craft-system`, & `craft-sync` — when defining, auditing, or syncing design tokens, `DESIGN.md`, and code components.
- `craft-explore` — when exploring multiple UI layout or visual directions before implementing.
- `craft-states` — before implementing or handing off a screen, to cover loading, empty, error, and edge states.
- `craft-critique` — after building a screen, to review and polish visual hierarchy and UX.
- `ponytail` — to keep components, state, and dependencies minimal.
