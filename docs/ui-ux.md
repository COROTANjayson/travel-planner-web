# Travel Planner UI/UX guide

Read this before changing screens or shared UI. This is the source of approved
frontend design decisions; the API owns domain behavior and authorization.
Exact implemented theme values live in `src/app/globals.css` and shared UI
components. Change them centrally within the requested scope. Code paths in this
guide are relative to the repository root.

## Calm travel workspace design

Approved 2026-10-20. This redesign replaces the earlier Illustrated Journey
visual identity; its Figma file is historical reference only.
Refined 2026-10-22 to strengthen hierarchy, shorten planning forms, and reduce
mobile chrome while preserving the existing planning model. Updated 2026-10-23
with a blue-gray page surface and coordinated blue-tinted hover states.

- Near-white blue-tinted background (#FCFDFF), charcoal text (#24272B), white reading
  surfaces, restrained blue actions (#275BCC), and readable muted text
  (#59616A). Use central semantic tokens and verify actual color pairings.
- Use cool borders (#DCE2EC), muted surfaces (#E9EDF3), blue-tinted hover
  backgrounds (#E4EBF7), and selected backgrounds (#E8EEF9). Outline and ghost
  buttons use the accent surface and blue text for hover and expanded states.
- Use system sans-serif typography for headings, controls, and reading. Page
  titles use 1.875rem below 768px and 2.25rem above; larger display text is reserved for the
  landing page. Supporting labels use sentence case, without decorative
  uppercase tracking. Use rem units and let long content wrap.
- Primary controls are at least 48px high; other product touch targets are at
  least 44px high. Input text is at least 16px. Calendar columns fit the available
  width on narrow screens while retaining 48px-high day buttons.
- The shell is bounded at 1440px. Gutters are 24px below 768px, 32px from
  768px, and 64px from 1280px. The trips overview is centered and bounded at
  64rem within that shell. Forms stay bounded at 44rem.
- Controls use 12px radii, cards 16px, and dialogs 24px. Reading cards use subtle
  borders without added shadows; overlays retain elevation. Avoid nested
  decorative surfaces or illustrated covers.
- Reading and form surfaces are opaque. Only navigation chrome uses subtle
  translucency, with solid fallbacks for reduced transparency/high contrast.
- The landing page uses one Plan a trip action and a clearly labeled sample
  itinerary with the planner's category colors. Examples do not create real
  schedules or imply saved user data.
- Keep real data, existing permissions, and domain behavior. Do not introduce
  automatic rescheduling, new endpoints, or decorative maps as product behavior.

## Navigation and trip planning

- Core journey: Trips -> Open trip -> Choose day -> View or add activity.
  Global navigation remains Trips, Invitations, and Account. Use compact top
  navigation from 768px and labeled, safe-area-aware bottom navigation below it.
  The authenticated brand link returns to Trips. Account uses the existing
  popover on desktop and a short sheet on mobile.
- Mobile navigation uses an inset, rounded dock with three equal, labeled touch
  targets. Keep selection on the icon capsule and label rather than filling the
  whole tab. Offset the dock above the bottom safe area and reserve room for it
  beneath page content and sticky actions. Use an opaque fallback for its material.
- Open trips into the itinerary. People and Settings are secondary actions.
  Give each view a clear dominant action and use explicit verb labels.
- Trip cards show name, destination, compact locale-aware dates, labeled status,
  inclusive day count, time zone, and a compact View trip cue. The entire card
  is one native link named by its trip heading, with visible keyboard focus;
  do not add a separate footer button. Put the name first, destination beneath,
  then dates and duration. Hover highlights the border and title without filling
  the card. Filter counts describe all
  loaded trips. Preserve ongoing/upcoming ordering before
  past trips across pagination, useful filtered empty states, and wider cards
  for sparse desktop lists. Status must not rely on color alone.
- Trip status filters use one horizontal row with count badges and an underline
  for the selected option. Let the row scroll on narrow screens; keyboard focus
  stays visible inside it. Empty-state text has a bounded, full-width column.
- Trip cards use one column below 1024px and two above; a sole card is bounded
  at 44rem. Use consistent cards without decorative covers and preserve
  visible text status badges. Activity cards use white bordered surfaces beside
  a time rail; keep time and title readable when controls wrap.
- Keep activity cards compact: use 12px horizontal and 14px vertical padding,
  16px titles, a muted time range,
  a small category badge beside the time, and optional place. Badges pair soft
  colors with a coffee cup for Rest, cutlery for Eating, a plane for Travel, and
  sparkles for Activity; custom labels use a neutral tag. Keep labels readable
  and allow long ones to wrap. Reuse the badge in details. The full card opens
  activity details. Cards have no three-dot menu; align Edit and Delete to the
  right in details. Preserve keyboard activation,
  visible focus, and at least 44px control touch targets.
- Trip creation asks for destination, dates, then a name. Exact times remain
  optional in a secondary section. If a destination
  change requires clearing entered exact times, explain and confirm the change;
  preserve the dates as the existing form does.
- Trip details use a centered 64rem workspace with a compact, unboxed header.
  Desktop back navigation sits beside the title, with People and Settings to
  the right. Destination, trip dates, and optional exact bounds wrap beneath.
  Mobile uses one back/title/options bar, with the full name in its options
  sheet and compact destination/date metadata below. The covered shell top bar
  is hidden from presentation and keyboard navigation only while the detail bar
  exists, preserving shell navigation during loading and errors.
- Planning uses a chronological timeline with a time rail. Keep previous/next,
  the calendar date trigger, and day position in one row, with Add activity on
  desktop. The date trigger's accessible name includes the selected date.
  Only that navigation row stays sticky on mobile. Group the daily summary,
  time zone, Today, View map, and Overlaps directly below, then show activities
  without another padded heading row. Keep empty days brief and permission-aware.
  Do not restore the redundant day strip or require swipe gestures.
- The selected day's summary shows activity count, earliest start and latest
  end in the trip zone. If the end crosses into another date, show that date;
  do not imply this range measures occupied time. Keep the time zone visible.
  Create/update successes use Sonner toasts rather than inline success banners.
  Mount one Toaster in the root layout, use top-right placement with mobile
  safe-area/header clearance, and emit one success per completed mutation from
  its existing API hook. Keep errors beside their forms and never include
  invitation tokens or other private data in notifications.
- The mobile Add activity button is inset above the global navigation dock,
  without a second full-width toolbar. Reserve room for both controls.
- Use View map to open the existing dialog at every screen size; do not reserve
  a permanent map column. Pins and the place list follow the selected day and
  identify activities.
  Keep itinerary/place details usable when the map fails.
- Show destination, dates, selected day, and trip zone clearly. Render the
  itinerary and conflicts in the trip zone using existing time helpers.
- Conflicts are advisory: show affected activities, jump to their day, and
  offer permitted editing. Never duplicate backend conflict calculations.
- Keep activity cards scannable: show notes, creator, and a plain bulleted to-do
  list only in the details dialog. Omit empty optional sections. All participants
  can read details; owners/editors can edit or delete. Return focus to the card
  after dismissal, or the day heading if the card disappears. Keep optional place
  selection and plain-language search and save feedback.
- Activity details use a bounded 32rem desktop dialog and a compact mobile
  sheet. Group category and date/time range beneath the title, showing a shared
  date once and retaining both dates for overnight activities. Keep the trip
  zone explicit. Use compact reading sections and a footer outside the scrolling
  body for creator attribution, outlined Edit, and soft-red Delete with icons.
  Secondary actions retain 44px touch targets, permissions and confirmation.
- Show an icon and text category badge on each activity card. Owners/editors use
  Add activity and select Rest, Eating, Travel, Activity, or Custom in the form.
  Custom labels are per activity; no category management screen.
- Activity forms show title, category, start and duration first. Place, To do,
  and Notes are expandable sections with right-aligned plus/minus indicators
  and flush-aligned helper text; saved content opens its section initially.
  Collapsing a section retains its draft. Native validation reveals collapsed
  invalid fields before focus moves to them.
- To-dos are simple text items: add, rename, or remove them in the existing
  activity form, then Save. Do not show checkboxes, completion counts, status
  labels, or strikethroughs. Preserve historical completion values in storage.
  Existing Sleeping activities retain their label and edit as a custom category.
- Explain role capabilities beside role selection. Invitation creation requires
  manually copying and sharing the one-time token; do not imply email delivery.

## Components, forms, and accessibility

- Reuse `src/components/ui` before adding primitives. Compose feature UI outside
  that folder. Use semantic theme classes, component variants, `cn()`, and
  Lucide icons; icon-only controls need accessible names.
- Start mobile-first; avoid fixed text heights and page-level horizontal
  overflow. Long names and enlarged text must wrap. Ordinary content reflows
  at 320 CSS pixels; surrounding map controls must also fit.
- Standalone creation and invitation forms use bounded white surfaces on
  desktop and the page surface on mobile. Sticky action backgrounds follow
  their containing surface. Keep dialog gutters at 24px.
- Activity Add/Save and Cancel buttons float in a sticky, right-aligned footer.
  Remove bottom scroll padding for activity forms and extend the opaque footer
  to the dialog edges so no fields peek through beneath it. Keep button padding.
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
- Keep control transitions specific and short (150ms); overlays use 180-220ms.
  Press feedback should not animate keyboard focus; reduced motion applies to the landing page and
  portaled controls as well as the application shell.
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
Mobile styling does not provide PWA installation, offline storage, or syncing;
those capabilities remain outside this design refinement.
Recheck dark-theme behavior if enabling/changing it; automated contrast coverage
is light-theme only. Figma is a reference, not a prerequisite for ordinary UI work.
