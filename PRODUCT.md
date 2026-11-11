# Travel Planner

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friends and small groups planning trips together remain the core audience,
confirmed on 2026-10-22. They need to organize shared destinations, daily
plans, and travel companions in one itinerary.

On 2026-11-08 the user confirmed three further primary audiences:

- Families: parents planning with children or relatives, across mixed ages
  and devices.
- Solo travelers: one person planning their own trip; group features are
  optional for them, not required.
- Organized groups: clubs, teams, classes, or company offsites, typically one
  coordinator with many participants.

No audience has been ranked above another beyond the core group; treat
single-person and many-participant trips as equally valid.

## Product Purpose

Help a group create a clear trip plan, coordinate who can change it, and consult
the same daily itinerary. Success means participants can find the plan for a day
and authorized planners can update it without losing their work or confusing
the trip's local times. Quantitative success targets remain undecided.

## Positioning

Money lives inside the itinerary. Costs, shares, payments, reimbursements, and
loans attach to the actual activities on the plan rather than living in a
separate expense app. Confirmed by the user on 2026-11-08 as the product's
distinguishing mechanism. The current expenses and loan features are the
implemented basis for this claim; see the [web README](README.md) for the
shipped contracts.

## Operating Context

The current product is a responsive web app used on desktop and mobile browsers.
Its main journey is Trips -> Open trip -> Choose day -> View or add activity;
Invitations and Account support that journey. Authenticated planning requires
Auth0 and the separate Go API. The public landing page shows a labeled sample
itinerary, not saved user data.

## Capabilities and Constraints

### Current functionality

- Create and manage trips with a resolved destination, inclusive dates, and
  optional paired exact start and end times.
- Plan scheduled activities by day, with categories, optional places and notes,
  and simple text to-do lists shown in activity details.
- View the selected day's activity locations on a map. Keep itinerary details
  usable when the map is unavailable.
- Invite companions, manage participants and roles, transfer ownership, and
  leave trips. Owners and editors can change itineraries; viewers can read them.
- Plan activity costs per person or for a group, split evenly or by exact
  amounts, record deposits and covered purchases, and track cash loans and
  repayments separately per currency.
- Keep a trip-level Prep list of tasks that one person does, assigned or claimed,
  or that everyone does, with each person's progress shown. A task can name an
  activity, one of the trip's days, or both. Viewers can read it but aren't counted and
  can't take tasks.
- Show schedule overlaps as advisory conflicts. Activities use the trip's IANA
  time zone; saved exact times remain UTC instants.

The API owns authorization and durable scheduling rules. Invitations appear in
an inbox for the matching verified email, where recipients can accept or decline.
They expire after seven days; email delivery is future work.
Preserve entered values after recoverable errors and protect unsaved work.
Activity to-dos currently have no completion controls. See the [web README](README.md)
for the authoritative implemented contracts and limitations.

### Committed roadmap

On 2026-11-08 the user confirmed these original ideas as committed goals, not
merely context:

- Generate itineraries with AI from a prompt and travel preferences.
- Create, reuse, and share traveler itinerary templates.
- Let sub-groups follow separate plans and rejoin at a set meeting point and
  time.
- Recalculate the schedule when activities move or run long.

Budget sharing among companions, the fifth original idea, is now delivered
through activity expenses and loans and continues under the positioning above.

None of the four is shipped, and nothing in the codebase implements them yet.
Their order, detailed behavior, and delivery dates remain undecided; a
commitment here is not authorization to build one without a request. The
original architecture proposal also discusses native mobile apps and offline
support; neither changes the current web platform or establishes a delivery
commitment.

## Brand Commitments

The existing product name is Travel Planner. Current copy uses plain, friendly,
task-focused language. Preserve factual product claims and clearly label
examples. The [UI/UX guide](docs/ui-ux.md) remains the authority for approved
interface decisions; this product record does not replace it.

## Evidence on Hand

- [Web README](README.md): current setup, workflows, contracts, and checks.
- [UI/UX guide](docs/ui-ux.md): approved navigation, interaction, and accessibility
  requirements.
- [Landing page](src/app/page.tsx): current product copy and a labeled Lisbon
  sample itinerary. Its activities are examples, not validated travel advice.
- [Original product ideas](../planner.txt) and
  [architecture proposal](../planner.md): workspace-level planning
  references outside this independent Git repository. Their proposals must not
  be presented as implemented behavior.

Customer testimonials, usage metrics, pricing, and deployment claims have not
been established during initialization; do not invent them.

## Product Principles

- Make the shared daily plan easy to find and understand.
- Make permissions and the consequences of group changes clear.
- Preserve user work and the meaning of scheduled times.
- Keep money attached to the activity it pays for.
- Keep current capabilities distinct from future promises and sample content.

## Accessibility & Inclusion

Preserve the existing guide's keyboard navigation, visible focus, dialog focus
return, reduced motion, readable contrast, labeled forms, and mobile touch
targets. Support reflow at 320 CSS pixels and long user content. Essential
actions must work without hover. Physical-device keyboard and safe-area
verification remains part of UI work; initialization does not certify it.
