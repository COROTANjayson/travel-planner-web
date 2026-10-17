# Travel Planner UI/UX guide

## Purpose and status

Read this guide before creating or changing frontend screens or shared UI.
It is the repository source of truth for UI/UX decisions. The architecture brief
and API remain authoritative for domain behavior and authorization.

The user authorized applying this guide to the frontend on 2026-10-11. The workflow,
reuse, accessibility, and verification rules below apply to future UI work.
The sizing, radius, and light-theme palette below are adopted defaults;
apply them through shared tokens/components within the requested task scope.
When the user approves a visual decision, update its status here and implement
it in shared tokens/components within that task's scope.

## Approved Illustrated Journey update — 2026-10-11

Source: https://www.figma.com/design/ZreGSmwJEIhzQEwu6toBci
The user approved integrating this concept. These decisions supersede earlier navy/ivory values below.

- Palette: cream #FFF9F1 background, plum #29243D text/primary actions, coral #E88973 add/create actions with plum text, lavender #DCD6F3 accents, white reading surfaces, muted #5D5667 (darkened from Figma #6B6475 for readable text on lavender), border #E4DDD9. No green branding.
- Fonts: Lora regular for page/display headings; DM Sans for controls and reading. Mobile title 32/40px; desktop display 56/64px; body 16/24px; labels 14/20px; captions 12/18px. Use rem and allow wrapping.
- Trips: decorative coastal artwork, prominent first trip, visible destination/dates/status and Open itinerary. Real trip names replace sample Figma copy. Other trips retain the same visual language.
- Planning: compact illustrated header, selected-day buttons, chronological single-day timeline with a time rail. Desktop adds a real map companion; mobile retains View map. Previous/next and date picker support trips longer than three days.
- Card radius: mobile outer 24px with 8px inset and 16px inner artwork; desktop featured outer 32px, inset 8px and inner 24px. Controls 12px, activity cards 16px, dialogs 24px.
- Page gutters: mobile 24px, desktop 64px at the large breakpoint, max shell width 1440px. Primary controls minimum 48px; other targets at least 44px.
- Artwork is decorative, never evidence of a real destination. Reuse the downloaded Figma SVGs in public/illustrations. Preserve their intrinsic proportions and clip inside the designed slot.
- Production adaptations: retain Travel Planner branding, real API data, permissions, timezone handling, editable forms and advisory conflicts. Do not implement the prototype's invented dinner, prefilled fields, automatic rescheduling or schematic map as real data.
- Implementation touches shared theme/fonts, Trips cards, trip header and Itinerary layout. Existing loading/error/empty states and mutation safeguards remain required.

## Product direction

A calm, adventurous planner: warm travel imagery with restrained working
surfaces. The itinerary is the main focus. References inform mood and hierarchy;
do not copy their layouts or infer exact measurements from screenshot pixels.

Choose one consistent imagery style. Large illustrations belong mainly on
welcome and empty states. Working screens prioritize dates, places, and actions.
Do not add booking, ratings, discovery feeds, or navigation destinations merely
because they appear in a reference.

## Navigation and user tasks

- Core journey: Trips → Open trip → Choose day → View or add activity.
- Keep global navigation to Trips, Invitations, and Account unless a requested
  feature needs another destination. Keep labels visible on mobile navigation.
- Open a trip into its itinerary. People and Settings are secondary actions.
- Give each screen one dominant action: Create trip, Add activity, or Save
  changes. Avoid duplicate competing primary actions in the same view.
- Use explicit verbs: Invite people, View itinerary, Save changes. Icons alone
  need accessible names; essential navigation should also have visible labels.
- On mobile, make one day easy to read, with visible previous/next controls
  and a date picker. Swiping may supplement these controls, never replace them.
- On desktop, use width for adjacent days or itinerary/map context when useful.
  Preserve a usable list when a map is unavailable.
- Keep destination, dates, selected day, and trip time zone easy to find.
  Display activity times in the trip time zone; retain existing UTC/IANA handling.
- Preserve entered values and selected day after recoverable errors. Protect
  unsaved work when dismissing an editing surface.
- Show overlapping activities and times when explaining schedule conflicts,
  with a clear route to edit them. Do not duplicate backend conflict logic.
- Explain role restrictions without exposing unauthorized actions or data.
- Put optional information behind disclosure; keep essential information visible.

## Responsive layout and sizing — adopted defaults

Values below are CSS pixels, not physical screen pixels. Use rem for typography
so user font preferences remain effective. Heights are minimums; allow content
to wrap and controls to grow.

| Element | Mobile | Desktop |
| --- | --- | --- |
| Page gutters | 16px | 24–32px |
| Page title / line height | 28px / 34px | 36px / 44px |
| Section heading / line height | 20px / 28px | 24px / 32px |
| Card title / line height | 18px / 26px | 18px / 26px |
| Body / line height | 16px / 24px | 16px / 24px |
| Supporting text / line height | 14px / 20px | 14px / 20px |
| Form label / line height | 14px / 20px | 14px / 20px |
| Input text / line height | 16px / 24px | 16px / 24px |
| Buttons and inputs | Minimum 48px height | Minimum 44px height |
| Card padding | 16px | 24px |
| Section spacing | 24px | 32px |
| Icon artwork | 20–24px | 20–24px |

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Related items sit closer
  together than separate groups. Use existing utilities/tokens where possible.
- Start with the existing approximately 1152px maximum page width and forms
  around 640px maximum. Do not widen forms just to fill desktop space.
- Start mobile-first. Existing 768px and 1024px transitions are starting points;
  change layout when content stops fitting, not for a named device model.
- Do not impose fixed heights on text cards. Long names and larger text wrap.
- Reserve space for sticky navigation/actions and device safe areas. Verify
  controls and focused fields remain visible when the mobile keyboard opens.
- Prefer full-screen mobile forms for longer tasks and sheets for short choices;
  use bounded dialogs on desktop. Preserve existing dialog behavior and focus.
- Avoid page-level horizontal overflow. If a day board scrolls horizontally,
  keep it contained and provide explicit date navigation and a narrow-screen
  reading layout; do not require a swipe to access a day.

## Corner radii — adopted defaults

| Surface | Radius |
| --- | --- |
| Buttons and inputs | 12px |
| Cards and panels | 16px |
| Large dialogs / mobile sheet top corners | 24px |
| Avatars and compact status pills | Fully rounded |

For closely nested concentric surfaces:

`inner radius = max(0, outer radius - inset)`

Example: a 24px outer radius with an 8px inset uses a 16px inner radius.
The inset is the distance between the two surface edges, including borders.
This applies only when the edges closely follow one another. A button inside
a card keeps its component radius. A flush image matches the card corners.

The shared radius scale uses a 12px base: controls 12px, cards 16px, dialogs 24px.
When implementing an approved radius change, reconcile the shared scale in
`src/app/globals.css` and affected UI components; avoid per-screen overrides.

## Color and imagery — adopted direction

- White cards, a subtly tinted background, dark readable text, and one primary
  accent. Navy (#243B6B) is the primary accent; warm ivory (#FAF8F5) is the
  page background, charcoal (#202938) is the main text, and peach (#F4C7AB)
  decorates welcome surfaces. Pale blue marks selected navigation and filters.
  The user rejected green/teal on 2026-10-11; do not reintroduce it as branding.
  Status badges retain labels: neutral gray for Past, blue for Upcoming, amber
  for Ongoing. Keep the trip name first, badges top-right, and dates compact
  using locale-aware range formatting. Use wider desktop cards for sparse lists.
  Light-theme tokens live in src/app/globals.css; verify actual color pairings.
- Reserve the strongest accent for primary actions and selected states.
- Give status meaning through text or icons as well as color. Keep destructive
  actions distinct from ordinary primary actions.
- Prefer borders for ordinary cards and stronger shadows for floating surfaces.
- Keep decoration away from controls and critical itinerary information.
- Verify text contrast over each actual image; use an overlay or separate text
  surface when needed. Images need meaningful alt text or empty alt for decoration.

## Forms, feedback, and accessibility

- Reuse existing Button, Input, Label, Select, Calendar, Card, Alert, and dialog
  components. Preserve keyboard behavior, validation, focus, and error handling.
- Use persistent labels, not placeholder-only fields. Explain required formats
  and associate errors with fields. Keep entered values when saving fails.
- Show submission progress, prevent accidental duplicate submissions, and
  announce success/errors accessibly. Never imply an unsaved change was saved.
- Loading: explain what is loading and avoid unnecessary layout shifts.
- Empty: explain the state and provide the next useful action.
- Error: explain what failed and offer retry or a route back when appropriate.
- Permission denied/not found: provide safe, understandable recovery without
  revealing restricted information.
- Destructive confirmation: name what will be deleted and the consequences.
- Keep visible keyboard focus, logical focus order, and dialog focus return.
  Respect reduced motion; no essential action may depend on hover or animation.
- Normal text requires at least 4.5:1 contrast; qualifying large text requires
  3:1. Relevant control boundaries and state indicators require 3:1 where WCAG
  non-text contrast applies. Check actual colors, including muted text.
- Use the adopted 48px mobile target size as the product comfort default,
  distinct from WCAG 2.2 AA's 24×24px minimum with its defined exceptions.
- Ordinary content must reflow at 320 CSS pixels without two-dimensional
  scrolling. Maps have specific exceptions; surrounding controls still reflow.

Accessibility references:

- [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## Applying and maintaining the guide

1. Identify the user's main task, primary action, and affected screens/components.
2. Read the relevant existing components and reuse their patterns. Implement
   approved design values through shared semantic tokens and components.
3. Define mobile/desktop behavior and relevant loading, empty, error, success,
   permission, and unsaved-work states before finishing the change.
4. Verify the affected views at narrow mobile and desktop widths, with long
   text, keyboard navigation, and zoom. Check sticky controls, safe areas, and
   keyboard overlap when the change affects them. Report unverified checks.
5. Run checks required by AGENTS.md for behavioral or compilation changes.
   Documentation-only changes do not need a frontend build.
6. When the user deliberately changes a design decision, update this guide
   and the corresponding shared implementation in the authorized scope.
   Resolve contradictions centrally; do not accumulate local exceptions.

For future Figma work, begin with foundations plus Trips and Trip itinerary at
mobile and desktop widths. Keep the same names and values as code tokens.
Figma illustrates these rules; it is not required to apply this repository guide.

Implementation notes (2026-10-11): the landing page, trip list, trip details,
creation and invitation screens share the adopted theme. Mobile day columns
use the full available width; the date controls remain visible, and Today sits
outside the previous/date/next row to preserve room on narrow screens.
Run `node scripts/check-ui-contrast.mjs` for light-theme token contrast and the
existing itinerary, membership, and auth scripts for behavioral regressions.
The public landing page was checked at 320px and 1440px viewport widths on
the local preview at port 3001: no horizontal overflow, 48px mobile action
targets, and Plan a trip correctly reaches the signed-out creation route.
The signed-in Trips list was also checked at 320px and 1440px with the adopted
navy palette: no horizontal overflow, 48px mobile actions/filters, a 544px
desktop card for a sparse list, and working All/Past/Upcoming filters including
the filtered empty state. The preview was restored to All and its normal size.
Other signed-in layouts, zoom, keyboard-overlap, and dark-theme checks remain pending;
token contrast checks do not replace those checks.

## UI change review checklist

- [ ] The main task and primary action are obvious; navigation labels are clear.
- [ ] Existing components/tokens are reused; new features are within scope.
- [ ] Mobile and desktop layouts fit, including long text and zoom.
- [ ] Text, target sizes, focus, and keyboard/dialog behavior are accessible.
- [ ] Relevant loading, empty, error, success, and permission states are handled.
- [ ] Forms retain recoverable work; destructive actions explain consequences.
- [ ] Sticky controls, safe areas, and keyboard do not cover essential content.
- [ ] Approved design changes are reflected here; missing verification is reported.
