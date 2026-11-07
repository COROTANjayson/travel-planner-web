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
  globals: { TextEncoder, document: testDocument },
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
const prepInvalidation = [{ queryKey: ["trip", 7, "prep"] }];
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
const { PrepTaskRow } = load("src/components/features/prep/prep-task-row.tsx", {
  react: { ...React, useState: (value) => [value, () => {}] },
  "lucide-react": {
    CheckCircle2: () => null,
    Circle: () => null,
    MoreHorizontal: () => null,
  },
  "@/lib/prep": { ...realPrep, usePrepApi: () => rowApi },
  "@/lib/memberships": {
    participantName: (p) => p.display_name.trim() || p.email || "Traveler",
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
      all.find((node) =>
        String(node.props["aria-label"] ?? node.props.children).startsWith(
          label,
        ),
      ),
  };
}
const claimLabel = (title) => `Claim ${title}`;

// Everyone: your own tick, the count, and who's left.
let view = row(everyone([1, 2], [3, 4]), 3);
assert.match(view.text, /2 of 4 ready/);
assert.match(view.text, /Still to do: You, Dee/);
assert.equal(view.box.props.checked, false);
await view.box.props.onChange({ target: { checked: true } });
assert.deepEqual(plain(rowActions.splice(0)), [["complete", 4]]);
view = row(everyone([1, 3], [2]), 3);
assert.equal(view.box.props.checked, true);
await view.box.props.onChange({ target: { checked: false } });
assert.deepEqual(plain(rowActions.splice(0)), [["reopen", 4]]);
assert.match(
  row(everyone([1, 3], []), 3).text,
  /2 of 2 ready.*Everyone is ready/,
);
assert.match(
  row(everyone([1], [99]), 3).text,
  /Still to do: Traveler/,
  "A person missing from a stale member list still renders",
);

// Viewers read everything and act on nothing.
for (const task of [
  everyone([1], [2]),
  onePerson(),
  onePerson(assigneeOf(3)),
  onePerson(assigneeOf(3), "2026-10-01T00:00:00Z"),
]) {
  view = row(task, 4);
  assert.equal(view.box, undefined, "Viewers have no checkbox");
  assert.deepEqual(view.buttons, [], "Viewers have no actions");
}
// Unknown membership (still loading or blocked) shows no controls either.
view = row(everyone([1], [2]), undefined);
assert.equal(view.box, undefined);

// One person: open, mine, someone else's, finished.
view = row(onePerson(), 3);
assert.match(view.text, /Nobody has claimed this yet/);
assert.equal(view.box, undefined);
await view.button(claimLabel("Book the van")).props.onClick();
assert.deepEqual(plain(rowActions.splice(0)), [["claim", 5]]);

view = row(onePerson(assigneeOf(3)), 3);
assert.match(view.text, /You&#x27;re on it|You're on it/);
assert.equal(view.box.props.checked, false);
assert.equal(view.button("Claim"), undefined);
await view.button("Drop Book the van").props.onClick();
assert.deepEqual(plain(rowActions.splice(0)), [["drop", 5]]);
await view.box.props.onChange({ target: { checked: true } });
assert.deepEqual(plain(rowActions.splice(0)), [["complete", 5]]);

view = row(onePerson(assigneeOf(2)), 3);
assert.match(view.text, /Ben is on it/);
assert.equal(view.box, undefined, "You only tick your own");
assert.equal(view.button("Claim"), undefined);
assert.equal(view.button("Drop"), undefined);

view = row(onePerson(assigneeOf(3), "2026-10-01T00:00:00Z"), 3);
assert.match(view.text, /Done by you/);
assert.equal(view.box.props.checked, true);
assert.equal(view.button("Drop"), undefined);

// Finished work keeps a former traveler's name. Editors reopen; members can't.
const departed = { user_id: 99, display_name: "Sam", email: null };
view = row(onePerson(departed, "2026-10-01T00:00:00Z"), 3);
assert.match(view.text, /Done by Sam/);
assert.equal(view.button("Reopen"), undefined);
view = row(onePerson(departed, "2026-10-01T00:00:00Z"), 2);
assert.equal(view.box, undefined, "Editors don't tick for others");
await view.button("Reopen Book the van").props.onClick();
assert.deepEqual(plain(rowActions.splice(0)), [["reopen", 5]]);

// Editors manage tasks; a finished task can't be assigned until it is reopened.
assert.deepEqual(row(onePerson(), 2).buttons, [
  "Claim",
  "Edit",
  "Assign",
  "Delete",
]);
assert.deepEqual(row(onePerson(), 3).buttons, ["Claim"]);
assert.deepEqual(row(onePerson(assigneeOf(3)), 3).buttons, ["Drop"]);
assert.deepEqual(row(onePerson(assigneeOf(2)), 3).buttons, []);
assert.deepEqual(row(everyone([1], [2]), 2).buttons, ["Edit", "Delete"]);
assert.deepEqual(
  row(onePerson(assigneeOf(2), "2026-10-01T00:00:00Z"), 2).buttons,
  ["Edit", "Delete"],
);

// An activity and a date show under the title, and neither is required. This
// activity starts on Sep 30 in UTC, but Oct 1 in the trip's time zone.
view = row(
  {
    ...onePerson(),
    activity: {
      id: 9,
      title: "Airport transfer",
      starts_at: "2026-09-30T17:00:00Z",
    },
    date: "2026-08-15",
  },
  3,
);
assert.ok(
  view.text.includes(
    `Activity: Airport transfer · ${time.dateLabel("2026-10-01")}`,
  ),
  view.text,
);
assert.ok(
  view.text.includes(`Date: ${time.dateLabel("2026-08-15")}`),
  view.text,
);
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
const tripDialog = ({ children, title, description }) =>
  React.createElement("div", { "data-title": title, description }, children);
const dialogApi = {
  pending: false,
  error: null,
  created: [],
  updated: [],
  assigned: [],
  outcome: true,
  async create(input) {
    this.created.push(input);
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

// One-person tasks offer an assignee from people taking part; viewers aren't offered.
tree = render(PrepTaskDialog, dialogProps);
const markup = renderToStaticMarkup(tree);
assert.match(markup, /Anyone can claim it/);
assert.match(markup, /Cara/);
assert.doesNotMatch(markup, /Dee/, "Viewers can't be assigned");
typed(tree, " Book the van ");
tree = render(PrepTaskDialog, dialogProps);
const selectChange = nodes(tree).find(
  (node) => node.props.onChange && node.props.id === "prep-task-assignee",
);
selectChange.props.onChange("3");

// A failed save keeps the dialog open with the entered values.
dialogApi.outcome = new ApiError(500, "Offline");
tree = render(PrepTaskDialog, dialogProps);
await form(tree).props.onSubmit(submitEvent);
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
dialogApi.outcome = true;
await form(render(PrepTaskDialog, dialogProps)).props.onSubmit(submitEvent);
assert.equal(closed, 1);

// Everyone tasks never send an assignee, even if one was chosen first.
tree = render(PrepTaskDialog, dialogProps);
nodes(tree)
  .filter((node) => node.props.type === "radio")[1]
  .props.onChange();
tree = render(PrepTaskDialog, dialogProps);
assert.equal(
  nodes(tree).some((node) => node.props.id === "prep-task-assignee"),
  false,
);
await form(tree).props.onSubmit(submitEvent);
assert.equal(dialogApi.created.at(-1).kind, "everyone");
assert.equal(dialogApi.created.at(-1).assignee_user_id, null);

// An activity and a date are optional, and picking them sends their values.
const pickerField = (props, id) =>
  nodes(render(PrepTaskDialog, props)).find((node) => node.props.id === id);
const airport = {
  id: 9,
  title: "Airport transfer",
  starts_at: "2026-09-30T17:00:00Z",
};
fresh();
closed = 0;
activityQuery = { isSuccess: true, data: [airport] };
typed(render(PrepTaskDialog, dialogProps), "Book the driver");
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
// The date is picked from the trip's days, not a free calendar.
assert.deepEqual(
  plain(pickerField(dialogProps, "prep-task-date").props.options),
  [
    { value: "none", label: "No date" },
    { value: "2026-10-01", label: time.dateLabel("2026-10-01") },
    { value: "2026-10-02", label: time.dateLabel("2026-10-02") },
    { value: "2026-10-03", label: time.dateLabel("2026-10-03") },
  ],
);
assert.equal(
  nodes(render(PrepTaskDialog, dialogProps)).some(
    (node) => node.props.type === "date",
  ),
  false,
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
    { value: "none", label: "No date" },
    {
      value: "2026-08-15",
      label: `${time.dateLabel("2026-08-15")} (outside the trip)`,
    },
  ],
);
await form(render(PrepTaskDialog, staleProps)).props.onSubmit(submitEvent);
assert.equal(dialogApi.updated.at(-1)[1].date, "2026-08-15");

// Editing never changes a task's kind or assignee.
fresh();
closed = 0;
const renameProps = { ...dialogProps, task: everyone([], [1]) };
tree = render(PrepTaskDialog, renameProps);
assert.equal(
  nodes(tree).some((node) => node.props.type === "radio"),
  false,
);
assert.equal(
  nodes(tree).some((node) => node.props.id === "prep-task-assignee"),
  false,
);
typed(tree, "Passport");
await form(render(PrepTaskDialog, renameProps)).props.onSubmit(submitEvent);
assert.deepEqual(plain(dialogApi.updated.at(-1)), [
  4,
  { title: "Passport", activity_id: null, date: null },
]);
assert.equal(closed, 1);

// Assigning can also clear the assignee.
const { AssignPrepTaskDialog } = load(
  "src/components/features/prep/dialogs/assign-prep-task-dialog.tsx",
  uiMocks,
);
fresh();
closed = 0;
const assignProps = { ...dialogProps, task: onePerson(assigneeOf(3)) };
await form(render(AssignPrepTaskDialog, assignProps)).props.onSubmit(
  submitEvent,
);
assert.deepEqual(plain(dialogApi.assigned.at(-1)), [5, 3]);
assert.equal(closed, 1);
fresh();
tree = render(AssignPrepTaskDialog, assignProps);
nodes(tree)
  .find((node) => node.props.id === "prep-assign-assignee")
  .props.onChange("0");
await form(render(AssignPrepTaskDialog, assignProps)).props.onSubmit(
  submitEvent,
);
assert.deepEqual(plain(dialogApi.assigned.at(-1)), [5, null]);
console.log(
  "Prep dialogs validate, keep values after failures, and save the right fields.",
);

// Section
const tripValue = { id: 7, name: "Cebu" };
let query;
const failures = [];
const prepRowMock = ({ task }) =>
  React.createElement("li", null, `${task.title}`);
const { Prep } = load("src/components/features/prep/prep.tsx", {
  ...uiMocks,
  "lucide-react": { Plus: () => null },
  "@tanstack/react-query": { useQuery: () => query },
  "@/lib/api": { ApiError },
  "@/lib/prep": { ...realPrep, usePrepApi: () => ({ list() {}, reset() {} }) },
  "@/components/ui/skeleton": { Skeleton: () => null },
  "@/components/features/prep/prep-task-row": { PrepTaskRow: prepRowMock },
  "@/components/features/prep/dialogs/prep-task-dialog": {
    PrepTaskDialog: () => React.createElement("p", null, "Task dialog"),
  },
  "@/components/features/prep/dialogs/assign-prep-task-dialog": {
    AssignPrepTaskDialog: () => null,
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
query = { isSuccess: true, data: [finishedTask, toDo, allReady] };
const grouped = sectionText(section());
assert.ok(
  grouped.indexOf("To do") < grouped.indexOf("Renew passport") &&
    grouped.indexOf("Renew passport") < grouped.indexOf("Done") &&
    grouped.indexOf("Done") < grouped.indexOf("Finished") &&
    grouped.indexOf("Done") < grouped.indexOf("All ready"),
  grouped,
);
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
const addButtons = nodes(tree).filter((node) => node.props.onClick);
assert.equal(
  addButtons.length,
  2,
  "Desktop and mobile each have an Add button",
);
addButtons[0].props.onClick({ currentTarget: {} });
assert.match(sectionText(section()), /Task dialog/);
console.log("Prep section states, grouping, permissions and notices passed.");
