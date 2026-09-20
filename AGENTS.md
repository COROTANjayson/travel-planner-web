<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Travel Planner web

This is the Next.js client. The canonical architecture brief is
`../travel-planner-api/travel-planner.md`; read only the sections relevant to
the task.

- Use App Router, TypeScript, Tailwind, and existing shadcn/Base UI code.
  Prefer Server Components; use `"use client"` only when required.
- Design mobile-first: start with small-screen layouts and use Tailwind's
  responsive breakpoints to enhance them for larger screens. Keep navigation,
  forms, and controls touch-friendly; prevent horizontal overflow and verify
  mobile and desktop layouts before shipping UI changes.
- The Go API owns data and authorization. Use its OpenAPI client/types; do not
  duplicate domain logic or expose provider secrets in the browser.
- Use TanStack Query for remote state and local React state for UI state.
- Server-render public template/destination pages with useful metadata.
- Treat AI and optimization as asynchronous jobs. Scheduling constraints and
  verified place/route data belong to backend services, not client logic.
- Keep scheduled instants in UTC with IANA time zones. Keep money as integer
  minor units with an ISO currency code.
- Build only the requested web slice; do not prebuild mobile, infrastructure,
  microservices, CRDTs, or speculative abstractions.
- Preserve accessible loading, empty, error, unauthorized, and mobile states.
- Run `npm run lint` and `npm run build` after behavioral or compilation changes.
