# Travel Planner web

Next.js frontend for Travel Planner.

## Run locally

Create `.env.local`:

```dotenv
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-spa-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=your-api-identifier
API_BASE_URL=http://127.0.0.1:8080
```

Create an Auth0 **Single Page Application** and add `http://localhost:3000`
to its Allowed Callback URLs, Allowed Logout URLs, and Allowed Web Origins.
The audience must exactly match the Go API's `AUTH0_AUDIENCE`. No client secret
belongs in this application.

```bash
npm install
npm run dev
```

The browser calls relative `/api/*` URLs. Next.js proxies them to
`API_BASE_URL`, avoiding local CORS requests.

## Frontend UI guide

Use **shadcn/ui first** for application UI. The project is already configured
with the `base-nova` style, Base UI primitives, Tailwind CSS variables, and
Lucide icons in [`components.json`](./components.json).

### Add a component

Check the [shadcn component list](https://ui.shadcn.com/docs/components), then
add only what the current feature needs:

```bash
npx shadcn add card dialog input
```

Generated components live in `src/components/ui` and are owned by this repo.
Import them through the configured alias:

```tsx
import { Button } from "@/components/ui/button"

export function SaveButton() {
  return <Button>Save trip</Button>
}
```

### Conventions

- Reuse a component from `src/components/ui` before creating a new primitive.
- Compose feature-specific UI outside `components/ui`; keep that directory for
  shadcn primitives and small project-wide adjustments.
- Use existing semantic classes such as `bg-background`, `text-foreground`,
  `text-muted-foreground`, and `border-border`. Change theme tokens in
  `src/app/globals.css` instead of scattering raw colors.
- Use component variants and `cn()` for conditional classes. Avoid copying a
  shadcn component into another file just to restyle it.
- Use Lucide for icons. Give icon-only controls an accessible label.
- Keep Server Components by default. Add `"use client"` only when interaction,
  browser APIs, or client-side state require it.
- Preserve keyboard focus, labels, validation messages, loading/empty/error
  states, and responsive behavior when composing components.
- Do not add another component library unless the team explicitly changes this
  rule.

Before opening a PR, run:

```bash
npm run lint
npm run build
```

The broader architecture is documented in
`../travel-planner-api/travel-planner.md`.
