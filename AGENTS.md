<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Travel Planner web

## Start here

- [README](README.md): setup, project map, API conventions, and commands.
- [UI/UX guide](docs/ui-ux.md): read before screen or shared-component changes.
- [travel-web-change](.agents/skills/travel-web-change/SKILL.md): reusable workflow
  for interactive screen/form changes and their regression/browser checks.
- Inspect the affected code and existing checks before editing. This repository
  is independent of the API repository; no sibling checkout is required.

## Working rules

- Use App Router, TypeScript, Tailwind, and existing shadcn/Base UI primitives.
  Keep Server Components unless interaction or browser APIs require a client.
- Put routes in `src/app`, trip UI in `src/components/trips`, shared primitives
  in `src/components/ui`, and API/types/time helpers in `src/lib`.
- Use `useApi` and the existing feature API hooks. Types are hand-maintained;
  there is no generated OpenAPI client. Coordinate API contract changes with
  the backend when requested; do not invent endpoints or response fields.
- Use TanStack Query for remote state, existing query keys/invalidation patterns,
  and local React state for UI state. Keep Auth0 tokens in memory; never log
  credentials or add browser-persisted token storage.
- The API owns authorization and durable rules. Client validation and permission
  controls improve UX but never replace server checks.
- Preserve UTC instants and explicit IANA zones using the existing Temporal
  helpers. Trips support inclusive dates and optional paired exact times;
  activities use the trip zone. Overlaps are advisory. Trip edits that exclude
  saved activities fail. See the README before changing schedule behavior.
- Reuse semantic tokens and shared components. Preserve responsive layouts,
  labels, keyboard/focus behavior, loading/error/empty/permission states,
  recoverable form values, and duplicate-submission safeguards.
- Build the requested slice only. Update an existing authoritative document
  when its rule changes; do not create competing instructions or speculative
  infrastructure.

## Completion

Run `npm run check` for code, configuration, or script changes. It runs lint,
route generation/type checking, existing regression/contrast checks, and build.
Use `npm test` or the individual README commands while iterating. Documentation
changes require link/accuracy review; they do not alone require a build.

For UI changes, also verify affected views on mobile and desktop, keyboard
navigation, long text, and relevant error/permission states per the UI/UX guide.
Report checks that were skipped or blocked. Review the diff for unintended
changes and secrets; never modify local environment files to make checks pass.
