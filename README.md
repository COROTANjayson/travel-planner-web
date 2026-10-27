# Travel Planner web

Next.js frontend using TypeScript, Tailwind, shadcn/Base UI, Auth0, and TanStack
Query. This is an independent npm/Git project; checks need no API checkout.

## Run locally

Use Node **22.23.2** from [.nvmrc](.nvmrc) and npm (with nvm, run `nvm use 22.23.2`).
Install dependencies with the committed lockfile:

```bash
npm ci
```

Copy [.env.example](.env.example) to `.env.local` only if you do not already have
local settings, then replace the Auth0 placeholders. Create an Auth0 **Single
Page Application** and allow `http://localhost:3000` in Allowed Callback URLs,
Allowed Logout URLs, and Allowed Web Origins. The audience must match the API's
`AUTH0_AUDIENCE`. No Auth0 client secret belongs in this project.

```bash
npm run dev
```

Open `http://localhost:3000`. Authenticated trip workflows need a running API;
`API_BASE_URL` defaults to `http://127.0.0.1:8080`. The browser calls relative
`/api/*` URLs, which Next.js proxies to that server. Public Auth0 values are
embedded at build time; restart development or rebuild after changing them.
Auth0 access tokens use memory storage. Missing Auth0 settings show a setup
message rather than enabling authenticated features.
On reload, Auth0 first attempts to restore the session silently. If the SDK's
previous-login cookie is present but silent restoration fails (for example, when the
browser blocks third-party cookies), the app makes one top-level login redirect
and returns to the same path, query, and fragment. An active Auth0 session can
complete that redirect without asking for credentials. Expired sessions still
require login; new visitors and failed callbacks do not trigger recovery.

## Project map and conventions

| Location               | Responsibility                                                                 |
| ---------------------- | ------------------------------------------------------------------------------ |
| `src/app`              | App Router routes, layouts, providers, and shared theme                        |
| `src/components/trips` | Trip, itinerary, participant, and invitation UI                                |
| `src/components/ui`    | Repo-owned shadcn/Base UI primitives                                           |
| `src/lib`              | API hooks, hand-maintained payload types, permissions for UI, and time helpers |
| `scripts`              | Focused regression checks, contrast checks, and MapLibre worker copying        |

Use TanStack Query for remote state and local React state for UI state. Follow
existing query keys and mutation invalidation. All authenticated requests go
through `useApi`; the Go API remains responsible for data and authorization.
There is no generated OpenAPI client. Update affected types, requests, and
checks together when coordinating a contract change.

Use access tokens, not ID tokens or decoded claims, for API access; `/api/v1/me`
is the API user record. The API refreshes email/verification from access-token
claims, while display name is initialized at creation. Handle nullable email
and empty display names. Auth0 callbacks return only to validated local paths.
A 401 clears cached application data and starts reauthentication; logout also
clears user data. A 204 has no JSON body. Show safe 403 permission feedback,
generic 404 for hidden resources, and refresh affected data on 409 conflicts.

Resolve the caller's UI role from `/me` and the participant list; hide privileged
controls until that role is known and refetch permissions after stale-access
failures. Do not optimistically change ownership or roles. Transfer confirmation
names the recipient and explains that the current owner becomes an editor.
Successful transfer refreshes participant, trip, and trip-list data; leaving
clears the affected trip cache and returns to the list.

Invitation tokens are shown once in component state for copying, never query
cache, browser storage, URLs, logs, analytics, or error reports. Acceptance uses
a pasted token in the JSON body and needs the matching verified email. Preserve
failed input privately, show the same safe invalid-invitation message for all
400 acceptance failures, clear the token on success, and refresh the trip list.
Do not infer a trip ID from the returned participant. Email delivery is future
work. Invitation creation/revocation refreshes its history, which never returns
raw tokens. Keep the existing mutation hooks and query keys as the implementation
reference rather than adding another fetch client or state store.

Read the [UI/UX guide](docs/ui-ux.md) for component conventions, approved design decisions,
and UI review. Reuse primitives before adding one; the shadcn configuration is
in `components.json`. New shadcn primitives belong in `src/components/ui`;
feature compositions belong outside that directory.

### Schedule behavior

- Trips use a resolved city/country destination. The API derives destination
  text and IANA time zone from that place.
- Trips support inclusive `start_date`/`end_date`, including same-day trips.
  Optional `starts_at`/`ends_at` must be supplied together as ordered instants.
- Activities always have exact UTC start/end instants and use the trip zone.
  Date-only trips bound both local endpoint dates; precise trips bound the
  entire activity interval. Trip edits excluding saved activities return 409.
- Existing instants survive zone changes; do not reinterpret them as device
  local time. Use `src/lib/activity-time.ts` for Temporal conversions, missing
  daylight-saving times, repeated-hour choices, and saved precision.
- The itinerary groups activities by their start date in the trip zone and
  loads every page within its requested date window. Owners/editors can write;
  all participants can read. Overlaps are advisory and do not prevent saves.
- Send input fields only. IDs, creator identity, and audit fields come from
  the API; retain the existing cancellation and cache invalidation behavior.
- Activities have a category and an ordered to-do list. The activity form
  offers Rest, Eating, Travel, Activity, or Custom without changing time defaults.
  Custom labels belong to individual entries; existing Sleeping labels remain editable.
- Category/item text is trimmed and limited to 100/200 UTF-8 bytes; lists allow
  at most 50 items. Owners/editors add, rename, or remove items in the activity
  form. Compact cards open a details dialog with notes, creator, and a plain
  to-do list for every participant. Entries default to Activity with an empty list.
- The API still stores items as `{text, done}`. Completion is hidden; existing
  values survive edits and new items use `done: false`. No migration is needed.
- The API preserves category/checklist on PUT when omitted or null; explicit
  `[]` clears saved items. The web form sends both fields. Concurrent form
  edits retain the existing last-save-wins behavior.

## Verification

```bash
npm run check
```

| Command                | Coverage                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run format`       | Format source, scripts, configuration, and docs with Prettier     |
| `npm run format:check` | Check formatting without changing files                           |
| `npm run lint`         | Existing Next.js/TypeScript ESLint rules                          |
| `npm run typecheck`    | Next route type generation and strict TypeScript                  |
| `npm test`             | Auth, membership, itinerary/DST, and light-theme contrast scripts |
| `npm run build`        | Production compilation and prerendering                           |
| `npm start`            | Serve an existing production build                                |

Prettier uses its default style from `.prettierrc.json` and skips Git-ignored
files plus the exclusions in `.prettierignore`. Run `npm run format` before
committing; `npm run check` and CI also check formatting. Editors with Prettier
support use the same local version and configuration.

The regression scripts use mocks/static rendering, not an authenticated browser
or a live API. Run an individual `node scripts/check-*.mjs` file for focused
feedback. UI changes also need the browser checks in the UI/UX guide.
Development/build automatically copy MapLibre workers into ignored
`public/maplibre/`; never commit generated copies.

[GitHub Actions](.github/workflows/check.yml) runs `npm ci` and the same check
command independently on pushes and pull requests. Its Auth0 placeholders
validate building, not login. The app self-hosts Manrope through `next/font/local`,
with its license in `src/app/fonts/OFL.txt`; builds do not download fonts.
Network failures must be reported, not bypassed by weakening checks.

## Working with a coding agent

Start the agent in this repository. [AGENTS.md](AGENTS.md) is the shared
instruction entry point; [CLAUDE.md](CLAUDE.md) imports it for Claude.

For example: "Fix the activity save error; preserve entered values and add a
focused regression check." The workflow is: describe the outcome, let the
agent read relevant guidance/code, make a focused change, run checks, review
the diff, report evidence and gaps, then review the result yourself.

The project skill [travel-web-change](.agents/skills/travel-web-change/SKILL.md)
helps trace interactive screen/form changes and choose regression and browser
checks. In Codex, for example: `$travel-web-change Fix the activity save error
without losing entered values.` Codex can also select the skill for matching
tasks. In Claude, ask it to read and follow that linked file for the task;
Codex's skill discovery does not configure Claude automatically.

`AGENTS.md` holds essential rules; `.agents/skills/` groups reusable task
workflows; existing guides hold project knowledge; `scripts/` and
`.github/workflows/` contain executable checks. Keep configuration in the
locations its tool expects. Update existing guidance when behavior changes;
future product ideas do not implicitly authorize implementation.

## As this project grows

The check command, CI workflow, and UI-change skill exist today. The upgrades
below are optional next steps when their trigger occurs, not installed tools
or instructions to build more infrastructure.

| Trigger                                                   | Small next step                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A change spans sessions or requires coordinated decisions | Save a task implementation plan using the format below                           |
| Manual UI checks repeatedly miss regressions              | Add browser tests for the affected journeys, starting with the actual failures   |
| Web/API payloads frequently drift                         | Consume a versioned client/types generated from a backend-owned OpenAPI contract |
| A subtree develops genuinely different conventions        | Add concise instructions near that code; keep shared rules at the root           |
| A recurring task needs the same explanation               | Refine this skill or add one focused skill with a distinct trigger               |
| Stable architecture boundaries repeatedly get violated    | Add targeted ESLint import restrictions for those boundaries                     |
| More contributors need consistent review ownership        | Configure required CI checks and add ownership rules for the relevant areas      |

For a substantial requested task, record a plan in GitHub Issues when needed.
Local working notes may use ignored `docs/plans/<short-task>.md` files.
`docs/archive/`, `.scratch/`, and generated architecture/setup reports also
stay local. Record: **status** (proposed, active, or completed), **goal**, **acceptance
criteria**, **affected areas**, **implementation steps**, **decisions/progress**,
and **verification**. Keep it current so another session can resume. Activate a
plan only for authorized work; small fixes can stay in the conversation. Do not
create empty plan folders or a permanent document for every small change.

Review these triggers when a recurring failure or coordination cost appears.
Production deployment and operational requirements need their own assessment;
they are outside this coding-workflow roadmap. No agent service or model API
is needed for the current workflow.
