// Run with: node scripts/check-itinerary.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: (id) => mocks[id] || require(id), Date, Intl, Error };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const time = load("src/lib/activity-time.ts");
const precise = "2026-10-01T01:23:45.123456Z";
const local = time.instantToLocal(precise, "Asia/Manila");
assert.equal(local.value, "2026-10-01T09:23:45.123456");
assert.equal(time.dateTimeInputValue(local.value), "2026-10-01T09:23:45.123");
assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
assert.equal(time.localToInstant("2026-10-01T09:00", "Asia/Manila"), "2026-10-01T01:00:00Z");
assert.equal(time.localToInstant("2026-10-01T23:30", "America/Los_Angeles"), "2026-10-02T06:30:00Z");
assert.throws(() => time.localToInstant("", "UTC"), /required/);
assert.throws(() => time.localToInstant("2026-03-08T02:30", "America/New_York"), /does not exist/);
assert.throws(() => time.localToInstant("2026-11-01T01:30", "America/New_York"), /occurs twice/);
assert.throws(() => time.localToInstant("invalid", "Asia/Manila"), /valid/);
assert.throws(() => time.localToInstant("2026-10-01T09:00", "Unknown/Zone"), /valid/);
assert.equal(time.localToInstant("2026-03-08T01:30", "America/New_York"), "2026-03-08T06:30:00Z");
assert.equal(time.localToInstant("2026-03-08T03:30", "America/New_York"), "2026-03-08T07:30:00Z");
assert.equal(time.localToInstant("2026-11-01T01:30", "America/New_York", "earlier"), "2026-11-01T05:30:00Z");
assert.equal(time.localToInstant("2026-11-01T01:30", "America/New_York", "later"), "2026-11-01T06:30:00Z");
for (const occurrence of ["earlier", "later"]) {
  const instant = time.localToInstant("2026-11-01T01:30:00.123456", "America/New_York", occurrence);
  const edited = time.instantToLocal(instant, "America/New_York");
  assert.equal(edited.occurrence, occurrence);
  assert.equal(time.localToInstant(edited.value, "America/New_York", edited.occurrence), instant);
}
const converted = time.instantToLocal(precise, "America/New_York");
assert.equal(time.localToInstant(converted.value, "America/New_York", converted.occurrence), precise);
const priorTZ = process.env.TZ;
try {
  for (const deviceZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    process.env.TZ = deviceZone;
    assert.equal(time.localToInstant(local.value, "Asia/Manila"), precise);
    assert.equal(time.instantToLocal(precise, "Asia/Manila").value, local.value);
    assert.match(time.formatActivityTime(precise, "Asia/Manila"), /9:23|09:23/);
  }
} finally { if (priorTZ === undefined) delete process.env.TZ; else process.env.TZ = priorTZ; }

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
let calls = [], response, failure;
const client = Object.fromEntries(["invalidateQueries", "cancelQueries", "removeQueries", "setQueryData"].map((method) => [method, async (...args) => calls.push([method, ...args])]));
const apiMock = { ApiError, useApi: () => async (path, init) => {
  calls.push([path, init]);
  if (failure) throw failure;
  return response;
} };
const itinerary = load("src/lib/itinerary.ts", {
  react: { useCallback: (callback) => callback, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] },
  "@/lib/api": apiMock, "@tanstack/react-query": { useQueryClient: () => client },
});
const activity = { id: 1, trip_id: 7, created_by_user_id: 11, title: "  Breakfast  ", starts_at: "2026-10-01T01:00:00Z", ends_at: "2026-10-01T02:00:00Z", time_zone: "Asia/Manila", notes: "Notes", created_at: precise, updated_at: precise };
assert.deepEqual(Object.keys(itinerary.activityInput(activity)).sort(), ["ends_at", "notes", "starts_at", "time_zone", "title"]);
const denied = [];
const api = itinerary.useItineraryApi(7, (error) => denied.push(error.status));
const signal = new AbortController().signal;
response = [activity];
await api.list(10, signal);
assert.equal(calls[0][0], "/api/v1/trips/7/activities?limit=10&offset=10");
assert.equal(calls[0][1].signal, signal);
calls = [];
await api.conflicts(20, signal);
assert.equal(calls[0][0], "/api/v1/trips/7/activities/conflicts?limit=10&offset=20");
calls = [];
response = activity;
await api.get(1);
assert.equal(calls[0][0], "/api/v1/trips/7/activities/1");
for (const id of [undefined, 1]) {
  calls = [];
  const saved = await api.save(activity, id);
  assert.equal(saved.id, 1);
  assert.equal(calls[0][1].method, id === undefined ? "POST" : "PUT");
  const payload = JSON.parse(calls[0][1].body);
  assert.equal(payload.title, "Breakfast");
  assert.equal(payload.created_by_user_id, undefined);
  assert.equal(payload.id, undefined);
  assert.equal(calls[0][1].headers["Content-Type"], "application/json");
  assert.ok(calls.some((call) => call[0] === "setQueryData" && JSON.stringify(call[1]) === '["trip",7,"activity",1]'));
  assert.deepEqual(calls.filter((call) => call[0] === "invalidateQueries").map((call) => JSON.stringify(call[1].queryKey)).sort(), ['["trip",7,"activities"]', '["trip",7,"conflicts"]'].sort());
}
calls = [];
response = undefined;
assert.equal(await api.remove(1), true);
assert.equal(calls[0][1].method, "DELETE");
assert.ok(calls.some((call) => call[0] === "removeQueries" && JSON.stringify(call[1].queryKey) === '["trip",7,"activity",1]'));
failure = new ApiError(403, "Forbidden");
await assert.rejects(api.save(activity, 1), (error) => error.status === 403);
assert.deepEqual(denied, [403]);
calls = [];
failure = new ApiError(404, "Not found");
await assert.rejects(api.remove(1), (error) => error.message.includes("activity is unavailable"));
assert.deepEqual(denied, [403], "Individual activity 404 must not hide the trip");
assert.equal(calls.filter((call) => call[0] === "invalidateQueries").length, 2);
failure = new ApiError(400, "activity local dates must fall within trip dates");
await assert.rejects(api.save(activity), /activity local dates/);
failure = undefined;
let finish;
response = new Promise((resolve) => { finish = resolve; });
calls = [];
const first = api.save(activity);
await api.save(activity);
assert.equal(calls.length, 1, "Duplicate submissions must be blocked before rerender");
finish(activity);
await first;

const wrap = (tag) => function Primitive({ children }) { return React.createElement(tag, null, children); };
const primitiveMocks = {
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/card": Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle"].map((key) => [key, wrap("div")])),
  "@/components/ui/alert-dialog": {},
  "./activity-form": {}, "./trip-states": { TripError: () => React.createElement("p", null, "Error") },
};
const formModule = load("src/components/trips/activity-form.tsx", {
  ...primitiveMocks,
  react: { useId: () => "activity", useState: (value) => [typeof value === "function" ? value() : value, () => {}] },
  "@/lib/activity-time": time,
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/input": { Input: (props) => React.createElement("input", props) },
  "@/components/ui/label": { Label: wrap("label") },
  "@/components/ui/select": Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map((key) => [key, wrap("div")])),
});
let submitted;
const form = formModule.ActivityForm({ initialValue: { ...activity, starts_at: precise }, tripZone: "Asia/Manila", onSubmit: (input) => { submitted = input; }, onCancel: () => {}, pending: false });
const formHtml = renderToStaticMarkup(form);
assert.match(formHtml, /value="2026-10-01T09:23:45\.123"/);
assert.doesNotMatch(formHtml, /value="2026-10-01T09:23:45\.123456"/);
form.props.onSubmit({ preventDefault() {} });
assert.equal(submitted.starts_at, precise, "Title-only edits must preserve precision despite the native input display");
const membership = load("src/lib/memberships.ts", { react: {}, "@/lib/api": apiMock, "@tanstack/react-query": {} });
const trip = { id: 7, start_date: "2026-10-01", end_date: "2026-10-03", time_zone: "Asia/Manila" };
let queryMode = "success";
const components = load("src/components/trips/itinerary.tsx", {
  ...primitiveMocks, "@/lib/api": apiMock, "@/lib/activity-time": time, "@/lib/memberships": membership,
  "@/lib/itinerary": { ...itinerary, useItineraryApi: () => ({ pending: false }) },
  react: { ...React, useEffect: () => {} },
  "@tanstack/react-query": { useQueryClient: () => client, useQuery: ({ queryKey }) => ({
    isPending: queryMode === "pending", isError: queryMode === "error", isFetching: false,
    data: queryKey[2] === "activities" ? queryMode === "empty" ? [] : [activity] : [], error: new ApiError(500, "Failure"),
  }) },
});
for (const role of ["owner", "editor", "member", "viewer", undefined]) {
  const html = renderToStaticMarkup(React.createElement(components.Itinerary, { trip, participants: [], canEdit: membership.permissions(role).edit, onFailure: () => {} }));
  assert.equal(html.includes("Add activity"), role === "owner" || role === "editor");
  assert.equal(html.includes(">Delete<"), role === "owner" || role === "editor");
  assert.match(html, /Former participant/);
  assert.match(html, /Activities pagination/);
  assert.match(html, /Conflicts pagination/);
  assert.match(html, /Parallel activities are allowed/);
}
for (const [mode, text] of [["pending", "Loading activities"], ["empty", "No activities yet"], ["error", "Error"]]) {
  queryMode = mode;
  const html = renderToStaticMarkup(React.createElement(components.Itinerary, { trip, canEdit: false, onFailure: () => {} }));
  assert.ok(html.includes(text));
}
console.log("Itinerary timezone/DST/precision, payloads, requests, permissions, states, pagination and cache updates passed.");
