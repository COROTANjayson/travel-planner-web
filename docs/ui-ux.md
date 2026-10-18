# Travel Planner UI/UX guide

Read this before changing screens or shared UI. This is the source of approved
frontend design decisions; the API owns domain behavior and authorization.
Exact implemented theme values live in `src/app/globals.css` and shared UI
components. Change them centrally within the requested scope. Code paths in this
guide are relative to the repository root.

## Approved Illustrated Journey design

Approved 2026-10-11; reference: https://www.figma.com/design/ZreGSmwJEIhzQEwu6toBci

- Cream background, plum text/primary actions, coral add/create actions with
  plum text, lavender accents, white reading surfaces, and readable muted text.
  Do not reintroduce green/teal branding. Verify actual token contrast rather
  than copying reference colors without checking their pairings.
- Lora for display headings and DM Sans for controls/reading. Use rem units,
  wrapping, and the shared type scale. Primary controls are at least 48px;
  other product touch targets are at least 44px.
- Mobile gutters are 24px; large-screen gutters are 64px with a 1440px shell.
  Keep forms bounded rather than stretching them to fill desktop width.
- Controls use 12px radii, activity cards 16px, dialogs 24px. Illustrated trip
  cards use mobile outer/inner radii 24/16px and featured desktop 32/24px with
  8px inset. Preserve shared tokens and concentric outer-radius-minus-inset
  relationships rather than inventing per-screen overrides.
- Reuse decorative SVGs in `public/illustrations`, preserve proportions, and
  clip them within their slots. Artwork never proves a real destination.
- Use real data and permissions. Do not turn prototype sample dinners, prefilled
  schedules, automatic rescheduling, or schematic maps into product behavior.

## Navigation and trip planning

- Core journey: Trips -> Open trip -> Choose day -> View or add activity.
  Global navigation remains Trips, Invitations, and Account unless the requested
  feature needs another destination. Keep mobile navigation labels visible.
- Open trips into the itinerary. People and Settings are secondary actions.
  Give each view a clear dominant action and use explicit verb labels.
- Trip cards show name, destination, compact locale-aware dates, labeled status,
  and Open itinerary. Preserve status filters, ongoing/upcoming ordering before
  past trips across pagination, useful filtered empty states, and wider cards
  for sparse desktop lists. Status must not rely on color alone.
- Trip creation asks for dates before optional exact times. Changing a
  destination must explain/confirm clearing entered dates and times.
- Planning uses a compact illustrated header, selected-day navigation, and a
  chronological timeline with a time rail. Show day position and a Today action
  for active trips. Previous/next controls and a date picker support long trips;
  essential navigation must never depend on swiping.
- Desktop can show the real map alongside the itinerary; mobile keeps View map.
  Pins and the place list follow the selected day and identify activities.
  Keep itinerary/place details usable when the map fails.
- Show destination, dates, selected day, and trip zone clearly. Render the
  itinerary and conflicts in the trip zone using existing time helpers.
- Conflicts are advisory: show affected activities, jump to their day, and
  offer permitted editing. Never duplicate backend conflict calculations.
- Keep activity cards scannable: expandable notes, visible optional place
  selection, less prominent delete/overflow actions, and plain-language search
  recovery and save feedback.

## Components, forms, and accessibility

- Reuse `src/components/ui` before adding primitives. Compose feature UI outside
  that folder. Use semantic theme classes, component variants, `cn()`, and
  Lucide icons; icon-only controls need accessible names.
- Start mobile-first; avoid fixed text heights and page-level horizontal
  overflow. Long names and enlarged text must wrap. Ordinary content reflows
  at 320 CSS pixels; surrounding map controls must also fit.
- Keep mobile headers/navigation compact. Reserve sticky action/navigation
  space and safe-area insets. Use full-screen mobile editors for long forms,
  sheets for short interactions, and bounded desktop dialogs where appropriate.
- Use persistent labels, 16px mobile input text, associated errors, and explicit
  required formats. Preserve entered values and selected day after recoverable
  errors. Confirm unsaved-work dismissal and destructive consequences.
- Show submission progress, block duplicate submissions, and announce success
  or errors accessibly. Never imply an unsaved change was saved.
- Preserve loading, empty, error, permission-denied, and not-found states with
  useful recovery that does not reveal private data.
- Preserve visible focus, logical tab order, dialog focus trapping/return,
  Escape behavior, and reduced motion. Essential actions cannot require hover.
- Normal text needs 4.5:1 contrast; qualifying large text needs 3:1. Applicable
  control boundaries and state indicators need 3:1. Check text on each actual
  background/image; use an overlay or separate surface where necessary.
- Images need meaningful alt text or empty alt for decoration. Product touch
  targets exceed the WCAG minimum; do not reduce them to the compliance floor.

References: [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
[target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Review and maintenance

1. Identify the main task, primary action, affected views, and permission states.
2. Reuse relevant components and tokens; keep approved changes within scope.
3. Verify mobile and desktop, including 320px and 1440px, long text, zoom,
   keyboard navigation, focus return, and relevant loading/error/empty states.
4. For form/navigation changes, check sticky controls, short/landscape viewports,
   safe areas, and keyboard overlap. For itinerary changes, check one-day/long
   trips, date navigation, viewer controls, conflict editing, failed saves, and
   unsaved-work protection.
5. Run the completion checks in [AGENTS.md](../AGENTS.md). Token contrast checks
   cover selected light-theme pairings, not complete accessibility or browser QA.
6. Update this guide and the shared implementation when a design decision
   changes. Report what was actually checked; old checklist marks are not proof
   that a later change was verified.

Physical iOS/Android keyboard and safe-area behavior still needs device testing.
Recheck dark-theme behavior if enabling/changing it; automated contrast coverage
is light-theme only. Figma is a reference, not a prerequisite for ordinary UI work.
