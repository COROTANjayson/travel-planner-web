// Run with: node scripts/check-memberships.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, mocks, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: (id) => mocks[id] || require(id), ...globals };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
let response;
let failure;
let calls = [];
const queryClient = Object.fromEntries(["invalidateQueries", "cancelQueries", "removeQueries"].map((method) => [method, async (options) => calls.push([method, options])]));
const apiModule = { ApiError, useApi: () => async (path, init) => {
  calls.push([path, init]);
  if (failure) throw failure;
  return response;
} };
const hooks = { ...React, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] };
const membership = load("src/lib/memberships.ts", {
  react: hooks, "@/lib/api": apiModule, "@tanstack/react-query": { useQueryClient: () => queryClient },
});
const owner = { user_id: 1, display_name: "Alex", email: "alex@example.com", role: "owner" };
const other = { user_id: 2, display_name: "Sam", email: null, role: "member" };
const invitation = { id: 3, trip_id: 7, email: "sam@example.com", role: "member", expires_at: "2030-01-01T00:00:00Z", revoked_at: null, accepted_at: null };
assert.equal(membership.participantName({ ...owner, display_name: " " }), owner.email);
assert.equal(membership.participantName({ ...owner, display_name: " ", email: null }), "Traveler");
assert.equal(membership.invitationStatus(invitation, 0), "pending");
assert.equal(membership.invitationStatus(invitation, Date.parse(invitation.expires_at)), "expired");
assert.equal(membership.invitationStatus({ ...invitation, accepted_at: "2029-01-01" }, Infinity), "accepted");
assert.equal(membership.invitationStatus({ ...invitation, accepted_at: "2029-01-01", revoked_at: "2029-01-02" }), "revoked");
for (const [role, expected] of [["owner", [true, true, false]], ["editor", [false, true, true]], ["member", [false, false, true]], ["viewer", [false, false, true]], [undefined, [false, false, false]]]) {
  const allowed = membership.permissions(role);
  assert.deepEqual([allowed.manage, allowed.edit, allowed.leave], expected);
}

const wrap = (tag) => function Primitive({ children }) { return React.createElement(tag, null, children); };
const components = load("src/components/trips/memberships.tsx", {
  "@/lib/memberships": { ...membership, useMembershipsApi: () => ({ pending: false }) },
  "@/lib/api": apiModule, "next/navigation": { useRouter: () => ({}) },
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/input": { Input: wrap("input") },
  "@/components/ui/label": { Label: wrap("label") },
  "@/components/ui/card": Object.fromEntries(["Card", "CardContent", "CardHeader", "CardTitle"].map((key) => [key, wrap("div")])),
  "@/components/ui/select": Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map((key) => [key, wrap("div")])),
  "@/components/ui/alert-dialog": {}, "@/components/trips/trip-states": {},
});
for (const role of ["owner", "editor", "member", "viewer", undefined]) {
  const current = role ? { ...owner, role } : undefined;
  const html = renderToStaticMarkup(React.createElement(components.Participants, { id: 7, participants: [owner, other], current, onFailure: () => {} }));
  assert.equal(html.includes("Transfer ownership"), role === "owner");
  assert.equal(html.includes(">Remove<"), role === "owner");
  assert.equal(html.includes("Leave trip"), !!role && role !== "owner");
  if (role === "owner") assert.equal((html.match(/>Remove</g) || []).length, 1);
}

const api = membership.useMembershipsApi(7);
response = [owner, other];
await api.members();
assert.equal(calls[0][0], "/api/v1/trips/7/members");
calls = [];
response = { ...invitation, token: "test-token" };
const created = await api.create(" sam@example.com ", "member");
assert.equal(created.token, "test-token");
assert.equal(calls[0][1].body, JSON.stringify({ email: "sam@example.com", role: "member" }));
assert.equal(calls[0][1].headers["Content-Type"], "application/json");
assert.equal(JSON.stringify(calls.slice(1)).includes("test-token"), false);
assert.equal(JSON.stringify(calls[1][1].queryKey), '["trip",7,"invitations"]');
calls = [];
response = other;
await api.updateRole(2, "editor");
assert.equal(calls[0][1].method, "PUT");
assert.equal(calls[0][1].body, '{"role":"editor"}');
assert.deepEqual(calls.slice(1).map((call) => JSON.stringify(call[1].queryKey)).sort(), ['["trip",7,"members"]', '["trip",7]', '["trips"]'].sort());
calls = [];
response = undefined;
await api.transfer(2);
assert.equal(calls[0][0], "/api/v1/trips/7/transfer-ownership");
assert.equal(calls[0][1].body, '{"user_id":2}');
calls = [];
await api.remove(2, true);
assert.equal(calls[0][1].method, "DELETE");
assert.deepEqual(calls.slice(1).map((call) => call[0]), ["cancelQueries", "removeQueries", "invalidateQueries"]);
calls = [];
response = other;
await api.accept(" test-token ");
assert.equal(calls[0][0], "/api/v1/invitations/accept");
assert.equal(calls[0][1].body, '{"token":"test-token"}');
assert.equal(calls.length, 2);
assert.equal(JSON.stringify(calls[1][1].queryKey), '["trips"]');
for (const condition of ["wrong email", "unverified", "expired", "revoked", "replaced", "already used"]) {
  failure = new ApiError(400, `${condition}: secret-token`);
  await assert.rejects(api.accept(" secret-token "), (error) => error.message === membership.acceptanceError && !error.message.includes("secret-token"));
}
for (const status of [403, 404, 409]) {
  calls = [];
  failure = new ApiError(status, "State changed");
  await assert.rejects(api.updateRole(2, "viewer"));
  assert.ok(calls.some((call) => call[0] === "invalidateQueries" && JSON.stringify(call[1].queryKey) === '["trip",7,"members"]'));
}
failure = undefined;
calls = [];
let finish;
response = new Promise((resolve) => { finish = resolve; });
const first = api.transfer(2);
await api.transfer(2);
assert.equal(calls.length, 1, "Repeated submissions are blocked before the next render");
finish();
await first;

let errorStatus = 409;
const realApi = load("src/lib/api.ts", {
  react: { useCallback: (callback) => callback },
  "@auth0/auth0-react": { useAuth0: () => ({ getAccessTokenSilently: async () => "fake-access-token" }) },
  "@tanstack/react-query": { useQueryClient: () => queryClient },
}, { Headers, fetch: async () => new Response(JSON.stringify({ error: "transfer ownership before leaving" }), { status: errorStatus }) });
await assert.rejects(realApi.useApi()("/api/v1/trips/7/members/1"), (error) => error.status === 409 && error.message === "transfer ownership before leaving");
errorStatus = 403;
await assert.rejects(realApi.useApi()("/api/v1/trips/7"), (error) => error.message === "You do not have permission to access this resource.");
errorStatus = 404;
await assert.rejects(realApi.useApi()("/api/v1/trips/7"), (error) => error.message === "The requested resource was not found.");
console.log("Membership permissions, participant controls, statuses, requests, cache updates, and safe acceptance errors passed.");
