// Run with: node scripts/check-auth.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const loadModule = createRequire(import.meta.url);

let auth = {};
let profile = {};
const calls = [];
class ApiError extends Error {}
const mocks = {
  "@auth0/auth0-react": { useAuth0: () => ({
    ...auth,
    loginWithRedirect: async (options) => calls.push(options),
    logout: async () => calls.push("logout"),
  }) },
  "@tanstack/react-query": {
    useQuery: () => profile,
    useQueryClient: () => ({ clear: () => calls.push("clear") }),
  },
  "@/components/ui/button": { Button: (props) => React.createElement("button", { ...props, variant: undefined }) },
  "@/lib/api": { ApiError, useApi: () => () => {} },
  react: { ...React, useState: () => [undefined, () => {}] },
};
const compiled = ts.transpileModule(fs.readFileSync("src/components/auth-panel.tsx", "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require: (id) => mocks[id] || loadModule(id), window: { location: { origin: "http://localhost:3000" } } };
vm.runInNewContext(compiled, context);
const panel = () => context.exports.AuthPanel();
const html = () => renderToStaticMarkup(panel());
function buttons(node) {
  if (!node || typeof node !== "object") return [];
  return [ ...(node.props?.onClick ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(buttons) ];
}

(async () => {
  auth = { isLoading: true };
  assert.match(html(), /Checking session/);
  auth = { isAuthenticated: false };
  assert.match(html(), /Log in/);
  assert.match(html(), /Sign up/);
  const loginButtons = buttons(panel());
  await loginButtons[0].props.onClick();
  await loginButtons[1].props.onClick();
  assert.equal(calls[0], undefined);
  assert.equal(calls[1].authorizationParams.screen_hint, "signup");
  auth = { isAuthenticated: true };
  profile = { isPending: true };
  assert.match(html(), /Loading your profile/);
  assert.match(html(), /Log out/);
  profile = { isError: true, error: new ApiError("Access denied") };
  assert.match(html(), /Access denied/);
  assert.match(html(), /Try again/);
  assert.match(html(), /Log out/);
  profile = { data: { display_name: "Alex", email: "alex@example.com" } };
  assert.match(html(), /Welcome back/);
  assert.match(html(), /Alex/);
  assert.match(html(), /alex@example.com/);
  assert.doesNotMatch(html(), /Sign up/);
  await buttons(panel())[0].props.onClick();
  assert.deepEqual(calls.slice(-2), ["clear", "logout"]);
  profile = { data: { display_name: "  ", email: null } };
  assert.match(html(), /Traveler/);
  console.log("Auth states and login/logout actions passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
