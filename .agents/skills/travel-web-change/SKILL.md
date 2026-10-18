---
name: travel-web-change
description: Implement or fix interactive Travel Planner web screens and forms, including trip, itinerary, and participant behavior and regression checks. Excludes backend changes, documentation-only tasks, and unrelated applications.
---

# Travel Planner web changes

Use this workflow for the requested UI behavior. Start in this repository;
source paths below are relative to its root. Follow [AGENTS.md](../../../AGENTS.md),
read the relevant [UI guidance](../../../docs/ui-ux.md), and use the
[README](../../../README.md) for setup and contract context. Those documents
own the rules; this skill helps trace and verify a change.

## Trace the user action

Identify the route, interaction, and expected result, including the affected
role and the failure being fixed. Follow the existing state owner through the
screen, form/dialog, feature API hook, and query consumers before editing.

Useful examples to inspect only when relevant:

| Change | Existing examples |
| --- | --- |
| Activity editing or failed saves | `src/components/trips/activity-form.tsx`, `src/components/trips/itinerary.tsx`, `src/lib/itinerary.ts` |
| Participant controls or stale permissions | `src/components/trips/memberships.tsx`, `src/lib/memberships.ts` |
| Dates, zones, or durations | `src/lib/activity-time.ts`, `src/lib/trips.ts` |

For mutations, locate who closes the editor, retains entered values, handles
pending/error state, and refreshes each affected query. Follow existing query
keys and error recovery rather than assuming the form owns the whole lifecycle.
For role changes, check both initially hidden controls and permission changes
while the screen is open. Coordinate a needed API contract change explicitly;
this workflow does not authorize editing the separate backend repository.

## Verify the requested behavior

Extend the relevant existing assertion script for changed behavior:
`scripts/check-itinerary.mjs`, `scripts/check-memberships.mjs`, or
`scripts/check-auth.mjs`. For example, a save-recovery fix should exercise the
failure and retry without losing input; a date fix should exercise the affected
zone or boundary. Prefer a focused behavioral assertion over matching markup
that merely mirrors the implementation.

Run the completion command from AGENTS.md. Its mocked/static checks do not
verify real browser interaction. Use available browser tooling to check the
affected journey and relevant mobile/desktop, keyboard, focus, and failure
states from the UI guide. If a browser, configured account, API, or device is
unavailable, report that gap instead of claiming those checks passed.

Finish with the resulting behavior, relevant regression evidence, and any
unverified UI states. For work spanning sessions or coordinated decisions, use
the README's task-plan format without turning a small fix into a planning task.
