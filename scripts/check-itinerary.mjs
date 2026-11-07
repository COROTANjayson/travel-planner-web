// Run with: node scripts/check-itinerary.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLoader, isAutoLoaded } from "./lib/load.mjs";
const require = createRequire(import.meta.url);
let confirmDiscard = false;
let activityRequestNumber = 0;
const successToasts = [];
const sonnerMock = {
  toast: { success: (message) => successToasts.push(message) },
};
const load = createLoader({
  mocks: { sonner: sonnerMock },
  globals: {
    Date,
    crypto: {
      randomUUID: () => `activity-test-key-${++activityRequestNumber}`,
    },
    Intl,
    Error,
    TextEncoder,
    HTMLElement: Object,
    requestAnimationFrame: (callback) => callback(),
    window: { confirm: () => confirmDiscard },
  },
});
const time = load("src/lib/activity-time.ts");
assert.equal(
  time.formatActivityDuration("2026-10-24T02:00:00Z", "2026-10-24T03:30:00Z"),
  "1 hr 30 min",
);
assert.equal(
  time.formatActivityDuration("2026-10-24T02:00:00Z", "2026-10-24T02:45:00Z"),
  "45 min",
);
assert.equal(
  time.formatActivityDuration("2026-10-24T01:00:00Z", "2026-10-24T05:00:00Z"),
  "4 hr",
);
assert.equal(
  time.formatActivityDuration("2026-10-24T01:00:00Z", "2026-10-24T01:00:00Z"),
  "0 min",
);
assert.equal(
  time.formatActivityDuration("2026-03-08T06:30:00Z", "2026-03-08T07:30:00Z"),
  "1 hr",
  "Duration measures elapsed time across DST",
);
const sameDayRange = time.formatActivityRange(
  "2026-11-10T00:30:00Z",
  "2026-11-10T03:30:00Z",
  "Asia/Tokyo",
);
assert.match(sameDayRange, /9:30/);
assert.match(sameDayRange, /12:30/);
assert.equal(
  (sameDayRange.match(/2026/g) ?? []).length,
  1,
  "Same-day activity details show the date once",
);
const overnightRange = time.formatActivityRange(
  "2026-11-10T14:30:00Z",
  "2026-11-10T16:30:00Z",
  "Asia/Tokyo",
);
assert.match(overnightRange, /Nov 10/);
assert.match(
  overnightRange,
  /Nov 11/,
  "Overnight details retain both dates in the trip zone",
);
const precise = "2026-10-01T01:23:45.123456Z";
const local = time.instantToLocal(precise, "Asia/Manila");
assert.equal(local.value, "2026-10-01T09:23:45.123456");
assert.equal(time.dateTimeInputValue(local.value), "2026-10-01T09:23:45.123");
assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
assert.equal(
  time.localToInstant("2026-10-01T09:00", "Asia/Manila"),
  "2026-10-01T01:00:00Z",
);
assert.equal(
  time.localToInstant("2026-10-01T23:30", "America/Los_Angeles"),
  "2026-10-02T06:30:00Z",
);
assert.throws(() => time.localToInstant("", "UTC"), /required/);
assert.throws(
  () => time.localToInstant("2026-03-08T02:30", "America/New_York"),
  /does not exist/,
);
assert.throws(
  () => time.localToInstant("2026-11-01T01:30", "America/New_York"),
  /occurs twice/,
);
assert.throws(() => time.localToInstant("invalid", "Asia/Manila"), /valid/);
assert.throws(
  () => time.localToInstant("2026-10-01T09:00", "Unknown/Zone"),
  /valid/,
);
assert.equal(
  time.localToInstant("2026-03-08T01:30", "America/New_York"),
  "2026-03-08T06:30:00Z",
);
assert.equal(
  time.localToInstant("2026-03-08T03:30", "America/New_York"),
  "2026-03-08T07:30:00Z",
);
assert.equal(
  time.localToInstant("2026-11-01T01:30", "America/New_York", "earlier"),
  "2026-11-01T05:30:00Z",
);
assert.equal(
  time.localToInstant("2026-11-01T01:30", "America/New_York", "later"),
  "2026-11-01T06:30:00Z",
);
assert.equal(
  time.endAfterMinutes("2026-03-08T06:30:00Z", 60),
  "2026-03-08T07:30:00Z",
  "A one-hour duration crosses the spring DST jump as elapsed time",
);
assert.equal(
  time.endAfterMinutes("2026-11-01T05:30:00Z", 60),
  "2026-11-01T06:30:00Z",
  "A one-hour duration crosses the repeated hour as elapsed time",
);
for (const occurrence of ["earlier", "later"]) {
  const instant = time.localToInstant(
    "2026-11-01T01:30:00.123456",
    "America/New_York",
    occurrence,
  );
  const edited = time.instantToLocal(instant, "America/New_York");
  assert.equal(edited.occurrence, occurrence);
  assert.equal(
    time.localToInstant(edited.value, "America/New_York", edited.occurrence),
    instant,
  );
}
const converted = time.instantToLocal(precise, "America/New_York");
assert.equal(
  time.localToInstant(
    converted.value,
    "America/New_York",
    converted.occurrence,
  ),
  precise,
);
const priorTZ = process.env.TZ;
try {
  for (const deviceZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    process.env.TZ = deviceZone;
    assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
    assert.equal(
      time.instantToLocal(precise, "Asia/Manila").value,
      local.value,
    );
    assert.match(time.formatActivityTime(precise, "Asia/Manila"), /9:23|09:23/);
  }
} finally {
  if (priorTZ === undefined) delete process.env.TZ;
  else process.env.TZ = priorTZ;
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
let calls = [],
  response,
  failure;
const client = Object.fromEntries(
  ["invalidateQueries", "cancelQueries", "removeQueries", "setQueryData"].map(
    (method) => [method, async (...args) => calls.push([method, ...args])],
  ),
);
const apiMock = {
  ApiError,
  useApi: () => async (path, init) => {
    calls.push([path, init]);
    if (failure) throw failure;
    return typeof response === "function" ? response(path, init) : response;
  },
};
const trips = load("src/lib/trips.ts", { "@/lib/api": apiMock });
assert.equal(trips.tripDayCount("2026-10-08", "2026-10-08"), 1);
assert.equal(
  trips.tripDayCount("2026-03-07", "2026-03-09"),
  3,
  "Trip length counts inclusive calendar dates across DST",
);
assert.equal(
  trips.tripDayCount("2028-02-28", "2028-03-01"),
  3,
  "Trip length includes leap day",
);
const range = (start, end) =>
  trips
    .formatTripDates(start, end, "en-GB")
    .replace(/\s+/g, " ")
    .replace(/\s*–\s*/g, "–");
assert.equal(range("2026-10-08", "2026-10-10"), "8–10 Oct 2026");
assert.equal(range("2026-10-08", "2026-10-08"), "8 Oct 2026");
assert.match(range("2026-10-30", "2026-11-02"), /30 Oct.*2 Nov 2026/);
assert.match(range("2026-12-31", "2027-01-02"), /31 Dec 2026.*2 Jan 2027/);
assert.match(
  trips.formatTripDates("2026-10-08", "2026-10-10", "en-US"),
  /Oct.*8.*10.*2026/,
);
let tripQuery = { data: [] };
let tripOffset = 0,
  tripFilter = "All",
  tripSearch = "";
let tripSearchFocus = 0;
const tripPage = load("src/app/trips/page.tsx", {
  react: {
    ...React,
    useRef: () => ({ current: { focus: () => tripSearchFocus++ } }),
    useState: (initial) =>
      typeof initial === "number"
        ? [
            tripOffset,
            (value) => {
              tripOffset =
                typeof value === "function" ? value(tripOffset) : value;
            },
          ]
        : initial === "All"
          ? [
              tripFilter,
              (value) => {
                tripFilter = value;
              },
            ]
          : [
              tripSearch,
              (value) => {
                tripSearch = value;
              },
            ],
  },
  "next/link": {
    default: ({ children, ...props }) =>
      React.createElement("a", props, children),
  },
  "@tanstack/react-query": { useQuery: () => tripQuery },
  "@/lib/trips": trips,
  "@/components/ui/input": {
    Input: (props) => React.createElement("input", props),
  },
  "@/components/ui/button": {
    Button: ({ children, render, ...props }) => {
      delete props.nativeButton;
      delete props.variant;
      return render
        ? React.cloneElement(render, props, children)
        : React.createElement("button", props, children);
    },
  },
  "@/components/ui/card": Object.fromEntries(
    ["Card", "CardContent", "CardDescription", "CardHeader", "CardTitle"].map(
      (key) => [
        key,
        ({ children }) => React.createElement("div", null, children),
      ],
    ),
  ),
  "@/components/trips/trip-states": { TripError() {}, TripLoading() {} },
});
const today = require("@js-temporal/polyfill").Temporal.Now.plainDateISO("UTC");
const tripFor = (id, start, end) => ({
  id,
  start_date: start.toString(),
  end_date: end.toString(),
  time_zone: "UTC",
});
assert.equal(
  trips
    .orderTrips([
      tripFor(1, today.subtract({ days: 4 }), today.subtract({ days: 2 })),
      tripFor(2, today.add({ days: 2 }), today.add({ days: 4 })),
      tripFor(3, today.subtract({ days: 1 }), today.add({ days: 1 })),
    ])
    .map((trip) => trip.id)
    .join(","),
  "3,2,1",
  "Ongoing and upcoming trips precede past trips",
);
const tripListHtml = () => renderToStaticMarkup(tripPage.default());
assert.match(tripListHtml(), /No trips yet/);
assert.doesNotMatch(
  tripListHtml(),
  /aria-label="Trip pages"/,
  "Empty lists have no pagination controls",
);
tripQuery = {
  data: [
    { ...tripFor(1, today, today), name: "Cebu", destination: "Cebu City" },
  ],
};
assert.match(tripListHtml(), /View trip/);
const tripCardHtml = tripListHtml().match(
  /<a[^>]*href="\/trips\/1"[\s\S]*?<\/a>/,
)[0];
assert.match(tripCardHtml, /aria-labelledby="trip-1-name"/);
assert.match(
  tripCardHtml,
  /<h2[^>]*id="trip-1-name"[^>]*>Cebu<\/h2>/,
  "The whole-card link is named by its trip heading",
);
assert.match(tripCardHtml, /Cebu City/);
assert.doesNotMatch(
  tripCardHtml,
  /<button|Open itinerary|<a\b[\s\S]*<a\b/,
  "The card has one navigation target without nested controls",
);
assert.doesNotMatch(
  tripListHtml(),
  /lg:grid-cols-3/,
  "Sparse lists use wider cards on desktop",
);
tripQuery = {
  data: Array.from({ length: trips.tripPageSize }, (_, index) => ({
    ...tripFor(index + 1, today, today),
    name: `Trip ${index + 1}`,
    destination: "Cebu",
  })),
};
assert.doesNotMatch(
  tripListHtml(),
  /aria-label="Trip pages"/,
  "One page needs no pagination",
);
assert.match(
  tripListHtml(),
  /href="\/trips\/1"/,
  "Trip cards open their actual itinerary",
);
assert.match(tripListHtml(), /Time zone:.*UTC/);
tripQuery.isSuccess = true;
assert.match(tripListHtml(), /All<span class="filter-count">10<\/span>/);
assert.match(tripListHtml(), /Ongoing<span class="filter-count">10<\/span>/);
assert.match(
  tripListHtml(),
  /Upcoming<span class="filter-count">0<\/span>/,
  "Filter counts describe all loaded trips, including empty groups",
);
tripQuery.data.push({
  ...tripFor(99, today, today),
  name: "Extra trip",
  destination: "Cebu",
});
assert.match(
  tripListHtml(),
  /aria-label="Trip pages"/,
  "Multiple pages retain navigation",
);
tripOffset = trips.tripPageSize;
const filterNav = tripPage
  .default()
  .props.children.find(
    (child) => child?.props?.["aria-label"] === "Filter trips",
  );
filterNav.props.children
  .find((button) => button.key === "Upcoming")
  .props.onClick();
assert.equal(tripOffset, 0, "Changing status returns to the first page");
assert.match(tripListHtml(), /aria-pressed="true"[^>]*>Upcoming/);
assert.match(tripListHtml(), /No upcoming trips/);
assert.match(
  tripListHtml(),
  /0 upcoming trips/,
  "Filter results are announced to screen readers",
);
assert.doesNotMatch(
  tripListHtml(),
  /View trip/,
  "Empty filters do not show unrelated trips",
);
assert.match(
  tripListHtml(),
  /Ongoing<span class="filter-count">11<\/span>/,
  "Counts still include trips outside the selected filter",
);
const emptyCard = tripPage
  .default()
  .props.children.find((child) => child?.props?.className === "trips-empty");
emptyCard.props.children.props.children.at(-1).props.onClick();
assert.equal(tripFilter, "All", "The empty-state action restores all trips");
assert.equal(
  tripSearchFocus,
  1,
  "Reset returns keyboard focus to the search field",
);
assert.match(tripListHtml(), /View trip/);
const searchInput = () =>
  nodes(tripPage.default()).find(
    (node) => node.props?.["aria-label"] === "Find a trip or destination",
  );
tripOffset = trips.tripPageSize;
searchInput().props.onChange({ target: { value: "  eXtRa  " } });
assert.equal(tripOffset, 0, "Changing search returns to page one");
assert.match(tripListHtml(), /Extra trip/);
assert.doesNotMatch(tripListHtml(), /Trip 1<\/h2>/);
assert.match(tripListHtml(), /1 trip/);
assert.match(
  tripListHtml(),
  /Ongoing<span class="filter-count">11<\/span>/,
  "Counts remain global while searching",
);
tripSearch = "kyoto";
assert.match(tripListHtml(), /No trips found/);
tripSearch = "cebu";
assert.match(tripListHtml(), /Trip 1/, "Search includes destinations");
tripFilter = "Upcoming";
assert.match(tripListHtml(), /No trips found/, "Search and status combine");
tripFilter = "All";
tripSearch = "";
assert.equal(
  (tripListHtml().match(/data-featured="true"/g) || []).length,
  1,
  "Only the first ongoing trip is featured",
);
tripOffset = trips.tripPageSize;
assert.doesNotMatch(
  tripListHtml(),
  /data-featured="true"/,
  "Later pages do not duplicate the featured trip",
);
tripOffset = 0;
const beforeNoOngoing = tripQuery.data;
tripQuery.data = [
  {
    ...tripFor(3, today.add({ days: 2 }), today.add({ days: 5 })),
    name: "Kyoto",
    destination: "Kyoto, Japan",
  },
];
assert.doesNotMatch(
  tripListHtml(),
  /data-featured="true"/,
  "Upcoming-only lists do not invent an ongoing feature",
);
tripQuery.data = beforeNoOngoing;
console.log(
  "Trips search/status combinations, global counts, pagination reset and featured selection passed.",
);
const tripDraft = {
  name: " Manila ",
  destination_place_id: 7,
  starts_at: "2026-10-01T01:00:00Z",
  ends_at: "2026-10-01T01:00:00.001Z",
};
assert.equal(trips.tripInput(tripDraft).name, "Manila");
assert.equal(
  trips.validateTrip(tripDraft),
  undefined,
  "Subsecond end time must compare as an instant",
);
assert.match(
  trips.validateTrip({
    ...tripDraft,
    starts_at: tripDraft.ends_at,
    ends_at: tripDraft.starts_at,
  }),
  /after/,
);
const datesOnly = {
  name: "Dates only",
  destination_place_id: 7,
  start_date: "2026-10-01",
  end_date: "2026-10-01",
  starts_at: null,
  ends_at: null,
};
assert.equal(trips.validateTrip(datesOnly), undefined);
assert.equal(trips.tripInput(datesOnly).starts_at, null);
assert.match(
  trips.validateTrip({ ...datesOnly, end_date: "2026-09-30" }),
  /after/,
);
assert.match(
  trips.validateTrip({ ...datesOnly, start_date: "2026-02-30" }),
  /valid/,
);
assert.match(
  trips.validateTrip({ ...datesOnly, starts_at: tripDraft.starts_at }),
  /both/,
);
const tripsApi = trips.useTripsApi();
for (const operation of [
  () => tripsApi.create(datesOnly),
  () => tripsApi.update(7, datesOnly),
]) {
  response = { id: 7 };
  await operation();
}
assert.deepEqual(successToasts.splice(0), ["Trip created.", "Trip updated."]);
failure = new ApiError(500, "Trip save failed");
await assert.rejects(tripsApi.create(datesOnly));
await assert.rejects(tripsApi.update(7, datesOnly));
assert.equal(
  successToasts.length,
  0,
  "Failed trip saves do not announce success",
);
failure = undefined;
calls = [];
const itinerary = load("src/lib/itinerary.ts", {
  "./expenses": { expenseInput: (input) => input },
  react: {
    useCallback: (callback) => callback,
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
  },
  "@/lib/api": apiMock,
  "@tanstack/react-query": { useQueryClient: () => client },
});
const activity = {
  id: 1,
  trip_id: 7,
  created_by_user_id: 11,
  title: "  Breakfast  ",
  starts_at: "2026-10-01T01:00:00Z",
  ends_at: "2026-10-01T02:00:00Z",
  time_zone: "Asia/Manila",
  notes: "Notes",
  place_id: null,
  place: null,
  category: "Eating",
  checklist: [
    { text: "Reserve table", done: true },
    { text: "Order breakfast", done: false },
  ],
  created_at: precise,
  updated_at: precise,
};
assert.deepEqual(Object.keys(itinerary.activityInput(activity)).sort(), [
  "category",
  "checklist",
  "ends_at",
  "notes",
  "place_id",
  "starts_at",
  "time_zone",
  "title",
]);
assert.equal(
  itinerary.activityInput({ ...activity, category: " Shopping " }).category,
  "Shopping",
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      itinerary.activityInput({
        ...activity,
        checklist: [{ text: " Buy tickets ", done: true, key: 123 }],
      }).checklist,
    ),
  ),
  [{ text: "Buy tickets", done: true }],
);
const denied = [];
const api = itinerary.useItineraryApi(7, (error) => denied.push(error.status));
const signal = new AbortController().signal;
response = [activity];
await api.list(10, signal);
assert.equal(calls[0][0], "/api/v1/trips/7/activities?limit=10&offset=10");
assert.equal(calls[0][1].signal, signal);
calls = [];
response = (path) =>
  path.includes("offset=0")
    ? Array.from({ length: 100 }, () => activity)
    : [activity];
assert.equal(
  (await api.listRange("2026-10-01T00:00:00Z", "2026-10-04T00:00:00Z", signal))
    .length,
  101,
);
assert.equal(
  calls.length,
  2,
  "The board must load every page in its date window",
);
assert.match(calls[0][0], /start_from=2026-10-01T00%3A00%3A00Z/);
assert.match(calls[1][0], /offset=100/);
assert.equal(calls[1][1].signal, signal);
calls = [];
const conflictPage = Array.from({ length: 10 }, (_, index) => ({
  activity_ids: [index + 1, index + 2],
  overlap_starts_at: activity.starts_at,
  overlap_ends_at: activity.ends_at,
}));
const lastConflict = { ...conflictPage[0], activity_ids: [11, 12] };
response = (path) =>
  path.includes("offset=0") ? conflictPage : [lastConflict];
assert.deepEqual(
  Array.from(await api.conflicts(signal)),
  [...conflictPage, lastConflict],
  "Conflicts must include every page in order",
);
assert.deepEqual(
  calls.map(([path]) => path),
  [
    "/api/v1/trips/7/activities/conflicts?limit=10&offset=0",
    "/api/v1/trips/7/activities/conflicts?limit=10&offset=10",
  ],
);
assert.ok(
  calls.every(([, init]) => init.signal === signal),
  "Every conflict request keeps the query's cancellation signal",
);
for (const { firstPage, requestCount } of [
  { firstPage: [], requestCount: 1 },
  { firstPage: conflictPage, requestCount: 2 },
]) {
  calls = [];
  response = (path) => (path.includes("offset=0") ? firstPage : []);
  assert.deepEqual(Array.from(await api.conflicts(signal)), firstPage);
  assert.equal(
    calls.length,
    requestCount,
    "An empty page ends conflict loading, including after a full page",
  );
}
calls = [];
const conflictFailure = new ApiError(503, "Conflicts unavailable");
response = (path) => {
  if (path.includes("offset=0")) return conflictPage;
  throw conflictFailure;
};
await assert.rejects(
  api.conflicts(signal),
  (error) => error === conflictFailure,
  "A later page failure must reject rather than return partial conflicts",
);
assert.equal(calls.length, 2);
response = (path) => (path.includes("offset=0") ? conflictPage : undefined);
await assert.rejects(
  api.conflicts(signal),
  (error) => error.status === 500,
  "Missing page data must not look like a complete result",
);
calls = [];
const conflictController = new AbortController();
response = (path, init) => {
  init.signal.throwIfAborted();
  if (path.includes("offset=0")) conflictController.abort();
  return conflictPage;
};
await assert.rejects(api.conflicts(conflictController.signal), {
  name: "AbortError",
});
assert.equal(
  calls.length,
  2,
  "Cancellation stops loading without returning partial conflicts",
);
assert.ok(calls.every(([, init]) => init.signal === conflictController.signal));
calls = [];
response = activity;
await api.get(1);
assert.equal(calls[0][0], "/api/v1/trips/7/activities/1");
for (const id of [undefined, 1]) {
  calls = [];
  const saved = await api.save(activity, id);
  assert.equal(saved.id, 1);
  assert.deepEqual(
    successToasts.splice(0),
    [id === undefined ? "Activity created." : "Activity updated."],
    "Each completed activity save emits one success toast",
  );
  assert.equal(calls[0][1].method, id === undefined ? "POST" : "PUT");
  const payload = JSON.parse(calls[0][1].body);
  assert.equal(payload.title, "Breakfast");
  assert.equal(payload.category, "Eating");
  assert.deepEqual(payload.checklist, activity.checklist);
  assert.equal(payload.created_by_user_id, undefined);
  assert.equal(payload.id, undefined);
  assert.equal(calls[0][1].headers["Content-Type"], "application/json");
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "setQueryData" &&
        JSON.stringify(call[1]) === '["trip",7,"activity",1]',
    ),
  );
  assert.deepEqual(
    calls
      .filter((call) => call[0] === "invalidateQueries")
      .map((call) => JSON.stringify(call[1].queryKey))
      .sort(),
    ['["trip",7,"activities"]', '["trip",7,"conflicts"]'].sort(),
  );
}
calls = [];
response = undefined;
assert.equal(await api.remove(1), true);
assert.equal(calls[0][1].method, "DELETE");
assert.ok(
  calls.some(
    (call) =>
      call[0] === "removeQueries" &&
      JSON.stringify(call[1].queryKey) === '["trip",7,"activity",1]',
  ),
);
failure = new ApiError(403, "Forbidden");
await assert.rejects(api.save(activity, 1), (error) => error.status === 403);
assert.deepEqual(denied, [403]);
calls = [];
failure = new ApiError(404, "Not found");
await assert.rejects(api.remove(1), (error) =>
  error.message.includes("activity is unavailable"),
);
assert.deepEqual(
  denied,
  [403],
  "Individual activity 404 must not hide the trip",
);
assert.equal(calls.filter((call) => call[0] === "invalidateQueries").length, 2);
failure = new ApiError(400, "activity local dates must fall within trip dates");
await assert.rejects(api.save(activity), /activity local dates/);
failure = undefined;
let finish;
assert.equal(
  successToasts.length,
  0,
  "Deletes and failed activity saves do not emit create/update success toasts",
);
response = new Promise((resolve) => {
  finish = resolve;
});
calls = [];
const first = api.save(activity);
await api.save(activity);
assert.equal(
  calls.length,
  1,
  "Duplicate submissions must be blocked before rerender",
);
finish(activity);
await first;
assert.deepEqual(
  successToasts.splice(0),
  ["Activity created."],
  "Duplicate submissions do not duplicate success toasts",
);

const wrap = (tag) =>
  function Primitive({ children }) {
    return React.createElement(tag, null, children);
  };
const primitiveMocks = {
  "@/components/ui/button": {
    Button: wrap("button"),
    buttonVariants: () => "button",
  },
  "@/components/ui/card": Object.fromEntries(
    ["Card", "CardContent", "CardHeader", "CardTitle"].map((key) => [
      key,
      wrap("div"),
    ]),
  ),
  "@/components/ui/alert-dialog": {},
  "./trip-dialog": {
    TripDialog: ({ children, open }) =>
      open === false ? null : React.createElement("section", null, children),
  },
  "./activity-form": {},
  "./trip-states": { TripError: () => React.createElement("p", null, "Error") },
};
let activityFormState = null,
  activityHookIndex = 0,
  overlapQuery;
const formModule = load("src/components/trips/activity-form.tsx", {
  "./activity-expense-drafts": { ActivityExpenseDrafts: () => null },
  ...primitiveMocks,
  "@/lib/api": apiMock,
  "@/lib/itinerary": itinerary,
  "@tanstack/react-query": {
    useQuery: (options) => {
      overlapQuery = options;
      return { data: [], isPending: false, isError: false };
    },
  },
  react: {
    useId: () => "activity",
    useRef: (value) => {
      if (!activityFormState) return { current: value };
      const index = activityHookIndex++;
      return (activityFormState[index] ??= { current: value });
    },
    useState: (initial) => {
      if (!activityFormState)
        return [typeof initial === "function" ? initial() : initial, () => {}];
      const index = activityHookIndex++;
      if (!(index in activityFormState))
        activityFormState[index] =
          typeof initial === "function" ? initial() : initial;
      return [
        activityFormState[index],
        (value) => {
          activityFormState[index] =
            typeof value === "function"
              ? value(activityFormState[index])
              : value;
        },
      ];
    },
  },
  "@/lib/activity-time": time,
  "./date-time-field": {
    DateTimeField: ({ draft }) =>
      React.createElement("input", { value: draft.value, readOnly: true }),
  },
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/input": {
    Input: (props) => React.createElement("input", props),
  },
  "@/components/ui/label": { Label: wrap("label") },
  "@/components/ui/select": Object.fromEntries(
    [
      "Select",
      "SelectContent",
      "SelectItem",
      "SelectTrigger",
      "SelectValue",
    ].map((key) => [key, wrap("div")]),
  ),
});
let tripFormState = null,
  tripFormHookIndex = 0;
const tripFormModule = load("src/components/trips/trip-form.tsx", {
  ...primitiveMocks,
  "@/lib/api": apiMock,
  "@/lib/activity-time": time,
  "@/lib/trips": trips,
  "@/components/ui/input": {
    Input: (props) => React.createElement("input", props),
  },
  react: {
    useState: (value) => {
      const initial = typeof value === "function" ? value() : value;
      if (!tripFormState) return [initial, () => {}];
      const index = tripFormHookIndex++;
      if (!(index in tripFormState)) tripFormState[index] = initial;
      return [
        tripFormState[index],
        (next) => {
          tripFormState[index] = next;
        },
      ];
    },
  },
  "./date-time-field": { DateTimeField: () => null },
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/input": {
    Input: (props) => React.createElement("input", props),
  },
  "@/components/ui/label": { Label: wrap("label") },
});
let submittedTrip;
const dateOnlyForm = tripFormModule.TripForm({
  initialValue: { ...datesOnly, destination: "Cebu", time_zone: "Asia/Manila" },
  onSubmit: (input) => {
    submittedTrip = input;
  },
  pending: false,
  submitLabel: "Save changes",
});
assert.match(renderToStaticMarkup(dateOnlyForm), /type="date"/);
assert.match(
  renderToStaticMarkup(dateOnlyForm),
  /Add exact start and end times/,
);
dateOnlyForm.props.onSubmit({ preventDefault() {} });
assert.equal(submittedTrip.start_date, datesOnly.start_date);
assert.equal(
  submittedTrip.ends_at,
  null,
  "Date-only form does not invent exact times",
);
const exactTripForm = tripFormModule.TripForm({
  initialValue: {
    ...datesOnly,
    ...tripDraft,
    destination: "Cebu",
    time_zone: "Asia/Manila",
  },
  onSubmit: (input) => {
    submittedTrip = input;
  },
  pending: false,
  submitLabel: "Save changes",
});
exactTripForm.props.onSubmit({ preventDefault() {} });
assert.equal(
  submittedTrip.ends_at,
  tripDraft.ends_at,
  "Editing an exact-time trip preserves timestamp precision",
);
let submitted;
const form = formModule.ActivityForm({
  initialValue: { ...activity, starts_at: precise },
  tripID: 7,
  tripStart: "2026-10-01",
  tripEnd: "2026-10-03",
  tripStartsAt: null,
  tripEndsAt: null,
  tripZone: "Asia/Manila",
  onSubmit: (input) => {
    submitted = input;
  },
  onCancel: () => {},
  pending: false,
});
const formHtml = renderToStaticMarkup(form);
assert.match(formHtml, /value="2026-10-01T09:23:45\.123456"/);
assert.doesNotMatch(formHtml, /Activity time zone/);
assert.match(formHtml, /Activity name/);
assert.match(formHtml, /e.g. Dinner at the waterfront/);
assert.match(formHtml, /Save activity/);
const newFormHtml = renderToStaticMarkup(
  formModule.ActivityForm({
    tripID: 7,
    initialDate: "2026-10-02",
    tripStart: "2026-10-01",
    tripEnd: "2026-10-03",
    tripStartsAt: null,
    tripEndsAt: null,
    tripZone: "Asia/Manila",
    onSubmit: () => {},
    onCancel: () => {},
    pending: false,
  }),
);
assert.match(newFormHtml, /value="2026-10-02T"/);
assert.match(newFormHtml, /1 hour/);
const optionalProps = {
  tripID: 7,
  initialDate: "2026-10-02",
  tripStart: "2026-10-01",
  tripEnd: "2026-10-03",
  tripStartsAt: null,
  tripEndsAt: null,
  tripZone: "Asia/Manila",
  onSubmit() {},
  onCancel() {},
  pending: false,
};
const newActivityForm = nodes(formModule.ActivityForm(optionalProps));
assert.equal(
  newActivityForm.some((node) => node.type === "details"),
  false,
  "When is not collapsible",
);
assert.deepEqual(
  newActivityForm.filter((node) => node.type === "h3"),
  [],
  "Empty optional sections show no headings",
);
assert.deepEqual(
  newActivityForm
    .filter((node) => node.type === "input" && node.props.type === "radio")
    .map((node) => [node.props.value, node.props.checked]),
  [
    ["Rest", false],
    ["Eating", false],
    ["Travel", false],
    ["Activity", true],
    ["custom", false],
  ],
  "Category chips default to Activity",
);
assert.ok(
  newActivityForm.some((node) => node.type?.name === "ActivityExpenseDrafts"),
  "The Expenses card stays on new activities",
);
const collapsedHtml = renderToStaticMarkup(
  formModule.ActivityForm({
    ...optionalProps,
    initialStartsAt: "2026-10-02T07:00:00Z",
  }),
);
assert.deepEqual(
  newActivityForm
    .filter((node) => node.props.variant === "secondary")
    .map((node) => node.props["aria-label"]),
  ["Add place", "Add notes", "Add to do"],
  "Optional sections start as Add more pills",
);
assert.match(collapsedHtml, /Add more/);
for (const input of [/Search for a place/, /Activity notes/, /To-do item 1/]) {
  assert.doesNotMatch(collapsedHtml, input, "Optional inputs start hidden");
}
activityFormState = [];
activityHookIndex = 0;
nodes(formModule.ActivityForm(optionalProps))
  .find((node) => node.props["aria-label"] === "Add place")
  .props.onClick();
activityHookIndex = 0;
const placeOpened = nodes(formModule.ActivityForm(optionalProps));

// Search messages are written for the user, and TripError only shows ApiError text.
const StubTripError = primitiveMocks["./trip-states"].TripError;
const placeForm = () => {
  activityHookIndex = 0;
  return nodes(formModule.ActivityForm(optionalProps));
};
const placeError = () =>
  placeForm().find((node) => node.type === StubTripError)?.props.error;
const searchPlaces = () =>
  placeForm()
    .find((node) => ["Search", "Loading…"].includes(node.props.children))
    .props.onClick();
const typePlace = (value) =>
  placeForm()
    .find((node) => node.props.id === "activity-place-search")
    .props.onChange({ target: { value } });
typePlace("a");
searchPlaces();
assert.ok(placeError() instanceof ApiError);
assert.match(placeError().message, /at least 2 characters/);
typePlace("x".repeat(201));
searchPlaces();
assert.ok(placeError() instanceof ApiError);
assert.match(placeError().message, /shorter place name/);
// A repeat click during a search is not a validation failure.
const placeResponse = response;
let finishPlaceSearch;
response = () => new Promise((resolve) => (finishPlaceSearch = resolve));
typePlace("Cebu");
searchPlaces();
assert.equal(placeError(), undefined);
searchPlaces();
assert.equal(
  placeError(),
  undefined,
  "Searching twice must not blame the term",
);
finishPlaceSearch([]);
await new Promise((resolve) => setTimeout(resolve));
response = placeResponse;
activityFormState = null;

tripFormState = [];
const destinationForm = () => {
  tripFormHookIndex = 0;
  return nodes(
    tripFormModule.TripForm({
      onSubmit() {},
      pending: false,
      submitLabel: "Create trip",
    }),
  );
};
const destinationError = () =>
  destinationForm().find((node) => node.type === StubTripError)?.props.error;
const searchDestinations = () =>
  destinationForm()
    .find((node) => node.props.children === "Search")
    .props.onClick();
const typeDestination = (value) =>
  destinationForm()
    .find((node) => node.props.id === "trip-destination-search")
    .props.onChange({ target: { value } });
typeDestination("a");
searchDestinations();
assert.ok(destinationError() instanceof ApiError);
assert.match(destinationError().message, /at least 2 characters/);
const destinationResponse = response;
response = () => [{ provider_place_id: "no-kind" }];
typeDestination("Cebu");
searchDestinations();
await new Promise((resolve) => setTimeout(resolve));
assert.ok(destinationError() instanceof ApiError);
assert.match(destinationError().message, /search is unavailable/);
response = destinationResponse;
tripFormState = null;
console.log("Place and destination searches show their own messages.");
assert.deepEqual(
  placeOpened
    .filter((node) => node.type === "h3")
    .map((node) => node.props.children),
  ["Place"],
  "A pill opens only its own section",
);
assert.equal(
  placeOpened.some((node) => node.props["aria-label"] === "Add place"),
  false,
  "An opened section's pill goes away",
);
assert.deepEqual(
  newActivityForm
    .filter((node) => node.props.className === "field-required")
    .map((node) => node.props.children),
  ["Activity name", "Duration"],
  "Required fields are marked",
);
assert.equal(
  newActivityForm.find((node) => node.props.label === "Start").props.required,
  true,
  "Start time is marked required",
);
assert.match(
  collapsedHtml,
  /Friday, October 2/,
  "A new activity names its fixed day",
);
assert.match(
  collapsedHtml,
  /Ends [^<]* · Asia\/Manila/,
  "One line gives the end time and trip zone",
);
assert.ok(
  collapsedHtml.search(/readonly/i) <
    collapsedHtml.search(/Ends [^<]* · Asia\/Manila/) &&
    collapsedHtml.search(/Ends [^<]* · Asia\/Manila/) <
      collapsedHtml.search(/Duration/),
  "A new activity shows its end time under Start time, before Duration",
);
assert.ok(
  !newActivityForm
    .find((node) => node.props.children === "Cancel")
    .props.className.includes("sr-only"),
  "Cancel is visible beside Save activity",
);
assert.doesNotMatch(newFormHtml, />60</);
assert.match(newFormHtml, /Save activity/);
form.props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted.starts_at,
  precise,
  "Title-only edits must preserve precision despite the native input display",
);
assert.equal(
  submitted.ends_at,
  activity.ends_at,
  "Unchanged custom durations preserve the exact saved end",
);

const durationProps = {
  tripID: 7,
  initialDate: "2026-10-01",
  initialStartsAt: "2026-10-01T15:30:00Z",
  tripStart: "2026-10-01",
  tripEnd: "2026-10-04",
  tripStartsAt: null,
  tripEndsAt: null,
  tripZone: "Asia/Manila",
  onSubmit: (input) => {
    submitted = input;
  },
  onCancel() {},
  pending: false,
};
function durationForm(props = durationProps) {
  activityHookIndex = 0;
  return formModule.ActivityForm(props);
}
function chooseCustom(props = durationProps) {
  durationSelect(props).props.onValueChange("custom");
}
const durationSelect = (props = durationProps) =>
  nodes(durationForm(props)).find(
    (node) =>
      node.props.onValueChange &&
      nodes(node).some((child) => child.props.id === "activity-duration"),
  );
function enterHours(value, props = durationProps) {
  nodes(durationForm(props))
    .find((node) => node.props.type === "number")
    .props.onChange({ target: { value } });
}
activityFormState = [];
chooseCustom();
assert.equal(
  nodes(durationForm()).some((node) => node.props.label === "End"),
  false,
  "Custom duration replaces the end date/time fields",
);
enterHours("1.5");
durationForm().props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted.ends_at,
  "2026-10-01T17:00:00Z",
  "Fractional hours calculate an overnight end",
);
assert.equal(
  overlapQuery.queryKey[4],
  submitted.ends_at,
  "Overlap checks use the calculated custom end",
);
assert.match(renderToStaticMarkup(durationForm()), /Ends .* on 2026-10-02/);
assert.match(
  renderToStaticMarkup(
    durationForm({ ...durationProps, error: new Error("Save failed") }),
  ),
  /value="1.5"/,
  "Failed saves retain the custom hours",
);
for (const value of ["", "0", "-1", "NaN", "Infinity"]) {
  submitted = undefined;
  enterHours(value);
  durationForm().props.onSubmit({ preventDefault() {} });
  assert.equal(submitted, undefined, `Invalid hours ${value} must not submit`);
  assert.equal(overlapQuery.enabled, false);
  assert.match(renderToStaticMarkup(durationForm()), /greater than 0 hours/);
}
enterHours("100");
durationForm().props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted,
  undefined,
  "Custom durations must stay within the trip dates",
);
assert.match(renderToStaticMarkup(durationForm()), /fit within the trip dates/);
enterHours("49");
assert.match(
  renderToStaticMarkup(durationForm()),
  /Ends .* on 2026-10-04/,
  "Multi-day durations show their actual end date",
);
durationSelect().props.onValueChange("30");
durationForm().props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted.ends_at,
  "2026-10-01T16:00:00Z",
  "Switching back to a preset replaces the custom duration",
);
for (const [start, end, date] of [
  ["2026-03-08T06:30:00Z", "2026-03-08T08:00:00Z", "2026-03-08"],
  ["2026-11-01T05:30:00Z", "2026-11-01T07:00:00Z", "2026-11-01"],
]) {
  activityFormState = [];
  const props = {
    ...durationProps,
    initialDate: date,
    initialStartsAt: start,
    tripStart: date,
    tripEnd: date,
    tripZone: "America/New_York",
  };
  chooseCustom(props);
  enterHours("1.5", props);
  durationForm(props).props.onSubmit({ preventDefault() {} });
  assert.equal(
    submitted.ends_at,
    end,
    "Custom hours measure elapsed time across DST changes",
  );
}
activityFormState = null;
console.log(
  "Custom hours, overnight/multi-day ends, validation, presets, failed-save recovery, precision and DST passed.",
);

let dirtyChanges = 0;
const checklistProps = {
  ...durationProps,
  onDirty() {
    dirtyChanges++;
  },
};
const checklistForm = (extra = {}) =>
  durationForm({ ...checklistProps, ...extra });
const checklistButton = (label) =>
  nodes(checklistForm()).find((node) =>
    React.Children.toArray(node.props.children).includes(label),
  );
const checklistField = (label) =>
  nodes(checklistForm()).find((node) => node.props["aria-label"] === label);
activityFormState = [];
nodes(checklistForm())
  .find((node) => node.props.type === "radio" && node.props.value === "custom")
  .props.onChange();
assert.match(renderToStaticMarkup(checklistForm()), /Custom category/);
nodes(checklistForm())
  .find((node) => node.props.id === "activity-custom-category")
  .props.onChange({ target: { value: " Shopping " } });
checklistButton("To do").props.onClick();
checklistField("To-do item 1").props.onChange({
  target: { value: " Buy tickets " },
});
checklistButton("Add to-do item").props.onClick();
checklistField("To-do item 2").props.onChange({
  target: { value: "Visit museum" },
});
checklistForm().props.onSubmit({ preventDefault() {} });
assert.equal(submitted.category, "Shopping");
assert.deepEqual(JSON.parse(JSON.stringify(submitted.checklist)), [
  { text: "Buy tickets", done: false },
  { text: "Visit museum", done: false },
]);
assert.doesNotMatch(
  renderToStaticMarkup(checklistForm()),
  /type="checkbox"|Complete checklist|Sleeping/,
);
assert.match(renderToStaticMarkup(checklistForm()), />To do</);
assert.equal(
  submitted.starts_at,
  durationProps.initialStartsAt,
  "Category changes do not alter start time",
);
assert.match(
  renderToStaticMarkup(checklistForm({ error: new Error("Save failed") })),
  /value=" Buy tickets "/,
  "A failed save retains checklist drafts",
);
checklistField("Remove to-do item 1").props.onClick();
assert.equal(
  checklistField("To-do item 1").props.value,
  "Visit museum",
  "Removing an item retains the following item's draft",
);
checklistForm().props.onChangeCapture({
  target: {},
  currentTarget: { contains: () => true },
});
assert.ok(
  dirtyChanges >= 4,
  "Add/remove and native changes participate in discard protection",
);
for (const text of [" ", "é".repeat(101)]) {
  submitted = undefined;
  checklistField("To-do item 1").props.onChange({ target: { value: text } });
  checklistForm().props.onSubmit({ preventDefault() {} });
  assert.equal(
    submitted,
    undefined,
    "Blank and oversized UTF-8 items cannot save",
  );
}
checklistField("Remove to-do item 1").props.onClick();
checklistForm().props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted.checklist.length,
  0,
  "Removing every item submits an explicit empty list",
);
nodes(checklistForm())
  .find((node) => node.props.id === "activity-custom-category")
  .props.onChange({ target: { value: "é".repeat(51) } });
submitted = undefined;
checklistForm().props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted,
  undefined,
  "Custom categories use the API's UTF-8 byte limit",
);
activityFormState = [];
const editChecklistProps = { initialValue: activity };
assert.doesNotMatch(
  renderToStaticMarkup(checklistForm(editChecklistProps)),
  /type="checkbox"/,
);
checklistForm(editChecklistProps).props.onSubmit({ preventDefault() {} });
assert.equal(submitted.category, "Eating");
assert.deepEqual(
  JSON.parse(JSON.stringify(submitted.checklist)),
  activity.checklist,
  "Unchanged form saves preserve category and completion",
);
checklistField("To-do item 1").props.onChange({
  target: { value: "Reserve a different table" },
});
checklistForm(editChecklistProps).props.onSubmit({ preventDefault() {} });
assert.equal(submitted.checklist[0].text, "Reserve a different table");
assert.equal(
  submitted.checklist[0].done,
  true,
  "Renaming preserves hidden historical completion",
);
activityFormState = [];
const sleepingProps = { initialValue: { ...activity, category: "Sleeping" } };
assert.match(
  renderToStaticMarkup(checklistForm(sleepingProps)),
  /Custom category/,
);
checklistForm(sleepingProps).props.onSubmit({ preventDefault() {} });
assert.equal(
  submitted.category,
  "Sleeping",
  "Existing Sleeping activities remain editable as custom categories",
);
assert.deepEqual(Array.from(itinerary.activityCategories), [
  "Rest",
  "Eating",
  "Travel",
  "Activity",
]);
activityFormState = null;
console.log(
  "Custom/legacy categories, plain to-dos, validation, clearing and draft recovery passed.",
);
for (const section of ["details", "place", "notes", "checklist"]) {
  const markup = renderToStaticMarkup(
    formModule.ActivityForm({
      ...optionalProps,
      section,
      initialValue: activity,
    }),
  );
  assert.doesNotMatch(markup, /More activity details|Expenses \(optional\)/);
  assert.equal(markup.includes("Activity name"), section === "details");
  assert.equal(markup.includes("Search for a place"), section === "place");
  assert.equal(markup.includes("Activity notes"), section === "notes");
  assert.equal(markup.includes("Add to-do item"), section === "checklist");
  assert.match(markup, /Cancel/);
}
const membership = load("src/lib/memberships.ts", {
  react: {},
  "@/lib/api": apiMock,
  "@tanstack/react-query": {},
});
const trip = {
  id: 7,
  start_date: "2026-10-01",
  end_date: "2026-10-03",
  time_zone: "Asia/Manila",
};
const overnight = {
  ...activity,
  id: 2,
  title: "Late visit",
  starts_at: "2026-10-01T15:30:00Z",
  ends_at: "2026-10-01T16:30:00Z",
};
let queryMode = "success";
let boardActivities = [activity, overnight];
let boardConflicts = [];
let uiState = null,
  hookIndex = 0,
  uiRefs = [],
  refIndex = 0;
const uiApi = {
  pending: false,
  reset() {},
  async save() {
    return true;
  },
};
const boardQueries = [];
let itineraryNow = "2026-10-23T12:00:00Z";
const temporal = require("@js-temporal/polyfill").Temporal;
const components = load("src/components/trips/itinerary.tsx", {
  "next/navigation": {
    useRouter: () => ({ push() {}, replace() {} }),
    useSearchParams: () => new URLSearchParams(),
  },
  "@/lib/money": load("src/lib/money.ts"),
  "./expenses": { ActivityExpenses: wrap("section") },
  "next/link": { __esModule: true, default: wrap("a") },
  ...primitiveMocks,
  "@/lib/api": apiMock,
  "@/lib/activity-time": time,
  "@/lib/memberships": membership,
  "@js-temporal/polyfill": {
    Temporal: {
      ...temporal,
      Now: {
        zonedDateTimeISO: (zone) =>
          temporal.Instant.from(itineraryNow).toZonedDateTimeISO(zone),
      },
    },
  },
  "./trip-dialog": {
    TripDialog: ({ children, trigger, open }) =>
      React.createElement("section", null, trigger, open ? children : null),
  },
  "@/components/ui/calendar": { Calendar: wrap("div") },
  "@/components/ui/popover": Object.fromEntries(
    ["Popover", "PopoverContent", "PopoverTrigger"].map((key) => [
      key,
      wrap("div"),
    ]),
  ),
  "@/components/ui/alert-dialog": Object.fromEntries(
    [
      "AlertDialog",
      "AlertDialogCancel",
      "AlertDialogContent",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogTitle",
    ].map((key) => [key, wrap("div")]),
  ),
  "@/lib/itinerary": { ...itinerary, useItineraryApi: () => uiApi },
  "next/dynamic": {
    __esModule: true,
    default: () => () => React.createElement("div", null, "Map"),
  },
  react: {
    ...React,
    useEffect: () => {},
    useState: (initial) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Test harness switches between SSR and direct handler checks.
      if (!uiState) return React.useState(initial);
      const index = hookIndex++;
      if (!(index in uiState))
        uiState[index] = typeof initial === "function" ? initial() : initial;
      return [
        uiState[index],
        (value) => {
          uiState[index] = value;
        },
      ];
    },
    useRef: (initial) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Same test-only hook adapter as above.
      if (!uiState) return React.useRef(initial);
      return (uiRefs[refIndex++] ??= { current: initial });
    },
  },
  "@tanstack/react-query": {
    useQueryClient: () => client,
    useQueries: () => [],
    useQuery: ({ queryKey }) => (
      boardQueries.push(queryKey),
      {
        isPending: queryMode === "pending",
        isSuccess: queryMode === "success" || queryMode === "empty",
        isError: queryMode === "error",
        isFetching: false,
        data:
          queryKey[2] === "activities"
            ? queryKey[3] === "detail"
              ? boardActivities.find((a) => a.id === queryKey[4])
              : queryMode === "empty"
                ? []
                : boardActivities
            : boardConflicts,
        error: new ApiError(500, "Failure"),
      }
    ),
  },
});
for (const [category, icon] of [
  ["Rest", "coffee"],
  ["Eating", "utensils"],
  ["Travel", "plane"],
  ["Activity", "sparkles"],
  ["Shopping", "tag"],
  ["Sleeping", "tag"],
  ["__proto__", "tag"],
  ["constructor", "tag"],
  ["A".repeat(100), "tag"],
]) {
  boardActivities = [{ ...activity, category }];
  const html = renderToStaticMarkup(
    React.createElement(components.Itinerary, {
      trip,
      participants: [],
      canEdit: false,
      onFailure() {},
    }),
  );
  assert.match(html, /class="activity-category"/);
  assert.ok(
    html.includes(`data-category="${category}"`),
    "Badges preserve category labels, including custom and legacy values",
  );
  assert.ok(
    html.includes(`lucide-${icon}`),
    `${category} has an appropriate icon`,
  );
}
boardActivities = [activity, overnight];
const rangeHtml = renderToStaticMarkup(
  React.createElement(components.Itinerary, {
    trip,
    participants: [],
    canEdit: false,
    onFailure() {},
  }),
);
assert.match(rangeHtml, /2 activities planned/);
assert.match(
  rangeHtml,
  /ends Fri, Oct 2/,
  "Activity timing identifies an overnight end in the trip zone",
);
boardActivities = [
  { ...overnight, ends_at: "2026-10-01T15:45:00Z" },
  { ...activity, ends_at: "2026-10-02T01:00:00Z" },
  {
    ...activity,
    id: 3,
    starts_at: "2026-10-02T02:00:00Z",
    ends_at: "2026-10-02T03:00:00Z",
  },
];
const summaryHtml = renderToStaticMarkup(
  React.createElement(components.Itinerary, {
    trip,
    participants: [],
    canEdit: false,
    onFailure() {},
  }),
);
assert.match(
  summaryHtml,
  /2 activities planned/,
  "Summary excludes activities starting on other days",
);
assert.doesNotMatch(
  summaryHtml,
  /itinerary-day-timing/,
  "No aggregate day-level time range",
);
assert.equal(
  (summaryHtml.match(/dateTime="2026-10-01T01:00:00Z"/g) ?? []).length,
  1,
  "Activity start is shown once outside its card",
);
assert.equal(
  (summaryHtml.match(/dateTime="2026-10-02T01:00:00Z"/g) ?? []).length,
  1,
  "Activity end is shown once outside its card",
);
boardActivities = [activity, overnight];
for (const role of ["owner", "editor", "member", "viewer", undefined]) {
  const html = renderToStaticMarkup(
    React.createElement(components.Itinerary, {
      trip,
      participants: [],
      canEdit: membership.permissions(role).edit,
      onFailure: () => {},
    }),
  );
  assert.equal(
    html.includes("Add activity"),
    role === "owner" || role === "editor",
  );
  assert.doesNotMatch(
    html,
    /Activity options|Actions for|lucide-ellipsis/,
    "Activity cards have no three-dot menu for any role",
  );
  assert.doesNotMatch(
    html,
    /Quick add|Add (Rest|Eating|Travel|Activity|Custom) activity/,
  );
  assert.match(html, /Eating/);
  assert.doesNotMatch(
    html,
    /complete|Reserve table|Former participant|>Notes<|type="checkbox"|Add Sleeping activity/,
    "Cards hide full details and removed category choices",
  );
  assert.match(html, /View details for/);
  assert.match(html, /Trip dates/);
  assert.match(html, /dateTime="2026-10-01"/);
  assert.match(html, /aria-labelledby="day-2026-10-01-heading"/);
  assert.match(html, /itinerary-board/);
  assert.match(html, /ends Fri, Oct 2/);
  assert.doesNotMatch(
    html,
    /No schedule conflicts/,
    "Closed conflict dialog stays hidden",
  );
  assert.match(html, /Day [123] of 3/);
}
for (const [mode, text] of [
  ["pending", "Loading activities"],
  ["empty", "Nothing planned yet"],
  ["error", "Error"],
]) {
  queryMode = mode;
  const html = renderToStaticMarkup(
    React.createElement(components.Itinerary, {
      trip,
      canEdit: false,
      onFailure: () => {},
    }),
  );
  assert.ok(html.includes(text));
}
console.log(
  "Itinerary timezone/DST/precision, board pagination, payloads, permissions, states and cache updates passed.",
);

// Exercise the board's actual event handlers without a browser or extra test dependencies.
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [];
  return [
    node,
    ...nodes(
      isAutoLoaded(node.type) ? node.type(node.props) : node.props.children,
    ),
  ];
}
queryMode = "success";
uiState = [];
function board(tripValue = trip, canEdit = true) {
  hookIndex = refIndex = 0;
  return nodes(
    components.Itinerary({
      trip: tripValue,
      participants: [],
      canEdit,
      onFailure() {},
    }),
  );
}
const dialog = () =>
  board().find((node) => node.props.title === "Add activity");
const inlineForm = (canEdit = true) =>
  [
    ...nodes(details(canEdit).props.children),
    ...nodes(details(canEdit).props.headerContent),
  ].find((node) => node.props.section);
const trigger = {
  isConnected: true,
  disabled: false,
  getClientRects: () => [1],
};
const chooseRelativeDay = (offset) => {
  const date = temporal.PlainDate.from(uiState[0])
    .add({ days: offset })
    .toString();
  const bounded =
    date < trip.start_date
      ? trip.start_date
      : date > trip.end_date
        ? trip.end_date
        : date;
  board()
    .find(
      (node) =>
        node.props.className === "itinerary-day" && node.key === bounded,
    )
    .props.onClick();
};
const addButton = () =>
  board().find(
    (node) =>
      node.props.onClick &&
      React.Children.toArray(node.props.children).includes("Add activity"),
  );
const dayPanel = (date) =>
  board().find((node) => node.props.id === `day-${date}-details`);
const details = (canEdit = true) =>
  board(trip, canEdit).find(
    (node) =>
      node.props.className?.includes("reference-activity-dialog") &&
      !node.props.className.includes("activity-planning-dialog"),
  );
const detailActions = (canEdit = true) => [
  ...nodes(details(canEdit).props.headerAction),
  ...nodes(details(canEdit).props.titleAction),
  ...nodes(details(canEdit).props.headerContent),
  ...nodes(details(canEdit).props.children),
  ...nodes(details(canEdit).props.footer),
];
const openDetails = (canEdit = true) =>
  board(trip, canEdit)
    .find(
      (node) =>
        node.props["aria-label"] === `View details for ${activity.title}`,
    )
    .props.onClick({ currentTarget: trigger });
for (const role of ["owner", "editor", "member", "viewer"]) {
  const canEdit = membership.permissions(role).edit;
  openDetails(canEdit);
  assert.equal(
    details(canEdit).props.open,
    true,
    `${role} can open activity details`,
  );
  const html = renderToStaticMarkup(details(canEdit).props.children);
  assert.match(html, /Reserve table/);
  assert.match(html, /Order breakfast/);
  assert.match(
    renderToStaticMarkup(details(canEdit).props.footer),
    /Former participant/,
  );
  assert.doesNotMatch(
    html,
    /Created by|Activity options|Edit other activity details/,
    "Management stays in the footer without duplicate editing controls",
  );
  assert.match(html, /Notes/);
  assert.match(html, /To do/);
  assert.doesNotMatch(html, /complete|Done|line-through|type="checkbox"/);
  assert.equal(
    detailActions(canEdit).some(
      (node) => node.props["aria-label"] === "Edit activity details",
    ),
    canEdit,
  );
  assert.equal(
    detailActions(canEdit).some(
      (node) => node.props["aria-label"] === `Delete ${activity.title}`,
    ),
    canEdit,
  );
  assert.match(
    renderToStaticMarkup(details(canEdit).props.description),
    /Asia\/Manila/,
  );
  const schedule = renderToStaticMarkup(details(canEdit).props.description);
  assert.match(schedule, /Thursday, October 1/);
  assert.doesNotMatch(schedule, /60 min/);
  assert.match(
    renderToStaticMarkup(details(canEdit).props.titleAccessory),
    /Eating/,
  );
  assert.doesNotMatch(
    schedule,
    /Eating/,
    "Category belongs above the title, separately from the schedule",
  );
  assert.equal(details(canEdit).props.mobilePresentation, "fullscreen");
  assert.equal(details(canEdit).props.presentation, "detail");
  assert.equal(details(canEdit).props.finalFocus(), trigger);
  details(canEdit).props.onOpenChange(false);
  assert.equal(details(canEdit).props.open, false, "Dismissal closes details");
}
openDetails();
boardActivities = [{ ...activity, ends_at: "2026-10-02T02:00:00Z" }, overnight];
const overnightSchedule = renderToStaticMarkup(details().props.description);
assert.match(overnightSchedule, /Thursday/);
assert.match(overnightSchedule, /Friday/);
assert.match(
  overnightSchedule,
  /Asia\/Manila/,
  "The reference schedule retains the trip zone across dates",
);
boardActivities = [activity, overnight];
openDetails();
boardActivities = [
  {
    ...activity,
    notes: "Refreshed notes",
    checklist: [{ text: "Updated task", done: true }],
  },
  overnight,
];
assert.match(renderToStaticMarkup(details().props.children), /Refreshed notes/);
assert.match(
  renderToStaticMarkup(details().props.children),
  /Updated task/,
  "Details read refreshed board data",
);
boardActivities = [{ ...activity, notes: "", checklist: [] }, overnight];
assert.doesNotMatch(
  renderToStaticMarkup(details(false).props.children),
  /Notes|To do|Place/,
  "Empty optional sections are omitted for readers",
);
boardActivities = [overnight];
assert.equal(
  details().props.open,
  false,
  "A removed activity closes its details",
);
boardActivities = [activity, overnight];
assert.equal(
  details().props.open,
  false,
  "A removed activity does not silently reopen on refresh",
);
openDetails();
chooseRelativeDay(1);
assert.equal(details().props.open, false, "Changing days closes details");
chooseRelativeDay(-1);
openDetails();
detailActions()
  .find((node) => node.props["aria-label"] === "Edit activity details")
  .props.onClick();
assert.equal(
  details().props.open,
  true,
  "Editing keeps the activity drawer open",
);
assert.equal(dialog().props.open, false, "No separate edit screen opens");
assert.equal(inlineForm().props.initialValue, activity);
assert.equal(
  inlineForm(false).props.pending,
  true,
  "Lost permission disables editing",
);
queryMode = "error";
assert.equal(
  details().props.open,
  true,
  "A background refresh failure preserves the draft",
);
assert.equal(inlineForm().props.initialValue, activity);
queryMode = "success";
let unauthorizedSave = false;
const originalSave = uiApi.save;
uiApi.save = async () => {
  unauthorizedSave = true;
  return true;
};
await inlineForm(false).props.onSubmit(activity);
assert.equal(unauthorizedSave, false, "Lost permission prevents saves");
uiApi.save = originalSave;
inlineForm().props.onCancel();
assert.equal(
  details().props.open,
  true,
  "Cancel returns to the activity reader",
);
assert.equal(inlineForm(), undefined);
openDetails();
assert.match(
  renderToStaticMarkup(details().props.titleAccessory),
  /data-category="Eating"/,
  "Details reuse the card's category badge",
);
const emptyPlace = detailActions().filter(
  (node) => node.props["data-edit-section"] === "place",
);
assert.equal(emptyPlace.length, 1, "An empty section has one action");
assert.equal(emptyPlace[0].props["aria-label"], undefined);
assert.match(renderToStaticMarkup(emptyPlace[0]), /Add place/);
assert.ok(
  detailActions().some((node) => node.props["aria-label"] === "Edit notes"),
  "A filled section keeps its pencil",
);
for (const section of ["place", "notes", "checklist"]) {
  openDetails();
  detailActions()
    .find((node) => node.props["data-edit-section"] === section)
    .props.onClick();
  assert.equal(inlineForm().props.section, section);
  assert.equal(
    details().props.headerContent,
    undefined,
    "Section editing preserves the activity header",
  );
  assert.ok(
    nodes(details().props.children).some(
      (node) => typeof node.props.onViewChange === "function",
    ),
    "Expenses remain on the page",
  );
  assert.ok(details().props.footer, "Creator and Delete remain visible");
  let sent;
  uiApi.save = async (input) => {
    sent = input;
    return true;
  };
  await inlineForm().props.onSubmit({
    ...activity,
    title: "Must not rename other sections",
    notes: "Edited notes",
    place_id: 9,
    checklist: [{ text: "Changed task", done: true }],
  });
  assert.equal(
    sent.title,
    activity.title,
    "A section save preserves the activity title",
  );
  assert.equal(
    sent.notes,
    section === "notes" ? "Edited notes" : activity.notes,
  );
  assert.equal(sent.place_id, section === "place" ? 9 : activity.place_id);
  assert.equal(
    sent.checklist[0].text,
    section === "checklist" ? "Changed task" : activity.checklist[0].text,
  );
  assert.equal(details().props.open, true);
  assert.equal(inlineForm(), undefined);
}
uiApi.save = originalSave;
openDetails();
detailActions()
  .find((node) => node.props["aria-label"] === `Delete ${activity.title}`)
  .props.onClick();
assert.equal(details().props.open, false);
const deleteConfirmation = () =>
  board().find(
    (node) => node.props.open && node.props.children?.props?.finalFocus,
  );
assert.equal(deleteConfirmation().props.children.props.finalFocus(), trigger);
deleteConfirmation().props.onOpenChange(false);
assert.equal(
  deleteConfirmation(),
  undefined,
  "Cancelling deletion keeps the activity",
);
openDetails();
trigger.isConnected = false;
const detailFallback = {};
uiRefs[2].current = detailFallback;
assert.equal(
  details().props.finalFocus(),
  detailFallback,
  "Missing card falls back to the selected heading",
);
trigger.isConnected = true;
details().props.onOpenChange(false);
console.log(
  "Activity details permissions, refreshed/removed data, edit/delete transitions and focus targets passed.",
);
boardConflicts = [
  {
    activity_ids: [1, 2],
    overlap_starts_at: "2026-10-01T15:30:00Z",
    overlap_ends_at: "2026-10-01T16:30:00Z",
  },
  {
    activity_ids: [3, 4],
    overlap_starts_at: "2026-10-01T15:00:00Z",
    overlap_ends_at: "2026-10-01T16:00:00Z",
  },
];
assert.equal(
  board().some((node) =>
    ["Previous date", "Next date"].includes(node.props["aria-label"]),
  ),
  false,
  "Previous/next arrows are removed",
);
assert.deepEqual(
  board()
    .filter((node) => node.props.className === "itinerary-day")
    .map((node) => node.key),
  ["2026-10-01", "2026-10-02", "2026-10-03"],
);
assert.ok(!dayPanel("2026-10-01").props.hidden);
assert.equal(dayPanel("2026-10-02"), undefined);
chooseRelativeDay(1);
assert.ok(!dayPanel("2026-10-02").props.hidden);
assert.equal(
  board().find((node) => node.props.conflicts).props.conflicts.length,
  1,
  "The second day includes a crossing overlap but excludes one ending at midnight",
);
assert.ok(
  board().some((node) => node.props["aria-label"] === "Tools for Fri, Oct 2"),
);
chooseRelativeDay(1);
assert.equal(
  uiState[0],
  trip.end_date,
  "Day strip reaches the trip's final date",
);
chooseRelativeDay(-1);
assert.ok(dayPanel("2026-10-02"));
chooseRelativeDay(-1);
const singleDay = { ...trip, end_date: trip.start_date };
assert.deepEqual(
  board(singleDay)
    .filter((node) => node.props.className === "itinerary-day")
    .map((node) => node.key),
  [trip.start_date],
  "A one-day trip has one selectable date",
);
boardConflicts = [];
addButton().props.onClick({ currentTarget: trigger });
assert.equal(dialog().props.open, true);
assert.equal(dialog().props.children.props.initialDate, "2026-10-01");
assert.equal(
  dialog().props.headerContent.props.children,
  "Thursday, October 1",
  "Add activity is headed by its fixed day",
);
assert.equal(
  dialog().props.initialFocus,
  dialog().props.children.props.titleRef,
);
assert.equal(dialog().props.finalFocus(), trigger);
dialog().props.children.props.onCancel();
assert.equal(dialog().props.open, false);
openDetails();
detailActions()
  .find((node) => node.props["aria-label"] === "Edit activity details")
  .props.onClick();
assert.equal(inlineForm().props.initialValue, activity);
inlineForm().props.onDirty();
inlineForm().props.onCancel();
assert.ok(inlineForm(), "Unsaved edits require discard confirmation");
details().props.onOpenChange(false);
assert.ok(inlineForm(), "Dismissal also protects unsaved edits");
confirmDiscard = true;
inlineForm().props.onCancel();
assert.equal(inlineForm(), undefined, "Confirmed discard returns to reading");
assert.equal(details().props.open, true);
openDetails();
detailActions()
  .find((node) => node.props["aria-label"] === "Edit activity details")
  .props.onClick();
uiApi.pending = true;
details().props.onOpenChange(false);
assert.ok(inlineForm(), "Saving blocks dismissal");
uiApi.pending = false;
uiApi.save = async () => {
  throw new Error("Save failed");
};
await inlineForm().props.onSubmit(activity);
assert.ok(inlineForm(), "Failed save retains the inline editor");
assert.equal(inlineForm().props.initialValue, activity);
uiApi.save = async () => true;
await inlineForm().props.onSubmit({
  ...activity,
  starts_at: "2026-10-02T01:00:00Z",
});
assert.equal(inlineForm(), undefined);
assert.equal(uiState[0], "2026-10-02", "Save selects the destination day");
assert.equal(
  board().some((node) => node.props.children === "Activity updated."),
  false,
  "Successful saves no longer insert a banner into the agenda",
);
trigger.isConnected = false;
const heading = {};
uiRefs[2].current = heading;
assert.equal(
  dialog().props.finalFocus(),
  heading,
  "Removed trigger falls back to selected day",
);
const dialogParts = Object.fromEntries(
  [
    "Root",
    "Trigger",
    "Portal",
    "Backdrop",
    "Popup",
    "Title",
    "Description",
    "Close",
  ].map((key) => [key, wrap("div")]),
);
const { TripDialog } = load("src/components/trips/trip-dialog.tsx", {
  react: {
    ...React,
    useRef: (initial) => ({ current: initial }),
    useEffect() {},
  },
  "@base-ui/react/dialog": { Dialog: dialogParts },
  "lucide-react": { X: wrap("span") },
  "@/components/ui/button": {
    Button: wrap("button"),
    buttonVariants: () => "button",
  },
});
let cancelled = false,
  changed = false;
const busyDialog = TripDialog({
  title: "Activity",
  description: "Times",
  busy: true,
  disablePointerDismissal: true,
  onOpenChange: () => {
    changed = true;
  },
});
busyDialog.props.onOpenChange(false, {
  cancel() {
    cancelled = true;
  },
});
assert.equal(cancelled, true);
assert.equal(changed, false);
assert.equal(busyDialog.props.disablePointerDismissal, true);
assert.equal(
  nodes(busyDialog).find((node) => node.type === dialogParts.Close).props
    .disabled,
  true,
);
const pinnedFooter = React.createElement("button", null, "Edit");
const compactDialog = TripDialog({
  title: "Details",
  description: React.createElement("span", null, "Schedule"),
  className: "activity-details-dialog",
  mobilePresentation: "fullscreen",
  presentation: "detail",
  headerAction: pinnedFooter,
  children: "Long details",
  footer: pinnedFooter,
});
const compactNodes = nodes(compactDialog);
const compactPopup = compactNodes.find(
  (node) => node.type === dialogParts.Popup,
);
assert.match(compactPopup.props.className, /activity-details-dialog/);
assert.equal(compactPopup.props["data-mobile-presentation"], "fullscreen");
const detailReader = compactNodes.find(
  (node) => node.props["data-slot"] === "trip-dialog-reader",
);
assert.ok(
  detailReader,
  "Detail title and content share one reading scroll region",
);
assert.ok(nodes(detailReader).some((node) => node.type === dialogParts.Title));
assert.ok(
  nodes(detailReader).some(
    (node) => node.props["data-slot"] === "trip-dialog-body",
  ),
);
assert.ok(
  !nodes(detailReader).some(
    (node) => node.props["data-slot"] === "trip-dialog-footer",
  ),
);
assert.equal(
  nodes(busyDialog).some(
    (node) => node.props["data-slot"] === "trip-dialog-reader",
  ),
  false,
  "Default dialogs retain their existing layout",
);
assert.equal(
  compactNodes.find((node) => node.props["data-slot"] === "trip-dialog-footer")
    .props.children,
  pinnedFooter,
);
assert.equal(
  compactNodes.find((node) => node.props["data-slot"] === "trip-dialog-body")
    .props.children,
  "Long details",
  "The action footer stays outside scrolling content",
);
console.log(
  "Activity dialog date selection, edit/save/cancel, failed saves, dismissal and focus targets passed.",
);

chooseRelativeDay(-1);
boardActivities = [
  { ...activity, ends_at: "2026-10-01T13:50:00Z" },
  { ...activity, id: 3, ends_at: "2026-10-01T02:00:00Z" },
];
addButton().props.onClick({ currentTarget: trigger });
const addProps = dialog().props.children.props;
assert.equal(
  addProps.initialStartsAt,
  "2026-10-01T13:50:00Z",
  "Use latest scheduled end regardless of list order",
);
assert.equal(dialog().props.description, undefined);
const prefilled = formModule.ActivityForm(addProps);
const startField = nodes(prefilled).find(
  (node) => node.props.label === "Start",
);
assert.equal(startField.props.hideDate, true);
assert.equal(startField.props.draft.value, "2026-10-01T21:50:00");
assert.equal(
  nodes(form).find((node) => node.props.label === "Start").props.hideDate,
  false,
  "Editing still allows moving to another date",
);
dialog().props.children.props.onCancel();
boardActivities = [overnight];
addButton().props.onClick({ currentTarget: trigger });
assert.equal(
  dialog().props.children.props.initialStartsAt,
  undefined,
  "Do not silently move an addition to the next day",
);
dialog().props.children.props.onCancel();
console.log(
  "Selected-day additions hide the date picker and start at the latest same-day end.",
);

// A map failure must leave the selected day's places readable.
const { default: TripMap } = load("src/components/trips/trip-map.tsx", {
  react: { ...React, useEffect() {}, useState: () => [true, () => {}] },
  "maplibre-gl": {},
  "maplibre-gl/dist/maplibre-gl.css": {},
});
const locatedActivity = {
  ...activity,
  place: { name: "Harbor Cafe", address: "12 Waterfront Road" },
};
const mapHtml = renderToStaticMarkup(
  React.createElement(TripMap, { activities: [locatedActivity] }),
);
assert.match(mapHtml, /map could not load/);
assert.match(mapHtml, /Harbor Cafe, 12 Waterfront Road/);
assert.match(
  renderToStaticMarkup(React.createElement(TripMap, { activities: [] })),
  /Add a place/,
);
console.log("Map fallback preserves place details and empty-state guidance.");

uiState = [];
uiRefs = [];
boardActivities = [
  activity,
  {
    ...overnight,
    id: 3,
    starts_at: "2026-10-02T01:00:00Z",
    ends_at: "2026-10-02T02:00:00Z",
  },
];
itineraryNow = "2026-10-01T17:00:00Z";
const todayButton = () =>
  board().find(
    (node) =>
      node.props.onClick &&
      React.Children.toArray(node.props.children).includes("Today"),
  );
assert.equal(uiState[0], undefined);
assert.ok(
  dayPanel("2026-10-02"),
  "Initial day uses the trip zone, where it is already Oct 2 while UTC is still Oct 1",
);
assert.equal(
  todayButton(),
  undefined,
  "Today is omitted when already selected",
);
chooseRelativeDay(-1);
assert.ok(todayButton(), "An active trip offers Today after navigating away");
todayButton().props.onClick();
assert.equal(uiState[0], "2026-10-02", "Today returns to the trip-local date");
assert.equal(todayButton(), undefined);
const mapDialog = () =>
  board().find((node) => node.props.title?.startsWith("Places on"));
assert.equal(mapDialog().props.children.props.activities.length, 1);
assert.equal(
  mapDialog().props.children.props.activities[0].id,
  3,
  "Map receives only the selected day's activities",
);
assert.ok(
  board().some(
    (node) =>
      node.props.onClick &&
      React.Children.toArray(node.props.children).includes("View map"),
  ),
  "Map action remains available",
);
const optionsDialog = () =>
  board().find((node) => node.props.title === "Day options");
optionsDialog().props.onOpenChange(true);
assert.equal(optionsDialog().props.open, true);
const optionsTrigger = { ...trigger, isConnected: true };
uiRefs[5].current = optionsTrigger;
board()
  .find(
    (node) =>
      node.props.onClick &&
      React.Children.toArray(node.props.children).includes("View map"),
  )
  .props.onClick({ currentTarget: trigger });
assert.equal(
  optionsDialog().props.open,
  false,
  "Selecting map closes Day options",
);
assert.equal(mapDialog().props.open, true);
assert.equal(
  optionsDialog().props.finalFocus(),
  false,
  "The sheet does not steal map focus",
);
assert.equal(
  mapDialog().props.finalFocus(),
  optionsTrigger,
  "Closing map returns to the settings icon",
);
mapDialog().props.onOpenChange(false);
optionsDialog().props.onOpenChange(true);
const overlapsButton = () =>
  board().find(
    (node) =>
      node.props.onClick &&
      React.Children.toArray(node.props.children).includes("Overlaps"),
  );
assert.equal(
  overlapsButton(),
  undefined,
  "Overlaps stays hidden on a day without overlaps",
);
boardConflicts = [
  {
    activity_ids: [1, 2],
    overlap_starts_at: "2026-01-01T00:00:00Z",
    overlap_ends_at: "2027-01-01T00:00:00Z",
  },
];
overlapsButton().props.onClick({ currentTarget: trigger });
const overlapsDialog = () =>
  board().find((node) => node.props.title?.startsWith("Conflicts on"));
assert.equal(optionsDialog().props.open, false);
assert.equal(overlapsDialog().props.open, true);
assert.equal(overlapsDialog().props.finalFocus(), optionsTrigger);
overlapsDialog().props.onOpenChange(false);
boardConflicts = [];
assert.equal(
  board().some((node) => node.type === "aside"),
  false,
  "No permanent map column competes with the agenda",
);
itineraryNow = "2026-10-04T00:00:00Z";
assert.equal(todayButton(), undefined, "Today is omitted outside the trip");
console.log(
  "Trip-local Today, accessible date selection, and on-demand selected-day map passed.",
);

// The visible rail and range request advance together without unbounded trip fetches.
uiState = [];
uiRefs = [];
const railTrip = { ...trip, end_date: "2026-11-12" };
itineraryNow = "2026-09-30T00:00:00Z";
const railDays = () =>
  board(railTrip, false).filter(
    (node) => node.props.className === "itinerary-day",
  );
assert.equal(railDays().length, 7);
assert.equal(railDays()[0].props["aria-current"], "date");
assert.equal(railDays()[6].props["aria-label"], "Wed, Oct 7");
railDays()[6].props.onClick();
assert.equal(uiState[0], "2026-10-07");
uiState[0] = "2026-10-08";
assert.equal(railDays()[0].props["aria-label"], "Thu, Oct 8");
const windowQuery = boardQueries
  .filter((key) => key[2] === "activities" && key[3] === "board")
  .at(-1);
assert.equal(windowQuery[4], "2026-10-07T16:00:00Z");
assert.equal(windowQuery[5], "2026-10-14T16:00:00Z");
uiState[0] = "2026-11-12";
assert.equal(
  railDays().length,
  1,
  "Final partial week excludes dates beyond trip end",
);
assert.equal(
  railDays()[0].key,
  railTrip.end_date,
  "Final window contains only the final in-range date",
);
console.log(
  "Seven-day rail selection, trip-local window requests, and long-trip boundaries passed.",
);

let detailRole = "owner",
  detailHook = 0;
const detailState = [];
let detailQuery = {
  isSuccess: true,
  data: {
    ...trip,
    name: "Cebu & friends",
    destination: "Cebu City",
    starts_at: activity.starts_at,
    ends_at: overnight.ends_at,
  },
};
const detailItinerary = () =>
  React.createElement("div", null, "Itinerary view");
const detailExpenses = () => React.createElement("div", null, "Expenses view");
let detailView = "";
const detailRoute = load("src/app/trips/[tripID]/page.tsx", {
  ...primitiveMocks,
  "next/link": {
    default: ({ children, ...props }) =>
      React.createElement("a", props, children),
  },
  "next/navigation": {
    useParams: () => ({ tripID: "7" }),
    useSearchParams: () => new URLSearchParams(detailView),
    useRouter: () => ({}),
  },
  react: {
    ...React,
    useCallback: (callback) => callback,
    useState: (initial) => {
      const index = detailHook++;
      if (!(index in detailState)) detailState[index] = initial;
      return [
        detailState[index],
        (value) => {
          detailState[index] = value;
        },
      ];
    },
  },
  "@tanstack/react-query": {
    useQueryClient: () => client,
    useMutation: () => ({ reset() {} }),
    useQuery: ({ queryKey }) =>
      queryKey[0] === "me"
        ? { isSuccess: true, data: { id: 11 } }
        : queryKey[2] === "members"
          ? {
              isSuccess: true,
              data: [
                {
                  user_id: 11,
                  role: detailRole,
                  display_name: "Ana Reyes",
                  email: null,
                },
              ],
            }
          : detailQuery,
  },
  "@/lib/api": apiMock,
  "@/lib/trips": { ...trips, useTripsApi: () => ({}) },
  "@/lib/activity-time": time,
  "@/lib/memberships": { ...membership, useMembershipsApi: () => ({}) },
  "@/components/trips/itinerary": { Itinerary: detailItinerary },
  "@/components/trips/expenses": { Expenses: detailExpenses },
  "@/components/trips/memberships": {
    Participants: wrap("div"),
    InviteForm: wrap("div"),
    PendingInvitations: wrap("div"),
  },
  "@/components/trips/trip-form": { TripForm: wrap("div") },
  "@/components/trips/trip-dialog": {
    TripDialog: ({ trigger }) => trigger ?? null,
  },
  "@/components/ui/alert-dialog": Object.fromEntries(
    [
      "AlertDialog",
      "AlertDialogAction",
      "AlertDialogCancel",
      "AlertDialogContent",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogTitle",
      "AlertDialogTrigger",
    ].map((key) => [key, wrap("div")]),
  ),
  "@/components/trips/trip-states": {
    TripLoading: () => React.createElement("p", null, "Loading trips"),
    TripError: () => React.createElement("p", null, "Trip error"),
    TripNotFound: () => React.createElement("p", null, "Trip not found"),
  },
});
const detailTree = () => {
  detailHook = 0;
  const route = detailRoute.default();
  return route.props.children.type(route.props.children.props);
};
for (detailRole of ["owner", "editor", "viewer"]) {
  const tree = detailTree();
  const itineraryProps = nodes(tree).find(
    (node) => node.type === detailItinerary,
  ).props;
  assert.equal(itineraryProps.canEdit, detailRole !== "viewer");
  const tools = nodes(tree);
  const peopleDialog = tools.find((node) => node.props.title === "People");
  assert.equal(peopleDialog.props.trigger.props["aria-label"], "People, 1");
  assert.match(renderToStaticMarkup(peopleDialog.props.trigger), />AR</);
  assert.equal(
    tools.some((node) => node.props.title === "Trip settings"),
    detailRole !== "viewer",
  );
  const metadata = renderToStaticMarkup(
    nodes(tree).find((node) => node.props.className === "trip-summary"),
  );
  assert.match(metadata, /Cebu &amp; friends/);
  assert.match(metadata, /Cebu City/);
  assert.ok(
    metadata.includes(trips.formatTripDates(trip.start_date, trip.end_date)),
  );
  assert.ok(
    metadata.includes(`dateTime="${activity.starts_at}"`) &&
      metadata.includes(`dateTime="${overnight.ends_at}"`),
    "Compact context preserves paired exact bounds",
  );
  const options = nodes(tree).find(
    (node) => node.props.title === "Trip options",
  );
  assert.equal(
    options.props.description,
    detailQuery.data.name,
    "Mobile options expose the full trip name",
  );
  assert.ok(
    nodes(tree).some((node) => node.props["aria-label"] === "Back to trips"),
    "Desktop back navigation belongs to the trip toolbar",
  );
}
detailRole = "owner";
detailQuery.data = {
  ...detailQuery.data,
  name: "A long trip name 日本 & friends ".repeat(12),
  destination: "日本 — a destination with a long name ".repeat(6),
  starts_at: null,
  ends_at: null,
};
const longDetail = nodes(detailTree()).find(
  (node) => node.props.className === "trip-summary",
);
assert.ok(
  renderToStaticMarkup(longDetail).includes(detailQuery.data.destination),
  "Compact metadata retains long destinations",
);
assert.equal(
  nodes(longDetail).some((node) => node.type === "time"),
  false,
  "Date-only trips do not invent exact bounds",
);
let mobileOptions = nodes(detailTree()).find(
  (node) => node.props.title === "Trip options",
);
assert.equal(
  mobileOptions.props.description,
  detailQuery.data.name,
  "Long mobile names remain readable in options",
);
nodes(mobileOptions.props.children)
  .find((node) => node.props.onClick)
  .props.onClick();
const peopleDialog = nodes(detailTree()).find(
  (node) => node.props.title === "People",
);
assert.equal(
  peopleDialog.props.open,
  true,
  "Mobile People opens the existing participant dialog",
);
mobileOptions = nodes(detailTree()).find(
  (node) => node.props.title === "Trip options",
);
assert.equal(mobileOptions.props.open, false);
assert.equal(
  mobileOptions.props.finalFocus(),
  false,
  "Closing options does not steal focus from People",
);
const itineraryDateChanged = nodes(detailTree()).find(
  (node) => node.type === detailItinerary,
).props.onDateChange;
itineraryDateChanged("2026-10-02");
detailView = "view=expenses";
let expenseTree = detailTree();
assert.ok(nodes(expenseTree).some((node) => node.type === detailExpenses));
assert.equal(
  nodes(expenseTree).find((node) => node.type === detailExpenses).props.active,
  true,
);
assert.equal(
  nodes(expenseTree).some((node) => node.type === detailItinerary),
  false,
);
assert.ok(
  nodes(expenseTree).some((node) => node.props.children === "Trip expenses"),
);
assert.ok(nodes(expenseTree).some((node) => node.props.title === "People"));
detailView = "view=unknown";
assert.equal(
  nodes(detailTree()).find((node) => node.type === detailExpenses).props.active,
  false,
  "The ledger stays mounted across views to retain editors",
);
assert.equal(
  nodes(detailTree()).find((node) => node.type === detailItinerary).props
    .initialDate,
  "2026-10-02",
);
detailView = "";
const cachedTrip = detailQuery.data;
detailQuery = {
  data: cachedTrip,
  isError: true,
  error: new ApiError(500, "Offline"),
};
const staleTripTree = detailTree();
assert.ok(
  nodes(staleTripTree).some((node) => node.type === detailExpenses),
  "A failed background trip refresh must not unmount ledger drafts",
);
assert.ok(
  nodes(staleTripTree).some((node) => node.props.className === "trip-summary"),
);
assert.ok(
  nodes(staleTripTree).some((node) => node.props.error?.message === "Offline"),
);
detailQuery = {
  data: cachedTrip,
  isError: true,
  error: new ApiError(404, "Removed"),
};
assert.match(renderToStaticMarkup(detailTree()), /Trip not found/);
detailQuery = { isPending: true };
assert.match(renderToStaticMarkup(detailTree()), /Loading trips/);
assert.equal(
  nodes(detailTree()).some((node) =>
    node.props.className?.includes("mobile-trip-header"),
  ),
  false,
  "Loading leaves shell navigation available",
);
detailQuery = { isError: true, error: new ApiError(500, "Unavailable") };
assert.match(renderToStaticMarkup(detailTree()), /Trip error/);
assert.equal(
  nodes(detailTree()).some((node) =>
    node.props.className?.includes("mobile-trip-header"),
  ),
  false,
  "Failed loads leave shell navigation available",
);
console.log(
  "Compact trip context, exact bounds, role tools, full mobile name and loading/error navigation passed.",
);

activityFormState = [];
const stagedCost = {
  id: -1,
  description: "Inn",
  currency: "PHP",
  amount_minor: "400000",
  payer_user_id: 0,
  split_mode: "equal",
  shares: [{ user_id: 1 }],
  incurred_on: "2026-10-01",
};
const drafts = nodes(durationForm()).find(
  (node) => node.type?.name === "ActivityExpenseDrafts",
);
drafts.props.onChange([stagedCost]);
submitted = undefined;
durationForm().props.onSubmit({ preventDefault() {} });
assert.equal(submitted.expense_changes.length, 1);
assert.equal(
  submitted.expense_changes[0].id,
  undefined,
  "Temporary draft IDs never reach the API",
);
assert.equal(submitted.expense_changes[0].description, "Inn");
assert.equal(
  itinerary.activityInput(submitted).expense_changes[0].amount_minor,
  "400000",
);
console.log(
  "Activity saves include staged costs without persisting temporary draft IDs.",
);

activityFormState = [];
const activityAttempts = [];
const retryProps = {
  ...durationProps,
  error: new Error("Response lost after commit"),
  onSubmit: (input, key) => activityAttempts.push({ input, key }),
};
durationForm(retryProps).props.onSubmit({ preventDefault() {} });
let retryForm = durationForm(retryProps);
nodes(retryForm)
  .find((node) => node.props.id === "activity-title")
  .props.onChange({ target: { value: "Edited after failed save" } });
retryForm.props.onChangeCapture({
  target: {},
  currentTarget: { contains: () => true },
});
durationForm(retryProps).props.onSubmit({ preventDefault() {} });
nodes(durationForm(retryProps))
  .find((node) => node.type?.name === "ActivityExpenseDrafts")
  .props.onChange([stagedCost]);
durationForm(retryProps).props.onSubmit({ preventDefault() {} });
assert.equal(activityAttempts.length, 3);
assert.equal(activityAttempts[1].input.title, "Edited after failed save");
assert.equal(activityAttempts[2].input.expense_changes.length, 1);
assert.ok(activityAttempts[0].key);
assert.ok(
  activityAttempts.every((attempt) => attempt.key === activityAttempts[0].key),
  "Editing activity fields or costs after a failed save must not create a new submission",
);

// Activity finance steps replace the reader contents and keep the selected activity.
queryMode = "success";
boardActivities = [activity];
uiState = [];
uiRefs = [];
openDetails();
details();
const financeSection = () =>
  nodes(details().props.children).find(
    (n) => typeof n.props.onViewChange === "function",
  );
assert.equal(financeSection().props.view, "overview");
financeSection().props.onViewChange("details");
assert.equal(details().props.title, "Expenses");
assert.equal(details().props.open, true);
assert.doesNotMatch(
  renderToStaticMarkup(details().props.children),
  /Reserve table|Order breakfast|Activity options/,
);
financeSection().props.onViewChange("loans");
assert.equal(details().props.title, "Borrow list");
assert.equal(details().props.backLabel, "Back to expenses");
details().props.onBack();
assert.equal(financeSection().props.view, "details");
details().props.onBack();
assert.equal(financeSection().props.view, "overview");
financeSection().props.onViewChange("personal");
assert.equal(details().props.title, "Expenses");
assert.equal(details().props.backLabel, "Back to activity");
assert.equal(details().props.headerAction, undefined);
assert.equal(details().props.titleAction, false);
assert.equal(
  details().props.footer,
  false,
  "Expenses hide activity management",
);
details().props.onBack();
assert.equal(financeSection().props.view, "overview");
details().props.onOpenChange(false);
details();
openDetails();
details();
assert.equal(
  financeSection().props.view,
  "overview",
  "Reopening an activity starts with its short overview",
);
let backed = false;
const stepDialog = TripDialog({
  title: "Expenses",
  description: "Activity",
  presentation: "detail",
  backLabel: "Back to activity",
  onBack: () => {
    backed = true;
  },
  children: "Expenses",
});
const backButton = nodes(stepDialog).find(
  (n) =>
    n.props.onClick && [n.props.children].flat().includes("Back to activity"),
);
backButton.props.onClick();
assert.equal(backed, true);
assert.equal(
  nodes(stepDialog).some((n) => n.type === dialogParts.Close),
  false,
  "A step Back button does not close the activity window",
);
console.log(
  "Activity finance steps, contextual Back and overview reset passed.",
);
