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
- Open trips into the existing itinerary, directly below the shared trip summary,
  with no day-rail label. A pill Itinerary | Expenses | Prep switch sits under the
  summary on mobile and desktop; Expenses opens the read-only trip expenses page at
  `?view=expenses`, and Prep opens the group's task list at `?view=prep`. Expense
  management stays inside each activity. People and Settings remain secondary and
  available in every view.
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
- Trip creation asks for destination, dates, then a name. Exact times remain
  optional in a secondary section. If a destination
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
- Activity details use a modal 680px right drawer from 768px and a full-screen
  mobile view. Keep the itinerary behind the drawer, with the selected card
  outlined. Back to itinerary stays at the top; permitted pencil buttons sit
  beside the activity heading, Place, Notes, and To do. The title,
  category, schedule and optional place, notes and plain to-do sections share one
  scrolling reader. Creator and permitted Delete stay visible in a bottom footer,
  outside the scrolling content. Follow the supplied November 2 flow:
  both desktop and mobile stack a short Expenses summary, Notes, and To do.
  The summary shows expense total and your share, with one View expenses action.
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
- Add activity is headed by its fixed day (Add activity stays the dialog's
  accessible name) and starts with Activity name, outlined category chips that fill the
  row, with only the selected chip taking its card badge color (default Activity), and
  the fields for When. An Add more row of soft pills offers
  Place, Notes, To do and Expense. Tapping one opens that section as in activity
  details, and its pill goes; the Expenses card stays last. Cancel then Save activity
  sit in a pinned footer. Required fields show a red asterisk; there is no explanatory
  subtitle. When is never collapsible: one line under Start time gives the end time and trip zone,
  and Start time and Duration share a row where they fit.
  The title pencil's form uses the same chips and fields, with a date input.
  Existing activities use section pencils.
  Notes holds the activity description and other free-form reminders.
- To-dos are simple text items: add, rename, or remove them in the existing
  activity form, then Save. Do not show checkboxes, completion counts, status
  labels, or strikethroughs. Preserve historical completion values in storage.
  This applies to activity to-dos only; Prep tasks are a separate trip-level list.
  Existing Sleeping activities retain their label and edit as a custom category.
- Prep splits tasks into To do and Done. An everyone task shows your checkbox, "3 of
  5 ready", and "Still to do" names. A one-person task shows Claim while open, a
  checkbox and Drop when it's yours, a name when it's someone else's, and "Done by"
  when finished. People only tick their own tasks; editors reopen others' finished
  tasks with Reopen. Owners and editors manage tasks from each row's options and add
  them with Add task, which is the same right-aligned mobile pill as Add activity.
  A task's optional activity and date show under its title. Both are set in the
  add/edit form, where the date is a list of the trip's days and the activity
  picker's own loading or failure never blocks saving. Viewers get read-only rows and a one-line note. A task that changed underneath
  someone shows a notice above the list, refreshes it, and keeps the page in place.
- The People dialog shows the owner's invite form, then one row per person, then
  pending invitations only, omitting that section when there are none. Explain role
  capabilities inside the role dropdown rather than on every row. Transfer ownership
  and Remove sit behind each row's More options button. Invitations appear in the
  recipient's account; do not imply email delivery.

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

## Expenses

- Follow revised Figma sections [07](https://www.figma.com/design/fSnvj7wJlyAcAUGdWsGxFX/Travel-Planner?node-id=68-281)
  and [07b](https://www.figma.com/design/fSnvj7wJlyAcAUGdWsGxFX/Travel-Planner?node-id=69-102).
  Keep Coastal Folio tokens, 44px touch targets,
  full-screen mobile forms, and sticky opaque form actions.
- Expenses is an activity list; management lives inside activity details. Show
  estimated total, my share, expense items, and per-member Share/Paid/Remaining.
  Separate business payments from named reimbursements and keep currencies apart.
- Expense setup follows the reference field order: expense name, per-person/group
  basis, price beside split where they fit, share preview, optional planned coverer.
  Included members are an initials stack (up to three, then +N) at the right of the
  Back row; it opens the members step. Custom splitting opens a separate step with
  member amounts and **Use this split**; **Change custom split** sits at the right
  of the preview's share line. On that step, Back returns to the expense and asks
  before dropping typed amounts; nothing changes until **Use this split**, including
  a per-person price. **Reset to even** sits beside the title. The footer pins the
  running total above the action, stating the amount left or over on a sand surface
  until it matches, plus a link that splits the remainder among rows not yet edited.
  Blank or unreadable amounts count as nothing in that total; unreadable ones show
  their error on the row. Applying requires every row, and amount fields accept
  well-formed thousands separators.
  Keep expense forms in the right drawer on desktop and full-screen on mobile,
  with a 60% black backdrop, labels and sticky actions. Expense drawers match the
  activity drawer's 680px width so no clipped form shows behind them. The currency
  picker sits inside the price field after a divider. Show blocked-step
  messages in the form's error area and move focus there. Required fields show a red
  asterisk; controls that open another step show a right chevron.
- **View payments** opens a separate cost payment screen with Share/Paid/Left
  columns, business total paid/remaining, and named reimbursements. **Update a
  payment** selects a member. **Record reservation** previews own-share-first
  coverage from the API before confirming. A member detail shows business
  payments separately from reimbursements and their receiver-only confirmation.
- Owners/editors plan per-person/group costs and equal/custom shares. Optional
  planned coverage is explicitly not a payment. Record actual payments separately;
  preview own-share-first allocation or exact member-specific coverage.
- Only planners/editors confirm business payments. Only the recipient confirms a
  new reimbursement received. Recipients and editors may correct/reverse an existing
  receipt with a reason and visible history. Viewers cannot write. No approval queue.
- Add/edit expenses while the activity is still a draft; **Save activity** commits
  both in one transaction. Preserve drafts on errors,
  submission keys across retries, and focus when dialogs close. Review paid-cost
  balance changes before saving; retain payments and show resulting credits.
- The `?view=expenses` page is a read-only Splitwise-style overview: a pale sea
  balance panel per currency that leads with Overall expenses in large type, the
  trip's total spending. Under it, Balance (red) is what you still have to pay,
  including money you borrowed, and To receive (teal) is what you should get back,
  whether lent or owed to you.
  Below it, one flat Expenses list from the signed-in person's view, newest
  first: each own expense share with what is still owed on it, money lent or
  borrowed with the amount left, people who owe a reimbursement, and settlements
  paid or received. A pill segmented control (All, Upcoming, You owe, Owed to
  you, Settled) filters the list. Upcoming means the record date is after today
  in the trip zone. Per-person rows and category totals were dropped; People
  stays in the header dialog.
  Rows are read-only and do not link anywhere for now; Mark as paid, View
  payments and Add expense live inside each activity.
  Inside an activity, My Expenses shows every own expense share, including fully paid items, plus
  money owed and receivable from reimbursements and loans. Paid means the settled
  part of the signed-in person's expense shares, not their cash outlay or loans.
  Keep currencies separate and credits explicitly labeled for review.
  Personal balance rows put the person first, then the expense, with the amount
  aligned right. Show each currency total once beside You owe or Owed to you.
  Mark as paid is a compact text action with a 44px minimum touch target.
- All expenses shows expense rows with View payments and permitted Add expense.
  Use underlined All expenses and My expenses tabs with keyboard arrow navigation
  on mobile and desktop. Show estimated total and your share in a pale sea panel,
  labels above amounts. Below it, align the expense count and + Add expense action
  in one row, with a divider before expense rows. Keep the financial header compact.
  Borrow list is always the last entry, with a loan count and original amount lent
  per currency. It opens only loans made by the signed-in person for that activity,
  one row per loan, including paid loans. Show borrower, description, original and
  outstanding amounts, status, and permitted Mark as paid/Undo actions.
  Add borrow sits after the list and opens Record money lent.
  Loans never increase activity spending, expense shares, or personal Paid totals.
- Use contextual Back actions: payment screens return to their originating expense
  or personal view; Borrow list returns to All expenses; both expense views
  return to the overview's View expenses action. Restore focus and reader position on
  return. Reopening or changing activity resets to the overview. Hide Notes, To do,
  and activity editing controls in financial steps. Preserve the selected day.
- Members, owners and editors record money they personally lent to one other active
  participant. Only the recipient marks full/partial repayments as paid. Put loan
  removal and receipt corrections under History and corrections in detailed expenses,
  with loan-specific history also in Borrow list. Undo reverses only the latest
  active repayment receipt, requiring the existing reason and confirmation;
  earlier receipts stay accessible through history. Reverse repayment receipts
  before removing a loan. Viewers remain read-only.
- Preserve unassigned costs, removed activity names, former members, old loans and
  unallocated historical receipts. Covered-food entry is deferred.

Activity creation starts with Activity name, category chips and the When fields.
Existing activities edit one section at a time using
pencil buttons in the detail drawer. Expense rows show per-person price
and member/total metadata; equal reservation coverage uses one member list and
“Each owes …” line. Payment dates and amounts use formatted reading values,
with native input editing on focus.
