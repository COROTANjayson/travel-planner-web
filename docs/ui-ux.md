# Travel Planner UI/UX guide

Read this before changing screens or shared UI. This is the source of approved
frontend design decisions; the API owns domain behavior and authorization.
Exact implemented theme values live in `src/app/globals.css` and shared UI
components. Change them centrally within the requested scope. Code paths in this
guide are relative to the repository root.

## Coastal Folio design

Approved 2026-10-25 from the reviewed Coastal Folio Figma design. This replaces
prior blue/system-font guidance. Step 1 applies shared styling across the app
and rebuilds navigation and Trips. Step 2 extends this direction to trip details,
the day rail and activity detail views. Landing, authentication and forms retain
their existing layouts and behavior.

- Self-host Manrope through `next/font/local`; use its variable font for headings,
  controls and reading. Preserve wrapping, rem sizing and browser text scaling.
- Near-white page #FAFCFA, dark ocean text #183D3E, muted text #52685B, white
  reading surfaces, teal actions/focus #0E7277, and borders #DCE5DE. Inputs use
  #6F8277 boundaries. Destructive actions use #9C4034. Verify actual pairings.
- Desktop sidebar and mobile dock use opaque ocean #123C40 and supporting text
  #BDD2CE. The mobile selected tab uses pale aqua #BFE3DC; sidebar active links
  use #28585D with white text. Create Trip uses aqua in the sidebar.
- Trip surfaces use sea #DCECE7, sand #F2EFDF and mist #EDF0F3. Ongoing badges use
  #1C6465/white; upcoming badges match sand (#E5DDBF/#625333) or mist
  (#D9E3E9/#405A69). Upcoming tones stay stable by trip ID. Past badges use
  #E9EDE8/#526258. Status always has text.
- No photos or raster covers. Reuse the approved vector route geometry from
  `public/coastal/journey.svg` for cards and the sidebar. Hide it on past trips.
- Primary actions use pill shapes, shared reading cards 16px radii, trip cards
  24px, dialogs 24px, and sidebar right corners 28px. Use borders for reading
  surfaces and restrained shadows only for floating navigation and overlays.
- Keep touch controls at least 44px and primary form controls 48px; inputs 16px.
  Avoid fixed text heights, preserve clear keyboard focus, and reserve safe-area
  clearance for navigation and actions. Do not introduce a dark-mode UI.
- Preserve real data, permissions, authentication, UTC instants and IANA zones.
  No new endpoints, automatic rescheduling, routing or booking behavior.

## Navigation and trip planning

- Core journey: Trips -> Open trip -> Choose day -> View or add activity.
  Global destinations remain Trips, Invitations and Account. The authenticated
  brand returns to Trips. Existing account popover/sheet and session actions remain.
- At 1024px and above, show a 236px fixed, scrollable ocean sidebar with 28px
  right corners, Create Trip, active navigation and the account area. From 768px
  through 1023px, use the existing compact top navigation. Below 768px, use a
  floating three-item capsule dock: 16px side/bottom gaps plus safe-area insets,
  maximum 420px width, 56px minimum height and 44px tab targets. Both the outer
  dock and selected tab have fully rounded ends. Enlarge naturally with text zoom.
- Trips has a destination/name search, All/Ongoing/Upcoming/Past segmented status
  controls and counts. Search trims surrounding spaces and ignores case; search
  and status combine before pagination. Reset pagination on either change.
  Counts describe all loaded trips; the live result count describes matches.
  The empty-result reset clears both filters and returns focus to search.
- Preserve existing ordering and 10-item pages. Feature only the first ongoing
  trip in the current filtered result set; do not repeat it on later pages.
  Remaining ongoing/upcoming trips use two columns from 1024px, otherwise one.
  Past trips use compact full-width desktop rows. A sole trip fills the grid.
- Only Trips uses 20px mobile content gutters, reduced to 16px below 360px.
  Retain the other screens' existing 24px mobile shell gutters.
- Cards show the full API destination prominently, trip name, locale-aware date
  range, inclusive duration, explicit time zone and coordinated status badge.
  The entire card is one native link named by its trip-name heading; the arrow
  is a visual cue. Never invent country fields, images or activity counts.
  Decorative featured date endpoints supplement the complete readable date range.
- Create Trip links to `/trips/new`; it keeps the existing validated form and save
  behavior. Distinguish an empty account from empty search/status results. Provide
  reset, loading skeletons, safe errors and retry, pagination and visible focus.
- Open trips into the existing itinerary. People and Settings remain secondary.
  The following itinerary requirements describe the approved Step 2 implementation.
- Activity cards use 16px mobile padding and 20px desktop padding with a 128px
  desktop minimum height, 16px titles and 16px separation between entries. Put
  the category in a softly rounded rectangular badge at top left, elapsed
  duration and chevron at top right, then title and optional place below. Place
  the complete activity time range outside the card. Badges pair soft
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
- Trip details use a bounded 72rem workspace. People, Settings and Back to trips
  sit above a pale sea summary with the full destination, name, coordinated status,
  inclusive dates, day count, zone and optional exact bounds. Reuse the approved
  route geometry, without photos. Mobile keeps a compact back/options bar and a
  fully readable name in the summary; hide the covered shell header only while
  the trip bar exists, preserving navigation during loading/errors.
  On mobile, use 16px summary padding, 8px/12px title margins and 6px metadata
  row gaps so the summary stays compact without reducing text sizes.
- At 1024px and above, use a sticky 160px vertical day rail beside the timeline.
  Below that, use a horizontal native scrolling day selector; it stays beneath
  the mobile trip bar. Show weekday, date, Today where relevant, and loaded day
  counts. Load seven trip-local dates at a time, bounded by the trip end; the
  calendar provides access across long trips. Do not invent zero
  counts while loading or unavailable. Keep the selected mobile date in view.
- Below the day strip, show a full weekday/date heading and a compact day-position
  and activity-count line. Put a secondary calendar action beside the heading
  (icon-only on mobile, labeled Choose day on desktop) and Add activity on desktop.
  Do not show previous/next day arrows or an aggregate day-level time range.
  The zone is already visible in the trip summary. On mobile, put a
  Day options settings icon beside the calendar. Its bottom sheet holds Today,
  View map and Overlaps; selecting a tool closes the sheet and opens that tool,
  returning focus to the settings icon on dismissal. Hide the utility row on
  mobile; desktop keeps the tools inline.
  The timeline has a desktop time rail and mobile time labels above full-width
  activity cards. Empty days remain brief and permission-aware.
- The selected day's summary shows its activity count. Each activity's complete
  start/end range sits above its mobile card or in the desktop time rail. Stack
  desktop start and end labels without a visible dash, beside a dot and thin
  vertical connector. Do not repeat start/end times inside cards. For an overnight/multi-day activity, include its
  actual end date. Keep the trip zone visible in the summary.
  Create/update successes use Sonner toasts rather than inline success banners.
  Mount one Toaster in the root layout, use top-right placement with mobile
  safe-area/header clearance, and emit one success per completed mutation from
  its existing API hook. Keep errors beside their forms and never include
  invitation tokens or other private data in notifications.
- The compact mobile Add activity pill is right-aligned above the global dock,
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
- Activity details use a modal 480px right drawer from 768px and a full-screen
  mobile view. Keep the itinerary behind the drawer, with the selected card
  outlined. Back to itinerary and permitted Edit stay at the top. The title,
  category, schedule and optional place, notes and plain to-do sections share one
  scrolling reader; creator and permitted Delete stay in the bottom footer.
  Put the category badge above the title. Below the title, a calendar icon sits
  beside the full weekday/date; a smaller line shows the time range, elapsed
  duration in minutes and trip zone. Retain both dates for overnight activities.
  The full schedule retains both dates for overnight/multi-day activities and the
  explicit trip zone. Back, Escape and outside dismissal preserve selected day
  and return focus to the card
  or selected-day heading. Edit opens the existing form, Delete its confirmation.
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
