import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLoader, isAutoLoaded } from "./lib/load.mjs";

const focused = [];
const testDocument = {
  body: {},
  activeElement: null,
  getElementById: (id) => ({ focus: () => focused.push(id) }),
};
const load = createLoader({
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
  globals: { TextEncoder, crypto, document: testDocument },
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const wrap = (type) =>
  function Wrapped({ children }) {
    return React.createElement(type, null, children);
  };
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

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The API hook: paths, invalidation, and which failures reach the trip page.
let response, failure, hold;
const calls = [];
const toasts = [];
const client = {
  invalidateQueries: async (options) => calls.push(["invalidate", options]),
};
const hookReact = {
  ...React,
  useRef: (value) => ({ current: value }),
  useState: (value) => [value, () => {}],
};
const hookMocks = {
  react: hookReact,
  "@/lib/api": {
    ApiError,
    useApi: () => async (path, init) => {
      calls.push([path, init]);
      if (hold) await hold;
      if (failure) throw failure;
      return typeof response === "function" ? response() : response;
    },
  },
  "@tanstack/react-query": { useQueryClient: () => client },
  sonner: { toast: { success: (message) => toasts.push(message) } },
};
const prep = load("src/lib/prep.ts", hookMocks);
const invalidated = () =>
  plain(calls.filter((call) => call[0] === "invalidate").map((c) => c[1]));
const prepInvalidation = [
  { queryKey: ["trip", 7, "prep"] },
  { queryKey: ["trip", 7, "ledger"] },
];
let tripFailures = 0;
const api = prep.usePrepApi(7, () => tripFailures++);

response = { id: 4 };
assert.deepEqual(
  plain(
    await api.create({
      title: "  Book the van ",
      kind: "one_person",
      assignee_user_id: 2,
      activity_id: 9,
      date: "2026-08-15",
    }),
  ),
  { id: 4 },
);
assert.equal(calls[0][0], "/api/v1/trips/7/prep-tasks");
assert.equal(calls[0][1].method, "POST");
assert.equal(calls[0][1].headers["Content-Type"], "application/json");
assert.deepEqual(JSON.parse(calls[0][1].body), {
  title: "Book the van",
  kind: "one_person",
  assignee_user_id: 2,
  activity_id: 9,
  date: "2026-08-15",
});
assert.deepEqual(invalidated(), prepInvalidation);
assert.deepEqual(toasts.splice(0), ["Task added."]);

response = undefined;
for (const [operation, method, path, body] of [
  [
    () =>
      api.update(4, { title: " Van ", activity_id: null, date: "2026-08-15" }),
    "PUT",
    "",
    { title: "Van", activity_id: null, date: "2026-08-15" },
  ],
  [() => api.remove(4), "DELETE", ""],
  [() => api.assign(4, null), "PUT", "/assignee", { user_id: null }],
  [() => api.claim(4), "PUT", "/claim"],
  [() => api.drop(4), "DELETE", "/claim"],
  [() => api.complete(4), "PUT", "/completion"],
  [() => api.reopen(4), "DELETE", "/completion"],
]) {
  calls.length = 0;
  assert.equal(await operation(), true, "204 responses count as success");
  assert.equal(calls[0][0], `/api/v1/trips/7/prep-tasks/4${path}`);
  assert.equal(calls[0][1].method, method);
  assert.deepEqual(
    calls[0][1].body && JSON.parse(calls[0][1].body),
    body,
    `${method} ${path} body`,
  );
  assert.deepEqual(invalidated(), prepInvalidation);
}
assert.deepEqual(
  toasts.splice(0),
  ["Task updated.", "Task assigned."],
  "Ticks and claims show in the row, so they add no toast",
);

// A task that moved on stays local: forwarding it to the trip page's failure
// handler would show Trip Not Found or a permanent permission banner.
for (const status of [404, 409]) {
  calls.length = 0;
  failure = new ApiError(status, "conflict: this task is already taken");
  await assert.rejects(api.claim(4), (error) => {
    assert.equal(error.status, status);
    assert.equal(
      error.message,
      "This task changed. The list has been refreshed.",
    );
    return true;
  });
  assert.equal(tripFailures, 0, `${status} must not reach the trip page`);
  assert.deepEqual(invalidated(), prepInvalidation, `${status} refreshes`);
}
calls.length = 0;
failure = new ApiError(403, "Forbidden");
await assert.rejects(api.complete(4), (error) => error.status === 403);
assert.equal(tripFailures, 1, "A lost role goes to the trip page");
assert.deepEqual(invalidated(), []);
tripFailures = 0;
failure = new ApiError(400, "invalid input: assignee must be on this trip");
await assert.rejects(api.assign(4, 9), (error) => error.status === 400);
assert.equal(tripFailures, 0);
failure = new Error("secret connection detail");
await assert.rejects(api.complete(4), (error) => {
  assert.equal(error.message, "Something went wrong. Please try again.");
  return true;
});
failure = undefined;

// One hook drops a duplicate while busy; a second row's hook is unaffected.
let release;
hold = new Promise((resolve) => (release = resolve));
calls.length = 0;
const first = api.complete(1);
const duplicate = await api.complete(1);
const otherRow = prep.usePrepApi(7, () => {}).complete(2);
assert.equal(duplicate, undefined);
release();
await Promise.all([first, otherRow]);
hold = undefined;
assert.deepEqual(
  calls.filter((call) => call[0] !== "invalidate").map((call) => call[0]),
  [
    "/api/v1/trips/7/prep-tasks/1/completion",
    "/api/v1/trips/7/prep-tasks/2/completion",
  ],
);

response = [{ id: 1 }];
assert.deepEqual(plain(await api.list()), [{ id: 1 }]);
response = undefined;
await assert.rejects(api.list(), (error) => error.status === 500);

// The activity picker reads every page, so long trips aren't cut short.
const itinerary = load("src/lib/itinerary.ts", hookMocks);
const read = hookMocks["@/lib/api"].useApi();
const activityPages = [
  Array.from({ length: 100 }, (_, id) => ({ id, starts_at: "" })),
  [{ id: 100, starts_at: "" }],
];
calls.length = 0;
response = () => activityPages.shift();
assert.equal((await itinerary.allActivities(read, 7)).length, 101);
assert.deepEqual(
  calls.map((call) => call[0]),
  [
    "/api/v1/trips/7/activities?limit=100&offset=0",
    "/api/v1/trips/7/activities?limit=100&offset=100",
  ],
);
response = undefined;
await assert.rejects(
  itinerary.allActivities(read, 7),
  (error) => error.status === 500,
);

// Helpers
const everyone = (ready, waiting) => ({
  id: 4,
  trip_id: 7,
  title: "Renew passport",
  kind: "everyone",
  assignee: null,
  completed_at: null,
  ready_user_ids: ready,
  waiting_user_ids: waiting,
});
const onePerson = (assignee = null, completed_at = null) => ({
  id: 5,
  trip_id: 7,
  title: "Book the van",
  kind: "one_person",
  assignee,
  completed_at,
  ready_user_ids: [],
  waiting_user_ids: [],
});
assert.equal(prep.isTaskDone(everyone([1, 2], [])), true);
assert.equal(prep.isTaskDone(everyone([1], [2])), false);
assert.equal(prep.isTaskDone(everyone([], [])), false);
assert.equal(prep.isTaskDone(onePerson()), false);
assert.equal(prep.isTaskDone(onePerson({ user_id: 1 }, "2026-10-01")), true);
for (const [role, expected] of [
  ["owner", true],
  ["editor", true],
  ["member", true],
  ["viewer", false],
])
  assert.equal(prep.takesPart({ role }), expected, role);
assert.equal(prep.takesPart(undefined), false);
assert.ok(prep.prepTitleError("   "));
assert.equal(prep.prepTitleError(" Van "), null);
assert.equal(prep.prepTitleError("a".repeat(200)), null);
assert.ok(prep.prepTitleError("a".repeat(201)));
assert.ok(prep.prepTitleError("日".repeat(67)), "The limit counts bytes");
// Sections: who acts next. Everyone tasks you ticked wait on others.
const task = (id, extra) => ({ ...onePerson(), id, ...extra });
const tasks = [
  task(1, { assignee: { user_id: 3 } }),
  task(2),
  task(3, { assignee: { user_id: 2 } }),
  { ...everyone([], [3, 2]), id: 4 },
  { ...everyone([3], [2]), id: 5 },
  task(6, { assignee: { user_id: 3 }, completed_at: "2026-10-01" }),
  { ...everyone([2, 3], []), id: 7 },
];
const ids = (list) => plain(list.map((t) => t.id));
let sorted = prep.prepSections(tasks, 3);
assert.deepEqual(ids(sorted.forYou), [1, 4]);
assert.deepEqual(ids(sorted.upForGrabs), [2]);
assert.deepEqual(ids(sorted.withOthers), [3, 5]);
assert.deepEqual(ids(sorted.done), [6, 7]);
sorted = prep.prepSections(tasks, undefined);
assert.deepEqual(
  ids(sorted.forYou),
  [],
  "Viewers have nothing waiting on them",
);
assert.deepEqual(ids(sorted.withOthers), [1, 3, 4, 5]);
// By activity: unfinished tasks, earliest activity first, then Whole trip.
const at = (id, starts_at) => ({ id, title: `A${id}`, starts_at });
const byActivityGroups = prep.prepByActivity([
  task(1, { activity: at(20, "2026-10-02T01:00:00Z") }),
  task(2),
  task(3, { activity: at(10, "2026-10-01T01:00:00Z") }),
  task(4, { activity: at(20, "2026-10-02T01:00:00Z") }),
  task(5, {
    activity: at(10, "2026-10-01T01:00:00Z"),
    completed_at: "x",
    assignee: { user_id: 1 },
  }),
]);
assert.deepEqual(
  plain(byActivityGroups.activities.map((g) => [g.activity.id, ids(g.tasks)])),
  [
    [10, [3]],
    [20, [1, 4]],
  ],
);
assert.deepEqual(ids(byActivityGroups.wholeTrip), [2]);
// Totals stay apart by currency and never lose minor units.
assert.deepEqual(
  plain(
    prep.totalsByCurrency([
      { currency: "PHP", amount_minor: "440000" },
      { currency: "USD", amount_minor: "2000" },
      { currency: "PHP", amount_minor: "9223372036854775000" },
    ]),
  ),
  [
    { currency: "PHP", amount_minor: "9223372036855215000" },
    { currency: "USD", amount_minor: "2000" },
  ],
);
console.log("Prep API paths, refreshes and failure routing passed.");

// Rows
const people = [
  { user_id: 1, role: "owner", display_name: "Ana", email: null },
  { user_id: 2, role: "editor", display_name: "Ben", email: null },
  { user_id: 3, role: "member", display_name: "Cara", email: null },
  { user_id: 4, role: "viewer", display_name: "Dee", email: null },
];
const person = (id) => people.find((other) => other.user_id === id);
const assigneeOf = (id) => ({
  user_id: id,
  display_name: person(id)?.display_name ?? "Sam",
  email: null,
});
const rowActions = [];
let rowFailure;
const rowApi = {
  pending: false,
  error: null,
};
for (const name of ["claim", "drop", "complete", "reopen"])
  rowApi[name] = async (id) => {
    rowActions.push([name, id]);
    if (rowFailure) throw rowFailure;
    return true;
  };
const realPrep = load("src/lib/prep.ts", hookMocks);
const nextLink = {
  default: ({ href, children, ...props }) =>
    React.createElement("a", { href, ...props }, children),
};
const { PrepTaskRow } = load("src/components/features/prep/prep-task-row.tsx", {
  react: {
    ...React,
    useState: (value) => [value, () => {}],
    useRef: (value) => ({ current: value }),
  },
  "next/link": nextLink,
  "@/lib/prep": { ...realPrep, usePrepApi: () => rowApi },
  "@/lib/memberships": {
    participantName: (p) => p.display_name.trim() || p.email || "Traveler",
    participantInitials: (p) => p.display_name.slice(0, 2).toUpperCase(),
  },
  "@/components/ui/button": {
    Button: ({ children, ...props }) =>
      React.createElement("button", props, children),
  },
  "@/components/ui/popover": {
    Popover: wrap("div"),
    PopoverContent: wrap("div"),
    PopoverTitle: wrap("div"),
    PopoverTrigger: wrap("div"),
  },
});
const noop = () => {};
const time = load("src/lib/activity-time.ts");
function row(task, currentID, overrides = {}) {
  const current = currentID ? person(currentID) : undefined;
  const props = {
    task,
    timeZone: "Asia/Manila",
    participants: people,
    current,
    canEdit: current?.role === "owner" || current?.role === "editor",
    onFailure: noop,
    onAction: noop,
    onActionError: noop,
    onOpen: noop,
    ...overrides,
  };
  const tree = PrepTaskRow(props);
  const all = nodes(tree);
  const markup = renderToStaticMarkup(React.createElement(PrepTaskRow, props));
  return {
    all,
    text: markup.replace(/<[^>]+>/g, " "),
    buttons: [...markup.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(
      (match) => match[1].replace(/<[^>]+>/g, "").trim(),
    ),
    box: all.find((node) => node.props.type === "checkbox"),
    button: (label) =>
      all.find(
        (node) =>
          typeof node.props.onClick === "function" &&
          // Menu items lead with an icon; match on their text.
          (node.props["aria-label"] ?? renderToStaticMarkup(node))
            .replace(/<[^>]+>/g, "")
            .startsWith(label),
      ),
  };
}
const claimLabel = (title) => `Claim ${title}`;

// Everyone: your own tick and the count; names stay in the details.
let view = row(everyone([1, 2], [4, 3]), 3);
assert.doesNotMatch(view.text, /Waiting on/);
assert.match(view.text, /2 of 4/);
assert.equal(view.box.props.checked, false);
await view.box.props.onChange({ target: { checked: true } });
assert.deepEqual(plain(rowActions.splice(0)), [["complete", 4]]);
view = row(everyone([1, 3], [2]), 3);
assert.equal(view.box.props.checked, true);
await view.box.props.onChange({ target: { checked: false } });
assert.deepEqual(plain(rowActions.splice(0)), [["reopen", 4]]);
view = row(everyone([1, 3], []), 3);
assert.match(view.text, /Everyone&#x27;s done|Everyone's done/);
assert.doesNotMatch(view.text, /2 of 2/, "Done everyone tasks drop the count");

// Viewers read everything and act on nothing but opening details.
for (const task of [
  everyone([1], [2]),
  onePerson(),
  onePerson(assigneeOf(3)),
  onePerson(assigneeOf(3), "2026-10-01T00:00:00Z"),
]) {
  view = row(task, 4);
  assert.equal(view.box, undefined, "Viewers have no checkbox");
  assert.deepEqual(view.buttons, [task.title], "Viewers only open details");
}
// Unknown membership (still loading or blocked) shows no controls either.
view = row(everyone([1], [2]), undefined);
assert.equal(view.box, undefined);

// One person: open, mine, someone else's, finished. Your own and unclaimed
// rows leave out "who" outside By activity; their section already says it.
view = row(onePerson(), 3);
assert.match(view.text, /Whole trip/);
assert.match(row(onePerson(), 3, { byActivity: true }).text, /Up for grabs/);
assert.equal(view.box, undefined);
await view.button(claimLabel("Book the van")).props.onClick();
assert.deepEqual(plain(rowActions.splice(0)), [["claim", 5]]);

view = row(onePerson(assigneeOf(3)), 3);
assert.doesNotMatch(view.text, /You/);
assert.match(
  row(onePerson(assigneeOf(3)), 3, { byActivity: true }).text,
  /You/,
);
assert.equal(view.box.props.checked, false);
assert.equal(view.button("Claim"), undefined);
await view.button("Drop Book the van").props.onClick();
assert.deepEqual(plain(rowActions.splice(0)), [["drop", 5]]);
await view.box.props.onChange({ target: { checked: true } });
assert.deepEqual(plain(rowActions.splice(0)), [["complete", 5]]);

view = row(onePerson(assigneeOf(2)), 3);
assert.match(view.text, /Ben is on it/);
assert.match(
  view.text,
  />BE<|BE/,
  "Someone else's task leads with their initials",
);
assert.equal(view.box, undefined, "You only tick your own");
assert.equal(view.button("Claim"), undefined);
assert.equal(view.button("Drop"), undefined);

view = row(onePerson(assigneeOf(3), "2026-10-01T00:00:00Z"), 3);
assert.match(view.text, /Done by you/);
assert.equal(view.box.props.checked, true);
assert.equal(view.button("Drop"), undefined);

// Finished work keeps a former traveler's name. Editors reopen from the options menu; members can't.
const departed = { user_id: 99, display_name: "Sam", email: null };
view = row(onePerson(departed, "2026-10-01T00:00:00Z"), 3);
assert.match(view.text, /Done by Sam/);
assert.equal(view.button("Reopen"), undefined);
view = row(onePerson(departed, "2026-10-01T00:00:00Z"), 2);
assert.equal(view.box, undefined, "Editors don't tick for others");
await view.button("Reopen").props.onClick();
await new Promise(setImmediate);
assert.deepEqual(plain(rowActions.splice(0)), [["reopen", 5]]);

// The reading area opens details; the options menu holds View, Reopen, Edit and Delete.
const opened = [];
row(onePerson(), 3, { onOpen: (mode) => opened.push(mode) })
  .button("Book the van")
  .props.onClick();
assert.deepEqual(opened, ["details"]);
assert.deepEqual(row(onePerson(), 2).buttons, [
  "Book the van",
  "Claim",
  "View",
  "Edit",
  "Delete",
]);
assert.deepEqual(row(onePerson(), 3).buttons, ["Book the van", "Claim"]);
assert.deepEqual(row(onePerson(assigneeOf(3)), 3).buttons, [
  "Book the van",
  "Drop",
]);
assert.deepEqual(row(onePerson(assigneeOf(2)), 3).buttons, ["Book the van"]);
assert.deepEqual(row(everyone([1], [2]), 2).buttons, [
  "Renew passport",
  "View",
  "Edit",
  "Delete",
]);
assert.deepEqual(
  row(onePerson(assigneeOf(2), "2026-10-01T00:00:00Z"), 2).buttons,
  ["Book the van", "View", "Reopen", "Edit", "Delete"],
);

// The detail line joins the day, the activity (a link outside By activity)
// and the task's costs without labels. This activity starts on Sep 30 in
// UTC, but Oct 1 in the trip's time zone; the row shows the task's own date.
const linked = {
  ...onePerson(assigneeOf(2)),
  activity: {
    id: 9,
    title: "Airport transfer",
    starts_at: "2026-09-30T17:00:00Z",
  },
  date: "2026-08-15",
};
view = row(linked, 3, { amounts: "₱4,400 · US$20" });
assert.ok(
  view.text.includes(
    `Ben is on it · ${time.dateLabel("2026-08-15")} · ₱4,400 · US$20 ·  Airport transfer`,
  ),
  view.text,
);
const link = view.all.find((node) => node.props.href);
assert.equal(link.props.href, "/trips/7?activity=9");
view = row(linked, 3, { byActivity: true });
assert.doesNotMatch(view.text, /Airport transfer/);
assert.doesNotMatch(row(onePerson(), 3).text, /Activity:|Date:/);

// A failed action is reported upward, because the row itself may be gone.
const actedOn = [];
const reported = [];
rowFailure = new ApiError(
  409,
  "This task changed. The list has been refreshed.",
);
await row(onePerson(), 3, {
  onAction: (id) => actedOn.push(id),
  onActionError: (error) => reported.push(error.status),
})
  .button("Claim Book the van")
  .props.onClick();
await new Promise(setImmediate); // Row actions run in the background.
rowFailure = undefined;
rowActions.length = 0;
assert.deepEqual(actedOn, [5]);
assert.deepEqual(reported, [409]);
console.log("Prep rows for each role and task state passed.");

// Inside an activity: your own task needs no "You", unclaimed ones say so, the
// activity link is dropped, and editors can move a task back to the whole trip.
{
  const linked = (task) => ({
    ...task,
    activity: { id: 9, title: "Kayak tour", starts_at: "2026-10-02T01:00:00Z" },
  });
  const opened = [];
  let inside = row(linked(onePerson(assigneeOf(1))), 1, {
    inActivity: true,
    onOpen: (mode) => opened.push(mode),
  });
  assert.doesNotMatch(inside.text, /\bYou\b|Kayak tour/);
  inside.button("Remove from activity").props.onClick();
  assert.deepEqual(opened, ["remove"]);
  inside = row(linked(onePerson()), 1, { inActivity: true });
  assert.match(inside.text, /Up for grabs/);
  assert.equal(
    row(linked(onePerson()), 1).button("Remove from activity"),
    undefined,
    "Only rows inside an activity offer Remove from activity",
  );
  assert.equal(
    row(linked(onePerson()), 3, { inActivity: true }).button(
      "Remove from activity",
    ),
    undefined,
    "Members can't move tasks",
  );
}

// Add from Prep and Remove from activity send the activity change; expenses
// follow on the API side.
{
  let slots = [];
  let slot = 0;
  const stateReact = {
    ...React,
    useState: (initial) => {
      const index = slot++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next) =>
          (slots[index] =
            typeof next === "function" ? next(slots[index]) : next),
      ];
    },
  };
  const updates = [];
  let updateFailure;
  const moveApi = {
    pending: false,
    error: null,
    update: async (id, details, message) => {
      if (updateFailure) throw updateFailure;
      updates.push([id, details.activity_id, message]);
      return true;
    },
  };
  const dialogMocks = {
    react: stateReact,
    "@/components/shared/trip-dialog": { TripDialog: wrap("div") },
    "@/components/shared/trip-states": { TripError: () => null },
    "@/components/ui/button": {
      Button: ({ children, ...props }) =>
        React.createElement("button", props, children),
    },
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
    "@/lib/activity-time": time,
    "@/lib/memberships": {
      participantName: (p) => p.display_name,
    },
  };
  const { AddFromPrepDialog } = load(
    "src/components/features/itinerary/dialogs/add-from-prep-dialog.tsx",
    dialogMocks,
  );
  const tripWide = [
    {
      ...onePerson(assigneeOf(2)),
      id: 11,
      title: "Reserve kayaks",
      date: null,
    },
    { ...onePerson(), id: 12, title: "Book flights", date: "2026-10-01" },
    { ...everyone([1], [2, 3]), id: 13, title: "Check passport", date: null },
  ];
  let closed = 0;
  const addProps = {
    api: moveApi,
    trip: { time_zone: "Asia/Manila" },
    activity: { id: 9, title: "Kayak tour", starts_at: "2026-10-02T01:00:00Z" },
    tasks: tripWide,
    current: person(1),
    expenses: (task) =>
      task.id === 11 ? { count: 1, amount: "₱3,200.00" } : { count: 0 },
    finalFocus: noop,
    onClose: () => closed++,
  };
  const render = () => {
    slot = 0;
    const tree = AddFromPrepDialog(addProps);
    return [...nodes(tree), ...nodes(tree.props.footer)];
  };
  const text = () =>
    renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        render().find((n) => n.type === "ul"),
      ),
    ).replace(/<[^>]+>/g, " ");
  assert.match(text(), /Ben is on it · 1 expense · ₱3,200\.00/);
  assert.match(text(), /Up for grabs/);
  assert.match(text(), /Everyone · 1 of 3/);
  const addButton = () =>
    render().find((n) => /^(Add|Adding)/.test(String(n.props.children)));
  assert.equal(addButton().props.disabled, true, "Nothing picked yet");
  render()
    .find((n) => n.props.id === "add-from-prep-search")
    .props.onChange({ target: { value: "BOOK" } });
  assert.doesNotMatch(text(), /Reserve kayaks/);
  render()
    .find((n) => n.props.type === "checkbox")
    .props.onChange({ target: { checked: true } });
  render()
    .find((n) => n.props.id === "add-from-prep-search")
    .props.onChange({ target: { value: "" } });
  render()
    .find((n) => n.props.type === "checkbox")
    .props.onChange({ target: { checked: true } });
  assert.equal(addButton().props.children, "Add 2 tasks");
  await addButton().props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(updates.splice(0), [
    [11, 9, ""],
    [12, 9, "2 tasks added to Kayak tour."],
  ]);
  assert.equal(closed, 1);

  const { RemoveFromActivityDialog } = load(
    "src/components/features/itinerary/dialogs/remove-from-activity-dialog.tsx",
    dialogMocks,
  );
  const removeProps = {
    api: moveApi,
    task: tripWide[0],
    activityTitle: "Kayak tour",
    expenses: 1,
    finalFocus: noop,
    onClose: () => closed++,
  };
  const removeMarkup = renderToStaticMarkup(
    React.createElement(RemoveFromActivityDialog, removeProps),
  );
  assert.match(removeMarkup, /Remove from Kayak tour\?/);
  assert.match(removeMarkup, /Its 1 expense won’t be part of this activity/);
  const remove = nodes(RemoveFromActivityDialog(removeProps)).find(
    (n) => n.props.children === "Remove",
  );
  assert.equal(remove.props.variant, "destructive");
  updateFailure = new ApiError(409, "Changed");
  await remove.props.onClick();
  assert.equal(closed, 1, "A failed move keeps the confirmation open");
  updateFailure = undefined;
  await remove.props.onClick();
  assert.deepEqual(updates.splice(0), [
    [11, null, "Task moved to the whole trip."],
  ]);
  assert.equal(closed, 2);
}
console.log(
  "Activity Prep rows, Add from Prep and Remove from activity passed.",
);

// Section and dialogs use a small state harness so failures can be re-rendered.
let state = [];
let cursor = 0;
const harnessReact = {
  ...React,
  useState: (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [
      state[index],
      (value) => {
        state[index] = value;
      },
    ];
  },
  useRef: (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = { current: initial };
    return state[index];
  },
  useEffect: (effect) => effect(),
};
const render = (component, props) => {
  cursor = 0;
  return component(props);
};
const fresh = () => {
  state = [];
};
const tripDialog = ({ children, title, description, footer }) =>
  React.createElement(
    "div",
    { "data-title": title, description },
    children,
    footer,
  );
const dialogApi = {
  pending: false,
  error: null,
  created: [],
  updated: [],
  assigned: [],
  keys: [],
  outcome: true,
  reset() {},
  async create(input, key) {
    this.created.push(input);
    this.keys.push(key);
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  },
  async update(id, details) {
    this.updated.push([id, details]);
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  },
  async assign(id, userID) {
    this.assigned.push([id, userID]);
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  },
};
let activityQuery = { isPending: true };
const uiMocks = {
  react: harnessReact,
  "@tanstack/react-query": { useQuery: () => activityQuery },
  "@/lib/api": { ApiError, useApi: () => noop },
  "@/lib/prep": realPrep,
  "@/lib/memberships": {
    participantName: (p) => p.display_name.trim() || p.email || "Traveler",
  },
  "@/components/shared/trip-dialog": { TripDialog: tripDialog },
  "@/components/shared/trip-states": {
    TripError: ({ error }) => React.createElement("p", null, error.message),
  },
  "@/components/ui/alert": {
    Alert: wrap("div"),
    AlertDescription: wrap("p"),
  },
  "@/components/ui/button": {
    Button: ({ children, ...props }) =>
      React.createElement("button", props, children),
  },
  "@/components/ui/input": {
    Input: (props) => React.createElement("input", props),
  },
  "@/components/ui/label": { Label: wrap("label") },
  "@/components/ui/select": {
    Select: wrap("div"),
    SelectContent: wrap("div"),
    SelectItem: wrap("div"),
    SelectTrigger: wrap("div"),
    SelectValue: wrap("span"),
  },
};
const { PrepTaskDialog } = load(
  "src/components/features/prep/dialogs/prep-task-dialog.tsx",
  uiMocks,
);
const submitEvent = { preventDefault() {} };
const form = (tree) => nodes(tree).find((node) => node.type === "form");
const typed = (tree, value) =>
  nodes(tree)
    .find((node) => node.props.id === "prep-task-title")
    .props.onChange({ target: { value } });
let closed = 0;
const onClose = () => closed++;
const dialogProps = {
  api: dialogApi,
  trip: {
    id: 7,
    time_zone: "Asia/Manila",
    start_date: "2026-10-01",
    end_date: "2026-10-03",
  },
  people: people.filter(realPrep.takesPart),
  finalFocus: noop,
  onClose,
};

// A blank title never reaches the API.
fresh();
let tree = render(PrepTaskDialog, dialogProps);
await form(tree).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.length, 0);
assert.equal(closed, 0);
assert.match(
  renderToStaticMarkup(render(PrepTaskDialog, dialogProps)),
  /Add what needs doing/,
);

// Who's on it is one chip row; Up for grabs is the default. "Me" shows only
// for someone taking part, and Pick someone lists the others, never viewers.
const chip = (props, label) =>
  nodes(render(PrepTaskDialog, props)).find(
    (node) =>
      node.props["aria-pressed"] !== undefined && node.props.children === label,
  );
tree = render(PrepTaskDialog, dialogProps);
let markup = renderToStaticMarkup(tree);
assert.match(markup, /aria-pressed="true">Up for grabs/);
assert.doesNotMatch(markup, />Me</, "No Me chip without a current traveler");
assert.match(markup, /Anyone on the trip can claim it later/);
const asCara = { ...dialogProps, current: person(3) };
assert.ok(chip(asCara, "Me"));
assert.equal(
  chip({ ...dialogProps, current: person(4) }, "Me"),
  undefined,
  "Viewers can't take tasks",
);
typed(tree, " Book the van ");
chip(dialogProps, "Pick someone").props.onClick();
markup = renderToStaticMarkup(render(PrepTaskDialog, dialogProps));
assert.match(markup, /It shows under For you on their list/);
assert.match(markup, /Cara/);
assert.doesNotMatch(markup, /Dee/, "Viewers can't be assigned");
// Pick someone needs a person before it saves.
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.length, 0);
assert.match(
  renderToStaticMarkup(render(PrepTaskDialog, dialogProps)),
  /Pick who&#x27;s doing it/,
);
nodes(render(PrepTaskDialog, dialogProps))
  .find((node) => node.props.id === "prep-task-assignee")
  .props.onChange("3");

// A failed save keeps the dialog open with the entered values, and a retry
// of the same values reuses its request key.
dialogApi.outcome = new ApiError(500, "Offline");
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(closed, 0, "A failed save stays open");
assert.equal(
  nodes(render(PrepTaskDialog, dialogProps)).find(
    (node) => node.props.id === "prep-task-title",
  ).props.value,
  " Book the van ",
  "Entered values survive a failed save",
);
assert.deepEqual(plain(dialogApi.created.at(-1)), {
  title: " Book the van ",
  activity_id: null,
  date: null,
  kind: "one_person",
  assignee_user_id: 3,
});
// Editing after an uncertain save still retries the original submission.
const failedKey = dialogApi.keys.at(-1);
typed(render(PrepTaskDialog, dialogProps), "Book a different van");
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.keys.at(-1), failedKey);
assert.equal(closed, 0);
assert.equal(dialogApi.created.at(-1).title, "Book a different van");
dialogApi.outcome = true;
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(closed, 1);
assert.equal(
  dialogApi.keys.at(-1),
  dialogApi.keys.at(-2),
  "Retries reuse the key",
);
assert.ok(dialogApi.keys.at(-1));

// Me assigns the current traveler; Everyone never sends an assignee.
fresh();
typed(render(PrepTaskDialog, asCara), "Pack");
chip(asCara, "Me").props.onClick();
await form(render(PrepTaskDialog, asCara)).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.at(-1).assignee_user_id, 3);
fresh();
typed(render(PrepTaskDialog, dialogProps), "Passport");
chip(dialogProps, "Pick someone").props.onClick();
chip(dialogProps, "Everyone").props.onClick();
tree = render(PrepTaskDialog, dialogProps);
assert.equal(
  nodes(tree).some((node) => node.props.id === "prep-task-assignee"),
  false,
);
await form(tree).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.at(-1).kind, "everyone");
assert.equal(dialogApi.created.at(-1).assignee_user_id, null);
assert.notEqual(
  dialogApi.keys.at(-1),
  dialogApi.keys.at(-2),
  "New tasks get new keys",
);

// Save and add another keeps the dialog, the assignment, day and activity,
// clears the title and focuses it. A failure keeps everything.
const focusedTitle = [];
fresh();
closed = 0;
typed(render(PrepTaskDialog, asCara), "Pack");
chip(asCara, "Me").props.onClick();
const another = () =>
  nodes(render(PrepTaskDialog, asCara).props.footer).find(
    (node) => node.props.children === "Save and add another",
  );
// The title input's ref is the first ref the dialog makes.
state.find(
  (entry) =>
    entry && typeof entry === "object" && "current" in entry && !entry.current,
).current = { focus: () => focusedTitle.push("title") };
dialogApi.outcome = new ApiError(500, "Offline");
await another().props.onClick();
assert.equal(
  nodes(render(PrepTaskDialog, asCara)).find(
    (node) => node.props.id === "prep-task-title",
  ).props.value,
  "Pack",
);
dialogApi.outcome = true;
await another().props.onClick();
tree = render(PrepTaskDialog, asCara);
assert.equal(closed, 0, "Save and add another stays open");
assert.equal(
  nodes(tree).find((node) => node.props.id === "prep-task-title").props.value,
  "",
);
assert.equal(chip(asCara, "Me").props["aria-pressed"], true);
assert.ok(focusedTitle.includes("title"));
assert.equal(dialogApi.created.at(-1).assignee_user_id, 3);

// Trip day and Activity wait behind Add more; each pill opens its dropdown.
const pickerField = (props, id) =>
  nodes(render(PrepTaskDialog, props)).find((node) => node.props.id === id);
const pill = (props, label) =>
  nodes(render(PrepTaskDialog, props)).find(
    (node) => node.props["aria-label"] === `Add ${label}`,
  );
const airport = {
  id: 9,
  title: "Airport transfer",
  starts_at: "2026-09-30T17:00:00Z",
};
fresh();
closed = 0;
activityQuery = { isSuccess: true, data: [airport] };
typed(render(PrepTaskDialog, dialogProps), "Book the driver");
assert.equal(pickerField(dialogProps, "prep-task-date"), undefined);
assert.equal(pickerField(dialogProps, "prep-task-activity"), undefined);
pill(dialogProps, "trip day").props.onClick();
pill(dialogProps, "activity").props.onClick();
assert.equal(
  pill(dialogProps, "trip day"),
  undefined,
  "Each pill goes once used",
);
assert.deepEqual(
  plain(pickerField(dialogProps, "prep-task-activity").props.options),
  [
    { value: "0", label: "No activity" },
    {
      value: "9",
      label: `Airport transfer · ${time.dateLabel("2026-10-01")}`,
    },
  ],
);
// The day is picked from the trip's days, not a free calendar.
assert.deepEqual(
  plain(pickerField(dialogProps, "prep-task-date").props.options),
  [
    { value: "none", label: "No day" },
    { value: "2026-10-01", label: time.dateLabel("2026-10-01") },
    { value: "2026-10-02", label: time.dateLabel("2026-10-02") },
    { value: "2026-10-03", label: time.dateLabel("2026-10-03") },
  ],
);
pickerField(dialogProps, "prep-task-activity").props.onChange("9");
pickerField(dialogProps, "prep-task-date").props.onChange("2026-10-02");
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.at(-1).activity_id, 9);
assert.equal(dialogApi.created.at(-1).date, "2026-10-02");
assert.equal(closed, 1);

// Activities still loading or failing to load never block saving a task.
for (const [loading, message] of [
  [{ isPending: true }, /Loading activities/],
  [{ isError: true }, /Activities couldn/],
]) {
  fresh();
  closed = 0;
  activityQuery = loading;
  typed(render(PrepTaskDialog, dialogProps), "Book the driver");
  pill(dialogProps, "activity").props.onClick();
  assert.match(
    renderToStaticMarkup(render(PrepTaskDialog, dialogProps)),
    message,
  );
  await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
  assert.equal(dialogApi.created.at(-1).activity_id, null);
  assert.equal(closed, 1);
}

// Editing shows the saved values, even if the list hasn't loaded, and can clear them.
fresh();
closed = 0;
const linkedProps = {
  ...dialogProps,
  task: { ...onePerson(), activity: airport, date: "2026-10-02" },
};
activityQuery = { isPending: true };
assert.deepEqual(
  plain(pickerField(linkedProps, "prep-task-activity").props.options).map(
    (option) => option.value,
  ),
  ["0", "9"],
);
assert.equal(pickerField(linkedProps, "prep-task-activity").props.value, "9");
assert.equal(
  pickerField(linkedProps, "prep-task-date").props.value,
  "2026-10-02",
);
activityQuery = { isSuccess: true, data: [airport] };
assert.deepEqual(
  plain(pickerField(linkedProps, "prep-task-activity").props.options).map(
    (option) => option.value,
  ),
  ["0", "9"],
  "The saved activity isn't listed twice",
);
await form(render(PrepTaskDialog, linkedProps)).props.onSubmit(submitEvent);
assert.deepEqual(plain(dialogApi.updated.at(-1)), [
  5,
  { title: "Book the van", activity_id: 9, date: "2026-10-02" },
]);
fresh();
pickerField(linkedProps, "prep-task-activity").props.onChange("0");
pickerField(linkedProps, "prep-task-date").props.onChange("none");
await form(render(PrepTaskDialog, linkedProps)).props.onSubmit(submitEvent);
assert.deepEqual(plain(dialogApi.updated.at(-1)), [
  5,
  { title: "Book the van", activity_id: null, date: null },
]);

// A saved date outside a trip that has moved stays selectable and clearly marked,
// so saving the form doesn't silently drop it.
fresh();
const staleProps = {
  ...dialogProps,
  task: { ...onePerson(), date: "2026-08-15" },
};
assert.deepEqual(
  plain(pickerField(staleProps, "prep-task-date").props.options).slice(0, 2),
  [
    { value: "none", label: "No day" },
    {
      value: "2026-08-15",
      label: `${time.dateLabel("2026-08-15")} (outside the trip)`,
    },
  ],
);
await form(render(PrepTaskDialog, staleProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.updated.at(-1)[1].date, "2026-08-15");

// Editing keeps the kind unless the chips change it; finished tasks show who as text.
fresh();
closed = 0;
const renameProps = { ...dialogProps, task: everyone([], [1]) };
tree = render(PrepTaskDialog, renameProps);
assert.equal(
  nodes(tree).find((node) => node.props["aria-pressed"] === true).props
    .children,
  "Everyone",
);
assert.equal(
  nodes(tree.props.footer).some(
    (node) => node.props.children === "Save and add another",
  ),
  false,
);
assert.match(
  renderToStaticMarkup(
    render(PrepTaskDialog, { ...dialogProps, task: everyone([1], []) }),
  ),
  /Everyone · each person ticks their own.*Everyone has done it/,
);
assert.match(
  renderToStaticMarkup(
    render(PrepTaskDialog, {
      ...dialogProps,
      task: onePerson(assigneeOf(2), "2026-10-01T00:00:00Z"),
    }),
  ),
  /Ben · one person does it.*Reopen it/,
);
fresh();
typed(render(PrepTaskDialog, renameProps), "Passport");
await form(render(PrepTaskDialog, renameProps)).props.onSubmit(submitEvent);
assert.deepEqual(plain(dialogApi.updated.at(-1)), [
  4,
  { title: "Passport", activity_id: null, date: null },
]);
assert.equal(closed, 1);

// Editing an open one-person task can change who's on it.
fresh();
closed = 0;
const assignProps = { ...dialogProps, task: onePerson(assigneeOf(3)) };
const chipLabels = (t) =>
  nodes(t)
    .filter((node) => node.props["aria-pressed"] !== undefined)
    .map((node) => node.props.children);
assert.deepEqual(chipLabels(render(PrepTaskDialog, assignProps)), [
  "Up for grabs",
  "Pick someone",
  "Everyone",
]);
await form(render(PrepTaskDialog, assignProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.assigned.length, 0, "An unchanged assignee isn't sent");
assert.equal(closed, 1);
fresh();
nodes(render(PrepTaskDialog, assignProps))
  .find((node) => node.props.children === "Up for grabs")
  .props.onClick();
await form(render(PrepTaskDialog, assignProps)).props.onSubmit(submitEvent);
assert.deepEqual(plain(dialogApi.assigned.at(-1)), [5, null]);
// Switching to Everyone sends the kind and no assignee.
fresh();
nodes(render(PrepTaskDialog, assignProps))
  .find((node) => node.props.children === "Everyone")
  .props.onClick();
await form(render(PrepTaskDialog, assignProps)).props.onSubmit(submitEvent);
assert.equal(plain(dialogApi.updated.at(-1))[1].kind, "everyone");
assert.equal(dialogApi.assigned.length, 1, "Everyone tasks aren't assigned");
// Switching an everyone task to someone sends the kind, then assigns.
fresh();
const switchProps = { ...dialogProps, task: everyone([1], [2]) };
assert.match(
  renderToStaticMarkup(render(PrepTaskDialog, switchProps)),
  /Each person ticks/,
);
nodes(render(PrepTaskDialog, switchProps))
  .find((node) => node.props.children === "Pick someone")
  .props.onClick();
assert.match(
  renderToStaticMarkup(render(PrepTaskDialog, switchProps)),
  /The 1 done so far will be/,
);
nodes(render(PrepTaskDialog, switchProps))
  .find((node) => node.props.id === "prep-task-assignee")
  .props.onChange("3");
await form(render(PrepTaskDialog, switchProps)).props.onSubmit(submitEvent);
assert.equal(plain(dialogApi.updated.at(-1))[1].kind, "one_person");
assert.deepEqual(plain(dialogApi.assigned.at(-1)), [4, 3]);
console.log(
  "Prep dialogs validate, keep values after failures, and save the right fields.",
);

// Section
const tripValue = { id: 7, name: "Cebu" };
let query;
const failures = [];
const prepRowMock = ({ task, byActivity, amounts }) =>
  React.createElement(
    "li",
    null,
    `${task.title}${byActivity ? " [by activity]" : ""}${amounts ? ` [${amounts}]` : ""}`,
  );
const detailsMock = ({ task }) =>
  React.createElement("p", null, `Details for ${task.title}`);
let financeLedger = { data: undefined };
const { Prep } = load("src/components/features/prep/prep.tsx", {
  ...uiMocks,
  "@tanstack/react-query": { useQuery: () => query },
  "@/lib/api": { ApiError },
  "@/lib/prep": { ...realPrep, usePrepApi: () => ({ list() {}, reset() {} }) },
  "@/components/ui/skeleton": { Skeleton: () => null },
  "@/components/features/expenses/use-finance": {
    useFinance: () => ({
      ledger: financeLedger,
      currencies: { data: [{ code: "PHP", decimals: 2 }] },
    }),
  },
  "@/components/features/prep/drawers/task-details-drawer": {
    TaskDetailsDrawer: detailsMock,
  },
  "@/components/features/prep/prep-task-row": { PrepTaskRow: prepRowMock },
  "@/components/features/prep/dialogs/prep-task-dialog": {
    PrepTaskDialog: () => React.createElement("p", null, "Task dialog"),
  },
  "@/components/features/prep/dialogs/delete-prep-task-dialog": {
    DeletePrepTaskDialog: () => null,
  },
});
const section = (props = {}) =>
  render(Prep, {
    trip: tripValue,
    participants: people,
    current: person(2),
    canEdit: true,
    onFailure: (error) => failures.push(error.status),
    ...props,
  });
const sectionText = (tree) =>
  renderToStaticMarkup(tree).replace(/<[^>]+>/g, " ");

fresh();
query = { isPending: true };
assert.match(sectionText(section()), /Loading prep tasks/);
assert.doesNotMatch(
  sectionText(section()),
  /Add task/,
  "No adding before the list loads",
);

fresh();
let retried = 0;
query = {
  isError: true,
  error: new ApiError(500, "Offline"),
  refetch: () => retried++,
};
tree = section();
assert.match(sectionText(tree), /Offline/);
assert.equal(failures.length, 0, "A server error stays in the section");

for (const status of [403, 404]) {
  fresh();
  failures.length = 0;
  query = { isError: true, error: new ApiError(status, "Gone"), refetch: noop };
  section();
  assert.deepEqual(
    failures,
    [status],
    `A ${status} list load reaches the trip page`,
  );
}

fresh();
query = { isSuccess: true, data: [] };
assert.match(sectionText(section()), /Add the first thing/);
const memberEmpty = sectionText(
  section({ canEdit: false, current: person(3) }),
);
assert.match(memberEmpty, /when an editor adds them/);
assert.doesNotMatch(memberEmpty, /Add task/);

fresh();
const toDo = everyone([1], [2]);
const allReady = { ...everyone([1, 2], []), id: 6, title: "All ready" };
const finishedTask = {
  ...onePerson(assigneeOf(2), "2026-10-01T00:00:00Z"),
  id: 8,
  title: "Finished",
};
const open = { ...onePerson(), id: 9, title: "Open one" };
const ninas = { ...onePerson(assigneeOf(3)), id: 10, title: "Cara's" };
query = {
  isSuccess: true,
  data: [finishedTask, toDo, allReady, open, ninas],
};
// Progress replaces the subtitle; sections run For you, Up for grabs, With others, then Done.
let grouped = sectionText(section());
assert.match(grouped, /2 of 5 done/);
const order = [
  "For you",
  "Renew passport",
  "Up for grabs",
  "Open one",
  "With others",
  "Cara",
  "Done · 2",
].map((label) => grouped.indexOf(label));
assert.ok(
  order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])),
  grouped,
);
assert.doesNotMatch(grouped, /Finished|All ready/, "Done starts collapsed");
nodes(section())
  .find((node) => node.props["aria-controls"] === "prep-done")
  .props.onClick();
grouped = sectionText(section());
assert.match(grouped, /Finished/);
assert.match(grouped, /All ready/);
// For you lists only what waits on you; By activity groups unfinished tasks.
const viewChip = (label) =>
  nodes(section()).find(
    (node) =>
      node.props["aria-pressed"] !== undefined && node.props.children === label,
  );
viewChip("For you").props.onClick();
grouped = sectionText(section());
assert.match(grouped, /Renew passport/);
assert.doesNotMatch(grouped, /Open one|Cara|Finished/);
assert.equal(viewChip("For you").props["aria-pressed"], true);
viewChip("By activity").props.onClick();
grouped = sectionText(section());
assert.match(grouped, /Whole trip/);
assert.match(grouped, /Open one \[by activity\]/);
assert.doesNotMatch(grouped, /Finished/);
// Filters survive opening details, which the row's reading area asks for.
nodes(section())
  .find((node) => node.type === prepRowMock)
  .props.onOpen("details");
grouped = sectionText(section());
assert.match(grouped, /Details for /);
assert.equal(viewChip("By activity").props["aria-pressed"], true);
// Rows show linked expense totals per currency.
fresh();
financeLedger = {
  data: {
    expenses: [
      { prep_task_id: 9, currency: "PHP", amount_minor: "440000" },
      { prep_task_id: 9, currency: "PHP", amount_minor: "10000" },
      { prep_task_id: 3, currency: "PHP", amount_minor: "5" },
    ],
  },
};
assert.match(sectionText(section()), /Open one \[₱4,500\]/);
financeLedger = { data: undefined };
query = { isSuccess: true, data: [toDo] };
assert.doesNotMatch(sectionText(section()), /Done/, "Empty groups are hidden");

fresh();
query = { isSuccess: true, data: [toDo] };
assert.match(
  sectionText(section({ canEdit: false, current: person(4) })),
  /Viewers aren/,
);
assert.doesNotMatch(sectionText(section()), /Viewers aren/);

// A row's failure shows at the top of the section, so it survives the row going away.
fresh();
tree = section();
const rowProps = nodes(tree).find((node) => node.type === prepRowMock).props;
rowProps.onActionError(
  new ApiError(404, "This task changed. The list has been refreshed."),
);
assert.match(sectionText(section()), /This task changed/);
rowProps.onAction(4);
testDocument.activeElement = testDocument.body;
assert.doesNotMatch(
  sectionText(section()),
  /This task changed/,
  "The next action clears it",
);
assert.deepEqual(
  focused.splice(0),
  ["prep-task-4"],
  "Lost focus returns to the row",
);

const findElement = testDocument.getElementById;
testDocument.getElementById = (id) =>
  id.startsWith("prep-task-") ? null : findElement(id);
rowProps.onAction(4);
section();
assert.deepEqual(
  focused.splice(0),
  ["prep-heading"],
  "Completing a task hidden by the current view restores focus to the heading",
);
testDocument.getElementById = findElement;
testDocument.activeElement = {};
rowProps.onAction(4);
section();
assert.deepEqual(focused.splice(0), [], "Focus that survived is left alone");
section();
testDocument.activeElement = testDocument.body;
section();
assert.deepEqual(focused.splice(0), [], "Later refreshes don't move focus");

// Adding opens the dialog from either Add button.
fresh();
tree = section();
const addButtons = nodes(tree).filter(
  (node) => node.props.onClick && /Add task/.test(renderToStaticMarkup(node)),
);
assert.equal(
  addButtons.length,
  2,
  "Desktop and mobile each have an Add button",
);
addButtons[0].props.onClick({ currentTarget: {} });
assert.match(sectionText(section()), /Task dialog/);
console.log("Prep section states, grouping, permissions and notices passed.");
