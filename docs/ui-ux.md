# Travel Planner UI/UX guide

Read this before changing any UI. Approved Figma designs are the source of truth
for visual implementation. This guide records implementation conventions, and
the API owns domain behavior and authorization.
Exact implemented theme values live in `src/app/globals.css` and shared UI
components. Change them centrally within the requested scope. Code paths in this
guide are relative to the repository root.

## Figma-first UI workflow

The user does not have a Figma MCP plugin subscription. Use the local Figma
desktop app and computer-use screen controls to inspect approved designs,
measurements, and component properties. This workflow does not require Figma
MCP access; unavailable MCP access alone is not a blocker.

1. Before editing any UI, including CSS-only fixes, use the local Figma app to
   open the relevant approved frames and components in the
   [Travel Planner Figma file](https://www.figma.com/design/fSnvj7wJlyAcAUGdWsGxFX/Travel-Planner-%E2%80%94-Coastal-Folio).
   Confirm which frames are approved. The file also contains generated
   references that mirror the app.
2. Check the full affected UI against the approved design, including buttons,
   forms, component states, typography, icons, colors, alignment, dimensions,
   gaps, margins, padding, and responsive layouts. Use the Figma measurements
   and layout properties to guide the implementation.
3. If a required screen, component, or state is missing, tell the user exactly
   what needs to be added and wait for their Figma update before implementing
   that UI. If the local app cannot provide verified design context, try screen
   controls in the Figma web UI. If neither route is accessible or the approved
   frame is unclear, report the blocker and wait for verified design context.
4. Before reporting completion, compare the rendered app and approved Figma
   frames at matching viewport widths. Measure the affected dimensions and
   spacing in both, and resolve discrepancies across the affected layouts and
   states.

## Coastal Folio design

Approved 2026-10-25 from the reviewed Coastal Folio Figma design. This replaces
prior blue/system-font guidance. Step 1 applies shared styling across the app
and rebuilds navigation and Trips. Step 2 extends this direction to trip details,
the day rail and activity detail views. Landing, authentication and forms retain
their existing layouts and behavior.

The Figma file includes Foundations (colors, type, spacing, radius), Components,
and Screens. A local Figma plugin generates reference content from the
repository's tokens and components. Screens also contains the approved
[form simplification](#form-simplification-approved-design-not-yet-built) for
Add activity and Add expense and the approved
[Prep inside activities](#prep-inside-activities-approved-design-not-yet-built)
design.

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
- Match measured Figma radius values to the project's actual tokens:
  `rounded-xl` is 16px, `rounded-2xl` is 24px, and `rounded-3xl` is 32px at
  the default root font size. Reading cards, maps, and bordered content lists
  use 16px; trip cards and summaries use 24px. Desktop dialogs use 24px;
  mobile sheets use 24px top corners and square bottom corners. Check approved
  component variants before applying exceptions. Verify computed browser radii
  on compact and wide surfaces at matching Figma viewport widths. Interaction
  overlays inherit their card's radius, and nested backgrounds follow the
  enclosing corners. Loading surfaces match the corresponding loaded surface.
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
- Open trips into the existing itinerary, directly below the shared trip summary,
  with no day-rail label. Expenses and Prep are separate pages: Expenses and Prep
  buttons in the desktop header (and entries in the mobile trip menu) open
  `/trips/{id}/expenses` and `/trips/{id}/prep`; each shows a "Back to itinerary"
  link instead of the Expenses/Prep buttons. Group expenses are managed on
  the Expenses page or inside their activity. People and Settings remain secondary and available in every view.
  The following itinerary requirements describe the approved Step 2 implementation.
- Activity cards use 16px mobile padding and 20px desktop padding with a 128px
  desktop minimum height, semibold 18px mobile and 20px desktop titles and 16px
  separation between entries. Put
  the category in a softly rounded rectangular badge at top left, elapsed
  duration (`45 min`, `4 hr`, `1 hr 30 min`) and chevron at top right, then title and optional place below. Place
  the complete activity time range outside the card. Badges pair soft
  colors with a coffee cup for Rest, cutlery for Eating, a plane for Travel, and
  sparkles for Activity; custom labels use a neutral tag. Keep labels readable
  and allow long ones to wrap. Reuse the badge in details. The full card opens
  activity details. Cards have no three-dot menu; align Edit and Delete to the
  right in details. Preserve keyboard activation,
  visible focus, and at least 44px control touch targets.
- Trip creation searches when the traveler selects Search or presses Enter.
  It shows the resolved place, time zone, and a Change action. Start and End
  open the date’s month in a shared range calendar, inline on desktop and in a
  sheet on mobile. Show the inclusive trip length and suggest “Trip to
  {destination}” while preserving custom names. Use “My trip” when the
  destination-based suggestion exceeds the API’s name limit.
- Use a centered form card and Cancel on desktop. On mobile, use the page as
  the form, a Close action in the header, and a pinned Create trip bar in
  place of the dock. The bar summarizes the trip or says what is missing.
  Exact times remain optional in a secondary section. If a destination
  change requires clearing entered exact times, explain and confirm the change;
  preserve the dates as the existing form does.
- Trip details use a bounded 72rem workspace. Add activity is the only filled
  action above the timeline. On desktop, plain muted Back to trips text, member
  initials (up to three, then +N) for People and an icon-only Settings gear
  sit above a pale sea summary with the full destination, name, coordinated status,
  inclusive dates, day count, zone and optional exact bounds. Reuse the approved
  route geometry, without photos. Mobile keeps a compact back/options bar and a
  fully readable name in the summary; hide the covered shell header only while
  the trip bar exists, preserving navigation during loading/errors.
  On mobile, use 16px summary padding, 8px/12px title margins and 6px metadata
  row gaps so the summary stays compact without reducing text sizes. From 768px,
  use 24px/32px padding, a 28px title and 8px/12px title margins, with 24px
  below the summary.
- At 1024px and above, use a sticky 160px vertical day rail beside the timeline.
  Below that, use a horizontal native scrolling day selector; it stays beneath
  the mobile trip bar. Show weekday, date, Today where relevant, and loaded day
  counts. Load seven trip-local dates at a time, bounded by the trip end.
  Do not invent zero
  counts while loading or unavailable. Keep the selected mobile date in view.
- Below the day strip, show a full weekday/date heading and a compact day-position
  and activity-count line. Put Add activity beside the heading on desktop.
  Do not show previous/next day arrows or an aggregate day-level time range.
  The zone is already visible in the trip summary. On mobile, put a
  Day options settings icon beside the heading. Its bottom sheet holds Today,
  View map and Overlaps; selecting a tool closes the sheet and opens that tool,
  returning focus to the settings icon on dismissal. Hide the utility row on
  mobile; desktop keeps the tools inline in the heading row as muted text without icons. Overlaps
  appears only when the selected day has overlaps or they cannot be loaded.
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
  identify activities. Keep full addresses visible in the place list.
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
- Activity details use a modal 680px right drawer from 768px and a full-screen
  mobile view. Keep the itinerary behind the drawer, with the selected card
  outlined. Back to itinerary stays at the top; permitted pencil buttons sit
  beside the activity heading, Place, Notes, and To do. The title,
  category, schedule and optional place, notes and plain to-do sections share one
  scrolling reader. Creator and permitted Delete stay visible in a bottom footer,
  outside the scrolling content. Follow the supplied November 2 flow:
  both desktop and mobile stack a short Expenses summary, Notes, and To do.
  The summary is the tappable Expenses row (count, "N from Prep", total, your
  share, chevron).
  One Expenses screen uses underlined All expenses and My expenses tabs to switch views inside the activity window. Keep the desktop drawer attached to the right,
  bounded at 680px from 768px; mobile remains full-screen. Add activity uses the
  same drawer width.
  Show the category badge above the title, followed by the weekday/date,
  time range and trip zone. Retain both dates for overnight activities.
  The full schedule retains both dates for overnight/multi-day activities and the
  explicit trip zone. Back, Escape and outside dismissal preserve selected day
  and return focus to the card
  or selected-day heading. Each pencil edits only its own section in place,
  with local Save and Cancel actions. Keep all other activity content, expenses,
  creator and Delete visible. There is no separate activity edit screen or global
  Edit button. Show empty editable sections to owners/editors with one Add action
  in place of the pencil. Delete in the bottom footer is a quiet destructive text
  action that opens its confirmation.
- Show an icon and text category badge on each activity card. Owners/editors use
  Add activity and select Rest, Eating, Travel, Activity, or Custom in the form.
  Custom labels are per activity; no category management screen.
- Add activity follows the Figma "Add activity" frames: the 680px right drawer
  on desktop (square corners, ghost Back to itinerary row) and a tall sheet on
  mobile. It is headed by its fixed day (Add activity stays the dialog's
  accessible name) and starts with Activity name, then "What kind of plan?"
  pill category chips (muted when unselected; the selected chip takes its card
  badge color, border and filled icon; Custom is a dashed "+ Custom"; default
  Activity), and the fields for When. An Add more row of secondary pills offers
  Place, Notes, Prep task and Expense. Tapping one opens that section as in
  activity details, and its pill goes; the Expenses card stays last. Prep task
  opens "Prep tasks" above Add more: title-only inputs, a small "Add another"
  link and "Saved as up for grabs. Assign people from the activity later."
  Non-blank titles become unassigned one-person tasks on the new activity after
  it saves; if any fail, a toast says the activity was saved without them.
  To-do items are added from the saved activity's To do section.
- Activity details shows Prep above Expenses (Figma "Activity details"): a
  small muted "Prep" label with an "Add task" link for owners and editors, a
  96px progress bar with "N of M done", and the activity's open tasks as Prep
  rows (your own tasks show no "You"; done tasks fold into one "N done" row).
  With no tasks it says "Nothing to prepare yet." Add task opens a menu
  (popover on desktop, bottom sheet on phones): New task opens Add a task with
  a fixed "For: activity · day" row and no Trip day or Activity pills; From Prep
  opens "Add from Prep", a searchable checklist of unfinished trip-wide tasks
  whose expenses move with them ("Add N tasks"). A row's options add "Remove
  from activity", confirmed with a red Remove: the task goes back to the whole
  trip and its expenses leave the activity.
- Activity Place uses the Figma destination pattern. A chosen place is a
  "Destination row" (map pin, name, address, a small Change link and a 44px X
  to remove it). Searching shows one 48px field with a search icon and a small
  Search button inside it; Enter also searches. Searches never run while typing
  (OpenStreetMap's public search does not allow autocomplete). Results use the
  "Dropdown list" style. While changing, "Keep <place>" restores the chosen
  place. Labels use the
  default dark label style. Required fields show a red asterisk; there is no
  explanatory subtitle. When is never collapsible: Start time (clock icon, with
  the inline time wheel under it while focused) and Duration share a row on
  desktop, and one line under Start time gives the end time and trip zone.
  Duration is a select (30 minutes, 1 hour, 2 hours, Custom duration); Custom
  shows Duration (hours). The title pencil's form uses the same chips and
  fields, with a date input.
- The pinned footer holds one action, Save activity (full width on mobile);
  Back to itinerary is the way out.
- Back, Escape and outside dismissal of Add activity ask "Discard this
  activity?" ("What you typed will not be saved.") only when something was
  typed or chosen; Keep editing returns to the form with its values.
- Empty day: for owners and editors, the "Nothing planned yet" card holds an
  outlined Add activity button. Add activity above the timeline stays the only
  filled action. Viewers see no button.
  Existing activities use section pencils.
  Notes holds the activity description and other free-form reminders.
- To-dos are simple text items: add, rename, or remove them in the existing
  activity form, then Save. Do not show checkboxes, completion counts, status
  labels, or strikethroughs. Preserve historical completion values in storage.
  This applies to activity to-dos only; Prep tasks are a separate trip-level list.
  Existing Sleeping activities retain their label and edit as a custom category.
- Prep follows the Figma Prep frames (Screens page, Prep section). Under the
  heading, "2 of 6 done" and a thin progress bar replace the subtitle; an
  everyone task counts as done when every current participant has ticked it.
  The All, For you, and By activity chips switch views and survive dialogs.
  All shows For you (your unfinished tasks and everyone tasks awaiting your
  tick), Up for grabs, With others, then a collapsed "Done · N"; empty sections
  are left out. For you shows only what waits on you. By activity groups
  unfinished tasks by activity date, earliest first, then Whole trip.
- Each section is one bordered list with a 16px radius, flat rows and
  dividers. A row leads with a checkbox when you can tick it, a dashed circle
  when unclaimed, the assignee's initials when it's someone else's, and a check
  when done. Its detail line joins who it waits on or who did it, the day, the
  activity (an itinerary deep link, except in By activity), and linked expense
  totals per currency with " · ". Claim shows on unclaimed tasks, Drop on yours,
  and everyone tasks show a "3 of 5" pill. Owners and editors get the options
  menu: Reopen (finished tasks), Edit, Assign (unfinished one-person tasks), and
  Delete. The title opens task details; the checkbox, buttons, link, and menu
  work on their own. Focus returns to a row that an action moved, or the Prep
  heading when that row is hidden by the current view.
- Add task asks What needs doing and Who's on it (Up for grabs by default, Me,
  Pick someone, Everyone), with Trip day and Activity behind Add more pills.
  Its footer is Cancel, Save and add another, and Add task (full width above
  the other two on mobile). Save and add another keeps the assignment, day and
  activity, clears and focuses the title. One request key covers every retry
  until success or cancellation, including edited retries after a failed save.
  Edit shows who's on it as text; Assign changes the person.
  Delete names the task and says its expenses stay in the trip's expenses.
- Task details is the 680px right drawer on desktop and a tall sheet on mobile:
  who's on it, the activity link or Whole trip, the expenses with each one's
  total, your share and payment status, a per-currency task total, and the one
  action you can take (Mark done, Mark my part done, or Claim). Editors add and
  edit expenses with the shared cost editor, which shows the task as fixed
  context; tapping an expense opens the shared payment workspace. Both return to
  the task. Expenses failing to load show their own retry; the task stays usable.
- Viewers get read-only rows and details with a one-line note. A task that
  changed underneath someone shows a notice above the list, refreshes it, and
  keeps the page in place.
- The People dialog shows the owner's invite form, then one row per person, then
  pending invitations only, omitting that section when there are none. Explain role
  capabilities inside the role dropdown rather than on every row. Transfer ownership
  and Remove sit behind each row's More options button. Invitations appear in the
  recipient's account; do not imply email delivery.

## Components, forms, and accessibility

- Reuse `src/components/ui` before adding primitives. Compose feature UI outside
  that folder. Use semantic theme classes, component variants, `cn()`, and
  Lucide icons; icon-only controls need accessible names. Every button variant
  is pill-shaped, so a Cancel beside a primary action has the same corners.
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
  errors. Confirm destructive consequences.
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

## Form simplification (approved design, not yet built)

Approved 2026-11-13 as a design only. **The app does not implement this section
yet**; the rules elsewhere in this guide still describe current behavior. When a
rule here is built, move it into its section above and delete it from here. The
Figma Screens page shows these designs. The Add expense part is built
(2026-11-22); Add activity is not.

The aim is fewer decisions before saving: sensible defaults, fewer visible
fields, and the same patterns in every form. No capability is removed, no new
endpoints, and no new libraries (Base UI `Combobox` is already installed).

- All forms: inputs are 48px high with no per-form height overrides. Labels use
  the default dark label style, not muted text. Required fields show the red
  asterisk. Each error sits under its own field, and the first invalid field
  takes focus. Actions are right-aligned, Cancel then the primary action.
  Built for the expense forms (Add expense steps and Record money lent); Add
  activity still to do.
- Unchanged: Trips and Invitations. (The trip Expenses page, payment and
  loan screens were since aligned with their Figma frames; see Expenses.) A
  wider wording pass for money terms is not part of this design.

## Prep inside activities (approved design, not yet built)

Approved 2026-11-14 as a design only. **The app does not implement this section
yet.** The Prep page, task details and task-linked expenses are built and
described under Navigation and trip planning. When a rule here is built, move it
there and delete it from here. The Figma Screens page shows these designs.

- Prep inside activities: a prep task linked to an activity shows in that
  activity's details as well as on the Prep page. It is one task; ticking,
  claiming or editing it in either place is the same change.
- Activity details: the header holds when and where as three icon lines under
  the title (day and time range, trip zone, place), with one pencil for all of
  them; Place is no longer its own section. Then Prep, Expenses and Notes, each
  under a small muted label rather than a large heading. On mobile a close (X)
  on the title row replaces the Back to itinerary row.
- A Prep section replaces the activity's To do list. It shows open tasks with
  the Prep page rows, a thin "1 of 3 done" progress line under the label, and an
  Add task link; done tasks collapse into one "1 done" row. Rows that are yours
  drop the "You" line, and Drop uses the same small outlined button as Claim.
  With no tasks the section reads "Nothing to prepare yet."; viewers see
  read-only rows. Add task opens the Add a task form with the activity shown as
  a fixed line and its day filled in; there is no activity or day picker.
- Expenses is one tappable row: total and your share on the right, the expense
  count under the label, and a chevron. It replaces the summary panel and the
  separate View expenses button. Notes keeps its own pencil.
- Activity cards: an activity with prep tasks shows one line under the place,
  "2 of 3 prep done", or "1 prep task for you" in teal when one waits on you.
  Cards without tasks show nothing. If Prep cannot load, offer a retry above
  the timeline. Route access errors through the trip’s access handling.
- Add activity: the To do pill becomes Prep task. It opens title-only task
  lines with Add another, saved as up for grabs; people are assigned later from
  the activity.
- Building this needs backend work: existing activity to-do items become
  unclaimed prep tasks on their activity, and the activity's to-do list stops
  being edited separately. Until then, activity To do stays as described under
  Navigation and trip planning.

## Expenses

- Follow revised Figma sections [07](https://www.figma.com/design/fSnvj7wJlyAcAUGdWsGxFX/Travel-Planner?node-id=68-281)
  and [07b](https://www.figma.com/design/fSnvj7wJlyAcAUGdWsGxFX/Travel-Planner?node-id=69-102).
  Keep Coastal Folio tokens, 44px touch targets,
  full-screen mobile forms, and sticky opaque form actions.
- Inside an activity, show estimated total, my share, expense items, and
  per-member Share/Paid/Remaining. Separate business payments from named
  reimbursements and keep currencies apart.
- Add expense, cost step: Expense name, the amount panel, then two detail rows
  (bordered, right chevron) that open the other steps: **Split** ("Evenly among 4
  people" or "Custom amounts · 4 people") and **Who's paying** ("Decide later" or
  the planned coverer). The amount panel holds the Group total / Per person toggle
  (Group total is the default) and a live footer: "₱800 each · 4 people", the
  total for per-person or custom splits, or the current problem. An activity's
  first expense pre-fills the activity name, selected so typing replaces it.
  The subtitle is the activity and the expense day ("Big Lagoon kayak tour ·
  Friday, November 13"). Split opens **Who is included?** (a bordered checkbox
  list, "All 4 members" as subtitle) with a **Split with custom amounts** link
  under the list. Custom splitting is a separate step: **Reset to even** under the
  subtitle, member amounts in a bordered list (underlined only while editing),
  then one sand status line ("₱3,200 of ₱3,200 assigned · Matches the total", or
  the amount left or over), plus a link that splits the remainder among rows not
  yet edited. Back returns to the expense and drops typed amounts; nothing
  changes until **Use this split**, including a per-person price. Every step's
  footer is Cancel (Back on later steps) then the primary action, right-aligned
  on desktop and sharing the width on mobile.
  Blank or unreadable amounts count as nothing in that total; unreadable ones show
  their error on the row. Applying requires every row, and amount fields accept
  well-formed thousands separators.
  Add expense and its steps are one 480px centered dialog on desktop (24px
  corners, close button, title over a muted subtitle, divider above the footer)
  and a bottom sheet on mobile, over a 60% black backdrop; the close button and
  Escape step back like Back. The currency
  picker sits inside the price field after a divider. Show blocked-step
  messages in the form's error area and move focus there. Required fields show a red
  asterisk; controls that open another step show a right chevron.
- An expense row opens its payments drawer: the expense name over "₱3,200 · 4
  people", a bordered Member/Share/Paid/Left table, then a "Paid to the
  business" card with the amount paid and what remains. For owners and editors,
  this whole card opens **Record reservation** while money remains payable to
  the business, including costs without a planned coverer and further payments
  after a deposit. Show a right chevron on the clickable card and no separate
  footer action. Members, viewers and settled or credit-review balances keep a
  read-only summary without the chevron. Tapping a
  member row (right chevron) opens that member's payment modal directly over
  the drawer. Below 640px, put each member's name above three labeled amounts
  (Share, Paid, Left), keeping currency amounts on one line. Wider screens keep
  the aligned table with a separate chevron column. Exceptionally large amounts
  scroll within their amount area instead of widening the drawer. The modal opens over
  the drawer, like Add expense; there is no separate member screen or member
  picker. The modal ("{Name}'s payment", "{Expense} · share ₱800") keeps one
  decision per row and as few words as possible:
  - The dark ocean card (the Add expense amount panel) leads. At rest it shows
    "Left to pay", the amount in large type, an aqua progress bar on
    ocean-raised, and "₱250 of ₱500 paid"; a fully paid share shows a check,
    "Paid in full" and the share.
  - Below it, one bordered row per payee with no heading: the expense name for
    the business, or the person with "Reservation" (or "Reservation · {name}
    confirms" when the viewer can't confirm it), then the amount and one
    action: **Mark paid** (editors, business) or **Received** (only the person
    repaid).
    When only the business remains to be paid and the current editor can record
    it, open that amount entry immediately. Keep the payee choice when any
    reimbursement is outstanding. Opening the form never records a payment;
    the user still confirms the amount and date.
  - The action turns the ocean card into the amount entry for that payee: "To
    {payee}", the full amount pre-filled and selected (editable, at most
    what's owed), and "Paid today · change". The row is highlighted with a
    filled button, other actions wait, and the footer becomes Cancel and
    "Confirm ₱250". No dropdown and no preview; after saving, the card shows
    the new progress and the payment appears under Paid.
  - **Paid**: one line per recorded payment ("₱250 to {payee} · Nov 22,
    2026"), newest first, with **Change** and **Undo** in a ⋯ menu. Change
    reuses the card's amount entry ("Change · to {payee}", Save change). Business
    payment corrections retain saved coverage and expose the existing manual
    coverage controls; amounts must match before saving. Choosing automatic
    coverage explicitly recalculates it own-share-first. Undo
    shows the payment struck through in the card ("Undo · to {payee}",
    "Balances update right away.") with a destructive Undo payment. Editors
    change or undo business payments; a reimbursement's recipient or an
    editor changes or undoes it, with a required reason under the card. A
    business payment with linked repayments stays locked ("Undo the
    repayments to {name} first to change this."). Viewers see the lines
    without the menu.
  - The footer is **Done** at rest. Closing the modal while a payment is
    open cancels that payment first.
    **Record reservation** (from the drawer footer) is a separate modal that
    previews own-share-first coverage from the API before confirming.
- Owners/editors plan per-person/group costs and equal/custom shares. On a new
  expense saved directly from an activity or Prep task, choosing who pays first
  and a reservation amount records that
  payment to the business when the expense is saved (dated the expense date,
  allocated own-share-first), so everyone else owes the payer at once; the
  coverer step says so ("Recorded as paid to the business when you save"). On
  an activity draft or existing expense, planned coverage stays a plan until **Record
  reservation**. Record other payments separately; preview own-share-first
  allocation or exact member-specific coverage.
- Only planners/editors confirm business payments. Only the recipient confirms a
  new reimbursement received. Recipients and editors may correct/reverse an existing
  receipt with a reason and visible history. Viewers cannot write. No approval queue.
- Add/edit expenses while the activity is still a draft; **Save activity** commits
  both in one transaction. Preserve drafts on errors,
  submission keys across retries, and focus when dialogs close. Review paid-cost
  balance changes before saving; retain payments and show resulting credits.
- The `/trips/{id}/expenses` page has two modes, switched by a full-pill Group /
  Personal control beside the Expenses heading (full width on mobile, where the
  heading is the mobile bar title). Group is the default. Mode and filter live in
  the URL (`?mode=personal&filter=...`), so details, Prep links, browser Back and
  reload keep the same list; changing mode resets the filter.
- Group lists every live expense, newest first, including single-person, unassigned
  and removed-activity costs and ones you have no share in. A pale sea panel shows
  Group total, Your share, You owe and You're owed per currency, independent of the
  filter. These cover expenses only: loans and unallocated receipts never reach
  them. Filter chips are All, Needs payment (anyone still owes the business or a
  person), You owe, Owed to you (including credits to review), and Settled (nothing
  remaining and no credit). Below 768px, Group and Personal filters use one
  full-width dropdown showing the selected filter, instead of wrapping chips.
  Desktop keeps the chips. Choices keep 44px touch targets and filter changes
  retain the URL state. Editors get a sand notice with how many expenses need
  payment and how many have no payer or planned coverer; Show selects Needs payment.
  Others see "Only editors can change group expenses."
- A Group row shows the date, category, title, activity or Prep context, payer,
  people, total, your share, your own status before the group's, and payment
  progress. Progress adds up settled share amounts; only fully settled people count
  in "2 of 4 paid", and "paid back" means the business is fully paid. Below 768px the
  category is a plain icon, the date leads the detail line, and the bar is dropped.
  The whole row opens details; editors also get a ⋯ menu (popover, or a sheet on
  phones) with Record a payment, Edit expense and Delete. Other roles see a chevron.
- Group details is the payments drawer (tall sheet on mobile) with the category,
  activity and date, Total and Your share, one line per balance of yours, the linked
  Prep task (opens `/trips/{id}/prep?task={taskID}`; a deleted task is plain text),
  Who's in with Mark paid or Paid, the business card, and Payments. The footer has
  Delete, Edit expense and Record a payment, which shows only while money is owed to
  the business: reimbursements stay recipient-confirmed. Read-only roles see who
  created it. Add group expense is the shared cost editor with a required activity.
- Personal shows private expenses, which only their creator can see, and money you
  lent. A sand panel shows Your personal spend and Lent, still to get back per
  currency; lending is never spending. Filters are All, Expenses and Lent. Desktop
  has Money I lent and Add expense; mobile has a floating Add pill that opens both
  choices as a sheet. Viewers manage private expenses but cannot lend, so their pill
  opens the expense form directly. The private form has a name, amount, optional
  activity and date, and says "Only you can see personal expenses." A private expense
  keeps its last activity title, marked "(removed)", once that link is gone. Loan
  details offer Record repayment and, before any repayment, Remove. Money lent
  always needs an activity.
- Balances and history, under either list, opens a drawer with money you borrowed,
  reimbursements owed to you, repayment history with receipt corrections and
  reversals, and unallocated or reversed receipts. Viewers read it only.
- Activity pickers on this page are one searchable list grouped by trip day.
- Private expenses and the shared ledger load separately: either half of Personal
  stays usable when the other fails, and neither blocks Group. A conflict in the
  private form offers Reload latest expense and keeps what was typed.
- Closing a dialog returns focus to the row, to the button inside the drawer that
  opened it, or to the selected filter. After a deletion it goes to the next row. A
  row menu's items are gone once it closes, so its dialogs return to the row.
  Very large amounts take their own line rather than break mid-number.
- Recording money received asks to Confirm money received, shows the sender and
  balance once, and defaults to full repayment in an always-visible editable amount
  field above the remaining balance. Invalid or excessive amounts show an inline
  error and disable confirmation. Record today in the trip timezone without a date
  control. Viewers, other rows, and credit-review entries remain read-only. Prefer
  display names and wrap fallback emails.
- Inside an activity, My Expenses summarizes own expense shares and shows outstanding
  business balances, reimbursements and loans. Fully paid expense rows remain in
  All expenses. Paid means the settled
  part of the signed-in person's expense shares, not their cash outlay or loans.
  Keep currencies separate and credits explicitly labeled for review.
  My Expenses opens with Your share, Paid and To pay in a pale sea card. You owe
  and Owed to you are headings over separate bordered cards: the person first,
  the reimbursement or loan description below, and the amount aligned
  right. Mark as paid is a compact text action under the amount with a 44px
  minimum touch target. Business balances show the expense and "Pay to business"
  and open its payments on selection.
- All expenses: estimated total and your share in a pale sea panel, labels above
  amounts. Below it, the expense count and a + Add expense text link in one row,
  then one bordered list (16px corners, row dividers). Each expense is one
  main row button opening its payments: name over "From
  Prep · 4 people · Total ₱3,200" on the left, the per-person amount (or the
  total for uneven splits) over concise payment status on the right. Restore
  focus to the row after returning from payments. Use underlined All expenses
  and My expenses tabs with keyboard arrow navigation on mobile and desktop.
  Owners and editors also get an adjacent 44px ellipsis button that toggles the
  same Edit and Delete reveal as swiping, without an intermediate menu. Prep
  task expense rows use the same actions and existing editor/confirmation.
  On mobile, hide the ellipsis and reclaim its space; reveal it only on keyboard
  or assistive focus so deletion remains available without a swipe.
  Dragging the row left reveals adjacent 72px Edit and Delete actions with 12px
  labels and no border gaps, without compressing its
  content; passing halfway snaps it open. A full swipe never deletes. Keep one
  row open, close on a right swipe, outside tap or Escape, and preserve vertical
  scrolling and reduced motion. Edit opens the expense editor and returns focus
  to the row when closed. The revealed Delete button opens the
  confirmation with the expense name, total, people and payment status. Focus
  Cancel first; disable actions and dismissal while deleting, retain errors for
  retry, and remove the row and refresh totals after success. Return focus to the next
  row's main button or the expense heading, keeping hidden mobile actions hidden.
  Recorded payments do not block
  expense deletion. For a paid expense, confirmation explains that its payments
  and linked reimbursements will also leave active balances. The API soft-deletes
  the related records atomically and retains receipt history. Preserve server
  permissions and version checks.
  Borrow list is always the last row of that list, with a loan count and the
  amount lent per currency. It opens only loans made by the signed-in person for
  that activity, one row per loan, including paid loans, in a bordered list under
  the loan count and a + Add borrow text link (opens Record money lent). Each
  loan shows borrower over description on the left and the original amount over
  status on the right ("Unpaid", "Partially paid · ₱X left", "Paid" or "Credit
  for review"). Record repayment is an outline button under the list (one per
  repayable loan, naming the borrower when there are several), supporting
  partial and full amounts. Record money lent asks who borrowed, what it is
  for, the amount ("Loans never add to activity spending") and Date lent, with
  Cancel then Record money lent. Undo repayment and Remove loan sit in the
  row's compact options popover, with 44px minimum targets. Loan rows are not
  clickable.
  Loans never increase activity spending, expense shares, or personal Paid totals.
- Use contextual Back actions: payment screens return to their originating expense
  or personal view; Borrow list returns to All expenses; both expense views
  return to the overview's Expenses row. Restore focus and reader position on
  return. Reopening or changing activity resets to the overview. Hide Notes, To do,
  and activity editing controls in financial steps. Preserve the selected day.
- Members, owners and editors record money they personally lent to one other active
  participant. Only the recipient marks full/partial repayments as paid. Put loan
  removal in the Borrow list options popover and existing non-sidebar history views.
  Removing a loan requires explicit confirmation that balances will change; cancel
  preserves the record. Disable removal while repayments exist and explain that
  repayments must be undone first. Receipt corrections remain in existing history views. Activity
  All expenses and Borrow list temporarily hide history and corrections sections.
  Undo repayment reverses only the latest
  active repayment receipt, requiring the existing reason and confirmation;
  earlier receipts remain stored and accessible in other existing history views. Reverse repayment receipts
  before removing a loan. Viewers remain read-only.
- Preserve unassigned costs, removed activity names, former members, old loans and
  unallocated historical receipts. Covered-food entry is deferred.

Activity creation starts with Activity name, category chips and the When fields.
Existing activities edit one section at a time using
pencil buttons in the detail drawer. Expense rows show per-person price
and member/total metadata; equal reservation coverage uses one member list and
“Each owes …” line. Payment dates and amounts use formatted reading values,
with native input editing on focus.

### Money-entry forms

- Use the shared expense amount panel for prices, payments, reservations, loans,
  repayments, and corrections: ocean background, persistent label, currency in
  the upper corner, and a large centered amount above an underline. Keep currency
  selection where it is currently editable; fixed currencies use a quiet badge.
- Preserve every existing field and step. Supporting names, people, dates, split
  choices, and correction reasons stay in a vertical flow. Show coverage and
  balance information as quiet supporting text, with one full-width primary action.
- Custom shares and manual payment coverage use compact right-aligned underlined
  amounts beside each person, with currency shown once for the group. Keep labels,
  per-person errors, balancing actions, and keyboard selection behavior.
- Formatted reading amounts and editable inputs share typography and alignment.
  Large values must remain readable without expanding the page; preserve decimal
  keyboards, validation, visible focus on ocean surfaces, and failed drafts.
- Amount inputs use a stronger underline for keyboard focus instead of a focus
  box. Empty zero placeholders fade out on focus and return on blur; actual
  entered amounts remain visible. Reduced motion removes the placeholder fade.
