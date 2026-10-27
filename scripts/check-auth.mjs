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
let pathname = "/trips";
const calls = [];
class ApiError extends Error {}
const mocks = {
  "@auth0/auth0-react": {
    useAuth0: () => ({
      ...auth,
      loginWithRedirect: async (options) => calls.push(options),
      logout: async () => calls.push("logout"),
    }),
  },
  "@tanstack/react-query": {
    useQuery: () => profile,
    useQueryClient: () => ({ clear: () => calls.push("clear") }),
  },
  "@/components/ui/button": {
    Button: ({ children, onClick, disabled }) =>
      React.createElement("button", { onClick, disabled }, children),
  },
  "@/lib/api": { ApiError, useApi: () => () => {} },
  "@/components/ui/popover": Object.fromEntries(
    ["Popover", "PopoverContent", "PopoverTitle", "PopoverTrigger"].map(
      (key) => [
        key,
        ({ children }) => React.createElement("div", null, children),
      ],
    ),
  ),
  "@/components/trips/trip-dialog": {
    TripDialog: ({ children, trigger }) =>
      React.createElement("section", null, trigger, children),
  },
  "next/navigation": { usePathname: () => pathname },
  react: { ...React, useState: () => [undefined, () => {}] },
};
const compiled = ts.transpileModule(
  fs.readFileSync("src/components/auth-panel.tsx", "utf8"),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
const context = {
  exports: {},
  require: (id) => mocks[id] || loadModule(id),
  window: { location: { origin: "http://localhost:3000", pathname: "/trips" } },
};
vm.runInNewContext(compiled, context);
const panel = () => context.exports.AuthPanel({});
const html = () => renderToStaticMarkup(panel());
function buttons(node) {
  if (!node || typeof node !== "object") return [];
  return [
    ...(node.props?.onClick ? [node] : []),
    ...React.Children.toArray(node.props?.children).flatMap(buttons),
  ];
}

async function checkSessionRecovery() {
  const effects = [];
  const slots = [];
  let slot = 0;
  let session = { isLoading: true, isAuthenticated: false };
  let rejectRedirect = false;
  let alert;
  const redirects = [];
  const document = { cookie: "auth0.test-client.is.authenticated=true" };
  const context = {
    exports: {},
    document,
    window: {
      location: { pathname: "/trips/7", search: "?day=2", hash: "#itinerary" },
    },
    process: {
      env: {
        NEXT_PUBLIC_AUTH0_DOMAIN: "example.auth0.com",
        NEXT_PUBLIC_AUTH0_CLIENT_ID: "test-client",
        NEXT_PUBLIC_AUTH0_AUDIENCE: "test-api",
      },
    },
    require: (id) =>
      ({
        react: {
          ...React,
          useState: (initial) => {
            const index = slot++;
            if (!(index in slots))
              slots[index] =
                typeof initial === "function" ? initial() : initial;
            return [
              slots[index],
              (value) => {
                slots[index] = value;
              },
            ];
          },
          useRef: (initial) => (slots[slot++] ??= { current: initial }),
          useEffect: (effect) => effects.push(effect),
        },
        "@auth0/auth0-react": {
          Auth0Provider: ({ children }) => children,
          useAuth0: () => ({
            ...session,
            loginWithRedirect: async (options) => {
              redirects.push(options);
              if (rejectRedirect) throw new Error("Network unavailable");
            },
          }),
        },
        "@tanstack/react-query": {
          QueryClient: class {},
          QueryClientProvider: ({ children }) => children,
        },
        "next/navigation": { useRouter: () => ({ replace() {} }) },
      })[id] || loadModule(id),
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/app/providers.tsx", "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    context,
  );
  function render(node) {
    if (!node || typeof node !== "object") return;
    if (typeof node.type === "function") render(node.type(node.props));
    else {
      if (node.props?.role === "alert") alert = node.props.children;
      React.Children.forEach(node.props?.children, render);
    }
  }
  async function update(next) {
    session = next;
    slot = 0;
    render(context.exports.Providers({ children: "Trip content" }));
    for (const effect of effects.splice(0)) effect();
    await Promise.resolve();
  }
  await update(session);
  assert.equal(redirects.length, 0, "Wait for Auth0's initial session check");
  // The SDK clears its cookie when iframe authentication fails with login_required.
  document.cookie = "";
  await update({ isLoading: false, isAuthenticated: false });
  assert.equal(
    redirects.length,
    1,
    "A reload with an existing session must recover when silent authentication fails",
  );
  assert.equal(redirects[0].appState.returnTo, "/trips/7?day=2#itinerary");
  await update({ isLoading: false, isAuthenticated: false });
  assert.equal(
    redirects.length,
    1,
    "Do not repeatedly redirect during rerenders",
  );
  for (const [cookie, state] of [
    ["", { isLoading: false, isAuthenticated: false }],
    [
      "auth0.other-client.is.authenticated=true",
      { isLoading: false, isAuthenticated: false },
    ],
    [
      "auth0.test-client.is.authenticated=true",
      { isLoading: false, isAuthenticated: true },
    ],
    [
      "auth0.test-client.is.authenticated=true",
      {
        isLoading: false,
        isAuthenticated: false,
        error: new Error("Callback failed"),
      },
    ],
  ]) {
    slots.length = 0;
    redirects.length = 0;
    document.cookie = cookie;
    await update(state);
    assert.equal(
      redirects.length,
      0,
      "Leave visitors, restored sessions, and callback errors alone",
    );
    await update({ isLoading: false, isAuthenticated: false });
    assert.equal(
      redirects.length,
      0,
      "Logging out or rerendering must not start recovery",
    );
  }
  slots.length = 0;
  redirects.length = 0;
  document.cookie = "auth0.test-client.is.authenticated=true";
  rejectRedirect = true;
  await update({ isLoading: false, isAuthenticated: false });
  await update({ isLoading: false, isAuthenticated: false });
  assert.match(alert, /Unable to restore your session.*Log in/);
  assert.equal(
    redirects.length,
    1,
    "A failed redirect must offer manual login without looping",
  );

  slots.length = 0;
  redirects.length = 0;
  delete context.document;
  await update({ isLoading: false, isAuthenticated: false });
  assert.equal(
    redirects.length,
    0,
    "Server rendering must work without browser APIs",
  );
}

(async () => {
  await checkSessionRecovery();
  auth = { isLoading: true };
  assert.match(html(), /Checking session/);
  auth = { isAuthenticated: false };
  assert.match(html(), /Log in/);
  assert.match(html(), /Sign up/);
  const loginButtons = buttons(panel());
  await loginButtons[0].props.onClick();
  await loginButtons[1].props.onClick();
  assert.equal(calls[0].authorizationParams, undefined);
  assert.equal(calls[0].appState.returnTo, "/trips");
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
  const mobileHtml = renderToStaticMarkup(
    context.exports.AuthPanel({ mobile: true }),
  );
  assert.match(mobileHtml, /aria-label="Mobile navigation"/);
  assert.match(
    mobileHtml,
    /<a(?=[^>]*href="\/trips")(?=[^>]*aria-current="page")/,
  );
  assert.match(mobileHtml, /href="\/invitations\/accept"/);
  assert.match(mobileHtml, />Trips<|>Trips<\//);
  assert.match(mobileHtml, />Invitations<|>Invitations<\//);
  assert.match(mobileHtml, />Account<\//);
  for (const [path, activeHref] of [
    ["/trips/new", "/trips"],
    ["/trips/7", "/trips"],
    ["/invitations/accept", "/invitations/accept"],
  ]) {
    pathname = path;
    const mobile = renderToStaticMarkup(
      context.exports.AuthPanel({ mobile: true }),
    );
    assert.equal(
      (mobile.match(/aria-current="page"/g) || []).length,
      1,
      "Only the current destination is selected",
    );
    assert.match(
      mobile,
      new RegExp(`<a(?=[^>]*href="${activeHref}")(?=[^>]*aria-current="page")`),
    );
    assert.match(
      mobile,
      /<button type="button" class="mobile-nav-item"/,
      "Account remains a sheet trigger rather than a navigation link",
    );
  }
  auth = { isLoading: true };
  assert.equal(context.exports.AuthPanel({ sidebar: true }), null);
  assert.equal(context.exports.AuthPanel({ mobile: true }), null);
  auth = { isAuthenticated: false };
  assert.equal(context.exports.AuthPanel({ sidebar: true }), null);
  assert.equal(context.exports.AuthPanel({ mobile: true }), null);
  auth = { isAuthenticated: true };
  pathname = "/invitations/accept";
  const sidebarHtml = renderToStaticMarkup(
    context.exports.AuthPanel({ sidebar: true }),
  );
  assert.match(sidebarHtml, /aria-label="Workspace navigation"/);
  assert.match(sidebarHtml, /Create a trip/);
  assert.match(
    sidebarHtml,
    /<a(?=[^>]*href="\/invitations\/accept")(?=[^>]*aria-current="page")/,
  );
  assert.match(sidebarHtml, /Your account/);
  console.log("Auth states and login/logout actions passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
