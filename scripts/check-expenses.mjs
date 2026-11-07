import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => mocks[id] || require(id),
    ...globals,
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const money = load("src/lib/money.ts");
assert.equal(money.parseMoney("123.45", 2), "12345");
assert.equal(money.parseMoney("001.2", 2), "120");
assert.equal(money.parseMoney("1", 0), "1");
// Amount fields display thousands separators, so people type them too.
assert.equal(money.parseMoney("1,000", 2), "100000");
assert.equal(money.parseMoney("1,000,000.50", 2), "100000050");
assert.equal(money.parseMoney("1,000", 0), "1000");
assert.equal(
  money.parseMoney("92233720368547758.07", 2),
  "9223372036854775807",
);
for (const value of [
  "-1",
  "1e3",
  "1,50",
  "12,34,567",
  "1000,000",
  ",100",
  "1,,000",
  "1,000,",
  "NaN",
  "Infinity",
  "",
  ".5",
  "92233720368547758.08",
])
  assert.throws(() => money.parseMoney(value, 2));
assert.throws(() => money.parseMoney("1.1", 0));
assert.throws(() => money.parseMoney("1.001", 2));
assert.equal(money.moneyInput("-1", 2), "-0.01");
assert.equal(
  money.formatMoney("9223372036854775807", { code: "PHP", decimals: 2 }),
  "PHP 92,233,720,368,547,758.07",
);
assert.equal(
  money.formatMoney("-1", { code: "PHP", decimals: 2 }),
  "PHP -0.01",
);
assert.equal(
  money.formatMoney("1000", { code: "JPY", decimals: 0 }),
  "JPY 1,000",
);
assert.equal(
  JSON.stringify(money.equalShares("1", [3, 1, 2])),
  JSON.stringify([
    { user_id: 1, amount_minor: "1" },
    { user_id: 2, amount_minor: "0" },
    { user_id: 3, amount_minor: "0" },
  ]),
);
assert.throws(() => money.equalShares("0", [1]));
assert.throws(() => money.equalShares("1", []));

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
let response, failure, delay;
const calls = [];
const client = {
  invalidateQueries: async (options) => calls.push(["invalidate", options]),
};
const hookReact = {
  ...React,
  useRef: (value) => ({ current: value }),
  useState: (value) => [value, () => {}],
  useCallback: (fn) => fn,
};
const apiMock = {
  ApiError,
  useApi: () => async (path, init) => {
    calls.push([path, init]);
    if (delay) await delay;
    if (failure) throw failure;
    return response;
  },
};
const ledger = load("src/lib/expenses.ts", {
  react: hookReact,
  "@/lib/api": apiMock,
  "@tanstack/react-query": { useQueryClient: () => client },
  sonner: { toast: { success: (message) => calls.push(["toast", message]) } },
});
const input = {
  description: " Dinner ",
  currency: "PHP",
  amount_minor: "101",
  incurred_on: "2026-09-01",
  payer_user_id: 1,
  split_mode: "equal",
  shares: [
    { user_id: 1, amount_minor: "51" },
    { user_id: 2, amount_minor: "50" },
  ],
  created_by_user_id: 999,
};
assert.equal(ledger.canManageExpense("member", 1, 1), true);
assert.equal(ledger.canManageExpense("member", 1, 2), false);
assert.equal(ledger.canManageExpense("viewer", 1, 1), false);
assert.equal(ledger.canManageExpense("editor", 1, 2), true);
const sanitized = ledger.expenseInput(input);
assert.equal(sanitized.created_by_user_id, undefined);
assert.equal(sanitized.shares[0].amount_minor, undefined);
assert.equal(sanitized.description, "Dinner");
let permissionFailures = 0;
const api = ledger.useExpensesApi(7, () => permissionFailures++);
response = { ...sanitized, id: 4, version: 1 };
await api.saveExpense(input, undefined, "stable-key");
assert.equal(calls[0][1].headers["Idempotency-Key"], "stable-key");
assert.equal(JSON.parse(calls[0][1].body).created_by_user_id, undefined);
assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), [
  "invalidate",
  { queryKey: ["trip", 7, "ledger"] },
]);
calls.length = 0;
await api.list("expenses", "PHP", 50);
assert.equal(
  calls[0][0],
  "/api/v1/trips/7/expenses?limit=50&offset=50&currency=PHP",
);
calls.length = 0;
failure = new ApiError(409, "Changed");
await assert.rejects(
  api.saveExpense({ ...input, version: 1 }, response),
  (error) => error.status === 409,
);
assert.equal(
  permissionFailures,
  0,
  "A stale record is not a trip permission failure",
);
failure = new ApiError(403, "Forbidden");
await assert.rejects(api.saveExpense(input), (error) => error.status === 403);
assert.equal(permissionFailures, 1);
failure = new Error("Connection lost");
calls.length = 0;
await assert.rejects(
  api.saveExpense(input, undefined, "stable-key"),
  (error) =>
    error instanceof ApiError &&
    /Saving may have completed/.test(error.message),
  "TripError must be able to show the duplicate-record warning",
);
failure = null;
await api.saveExpense(input, undefined, "stable-key");
const attempts = calls.filter(([path]) => path.endsWith?.("/expenses"));
assert.equal(attempts.length, 2);
assert.equal(
  attempts[0][1].headers["Idempotency-Key"],
  attempts[1][1].headers["Idempotency-Key"],
);
calls.length = 0;
let release;
delay = new Promise((resolve) => (release = resolve));
const first = api.saveExpense(input, undefined, "one");
assert.equal(await api.saveExpense(input, undefined, "one"), undefined);
release();
await first;
delay = null;
assert.equal(calls.filter(([path]) => path.endsWith?.("/expenses")).length, 1);
calls.length = 0;
response = undefined;
await api.remove("expenses", { id: 4, version: 3 });
assert.equal(calls[0][0], "/api/v1/trips/7/expenses/4?version=3");

const activity = load("src/lib/activity-expenses.ts");
const shares = [1, 2, 3, 4, 5].map((user_id) => ({
  user_id,
  amount_minor: "80000",
}));
const allocations = activity.allocatePayment("100000", 1, shares);
assert.equal(
  JSON.stringify(allocations),
  JSON.stringify([
    { user_id: 1, amount_minor: "80000" },
    ...[2, 3, 4, 5].map((user_id) => ({ user_id, amount_minor: "5000" })),
  ]),
);
assert.throws(() => activity.allocatePayment("400001", 1, shares));
assert.equal(
  activity.allocatePayment("1", 99, [
    { user_id: 3, amount_minor: "2" },
    { user_id: 1, amount_minor: "2" },
  ])[0].user_id,
  1,
);
const resort = { id: 1, title: "Resort" };
const inn = {
  id: 1,
  trip_id: 7,
  activity_id: 1,
  activity_name: "Resort",
  description: "Inn",
  currency: "PHP",
  amount_minor: "400000",
  incurred_on: "2026-11-01",
  payer_user_id: 0,
  split_mode: "equal",
  shares,
  version: 1,
  created_by_user_id: 1,
};
const entrance = {
  ...inn,
  id: 2,
  description: "Entrance",
  amount_minor: "200000",
  shares: shares.map((s) => ({ ...s, amount_minor: "40000" })),
};
const food = {
  ...inn,
  id: 3,
  description: "Food",
  amount_minor: "35000",
  shares: [{ user_id: 3, amount_minor: "35000" }],
};
const data = {
  expenses: [inn, entrance, food],
  payments: [
    {
      id: 1,
      expense_id: 1,
      payer_user_id: 1,
      currency: "PHP",
      amount_minor: "100000",
      allocations,
    },
    {
      id: 2,
      expense_id: 3,
      payer_user_id: 1,
      currency: "PHP",
      amount_minor: "35000",
      allocations: food.shares,
    },
  ],
  loans: [],
  settlements: [],
  people: [],
  debts: [
    {
      payment_id: 1,
      activity_id: 1,
      currency: "PHP",
      from_user_id: 3,
      to_user_id: 1,
      amount_minor: "5000",
    },
    {
      payment_id: 2,
      activity_id: 1,
      currency: "PHP",
      from_user_id: 3,
      to_user_id: 1,
      amount_minor: "35000",
    },
  ],
};
let total = activity.personalTotals(data, 3, "PHP");
assert.equal(total.cost, 155000n);
assert.equal(total.business, 115000n);
assert.equal(total.owe, 40000n);
assert.equal(total.remaining, 155000n);
const after = {
  ...data,
  debts: [{ ...data.debts[0], amount_minor: "2500" }, data.debts[1]],
};
assert.equal(activity.personalTotals(after, 3, "PHP").remaining, 152500n);
assert.equal(activity.personalTotals(after, 3, "PHP").cost, 155000n);
const cash = {
  ...data,
  debts: [
    ...data.debts,
    {
      loan_id: 1,
      activity_id: 1,
      currency: "PHP",
      from_user_id: 3,
      to_user_id: 1,
      amount_minor: "10000",
    },
  ],
};
assert.equal(activity.personalTotals(cash, 3, "PHP").cost, 155000n);
assert.equal(activity.personalTotals(cash, 3, "PHP").remaining, 165000n);
assert.equal(activity.personalTotals(data, 3, "JPY").cost, 0n);
const adjusted = {
  ...inn,
  shares: shares.map((s) => ({ ...s, amount_minor: "70000" })),
  amount_minor: "350000",
};
assert.equal(activity.uncovered(adjusted, data)[0].amount_minor, "-10000");

let states = [],
  index = 0,
  refs = [],
  refIndex = 0;
const formReact = {
  ...React,
  useEffect() {},
  useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
  useState(initial) {
    const slot = index++;
    if (!(slot in states))
      states[slot] = typeof initial === "function" ? initial() : initial;
    return [
      states[slot],
      (v) => {
        states[slot] = typeof v === "function" ? v(states[slot]) : v;
      },
    ];
  },
};
const wrap = (tag) =>
  function Wrapper({ children, ...props }) {
    return React.createElement(tag, props, children);
  };
const ExpenseSelect = (props) => React.createElement("div", null, props.label);
// The real component hides non-ApiError text, so user-written messages must be ApiErrors.
const { TripError } = load("src/components/trips/trip-states.tsx", {
  "next/link": { default: wrap("a") },
  "@/lib/api": apiMock,
  "@/components/ui/alert": { Alert: wrap("div"), AlertDescription: wrap("p") },
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/skeleton": { Skeleton: wrap("div") },
});
const formModule = load("src/components/trips/activity-expense-form.tsx", {
  react: formReact,
  "@/lib/api": apiMock,
  "@/lib/activity-expenses": activity,
  "@/lib/expenses": ledger,
  "@/lib/money": money,
  "./expense-forms": { ExpenseSelect },
  "./trip-states": { TripError },
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/input": { Input: wrap("input") },
  "@/components/ui/label": { Label: wrap("label") },
});
function nodes(el) {
  if (!React.isValidElement(el)) return [];
  return [el, ...React.Children.toArray(el.props.children).flatMap(nodes)];
}
function render(component, props) {
  index = 0;
  refIndex = 0;
  return component(props);
}
const people = [1, 2, 3, 4, 5].map((user_id) => ({
  user_id,
  display_name: `Person ${user_id}`,
  email: null,
}));
const currencies = [
  { code: "PHP", decimals: 2 },
  { code: "JPY", decimals: 0 },
];
let saved,
  fail = false;
const props = {
  editor: { type: "cost" },
  activityID: "1",
  activities: [resort],
  people,
  currencies,
  userID: 1,
  zone: "Asia/Manila",
  ledger: data,
  pending: false,
  error: null,
  onDirty() {},
  onCancel() {},
  async onSave(input) {
    if (fail) throw new ApiError(503, "Offline");
    saved = input;
  },
};
const find = (tree, id) => nodes(tree).find((n) => n.props.id === id);
let tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-description").props.onChange({
  target: { value: "Entrance" },
});
find(tree, "cost-amount").props.onChange({ target: { value: "400" } });
find(tree, "cost-basis-per_person").props.onChange();
tree = render(formModule.ActivityExpenseForm, props);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.amount_minor, "200000");
assert.equal(saved.payer_user_id, 0);
assert.equal(saved.activity_id, 1);
assert.equal(saved.shares.length, 5);
fail = true;
await tree.props.onSubmit({ preventDefault() {} });
tree = render(formModule.ActivityExpenseForm, props);
assert.equal(find(tree, "cost-amount").props.value, "400");
assert.match(renderToStaticMarkup(tree), /Retry this draft/);
fail = false;
states = [];
saved = undefined;
const paymentProps = {
  ...props,
  editor: { type: "payment", cost: inn },
  ledger: { ...data, payments: [] },
};
tree = render(formModule.ActivityExpenseForm, paymentProps);
find(tree, "cost-amount").props.onChange({ target: { value: "1000" } });
tree = render(formModule.ActivityExpenseForm, paymentProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(JSON.stringify(saved.allocations), JSON.stringify(allocations));
states = [];
saved = undefined;
const editProps = { ...props, editor: { type: "cost", cost: inn } };
tree = render(formModule.ActivityExpenseForm, editProps);
find(tree, "cost-amount").props.onChange({ target: { value: "3500" } });
tree = render(formModule.ActivityExpenseForm, editProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved, undefined, "Paid cost edits need a review");
tree = render(formModule.ActivityExpenseForm, editProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.amount_minor, "350000");
assert.equal(saved.version, 1);

// Local checks stay readable; unexpected failures never show their raw text.
states = [];
saved = undefined;
const formMarkup = (formProps) =>
  renderToStaticMarkup(render(formModule.ActivityExpenseForm, formProps));
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-amount").props.onChange({ target: { value: "0" } });
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-mode-exact").props.onChange();
assert.match(formMarkup(props), /Enter a positive amount/);
tree = render(formModule.ActivityExpenseForm, props);
await tree.props.onSubmit({ preventDefault() {} });
assert.match(formMarkup(props), /Enter a positive amount/);
assert.doesNotMatch(formMarkup(props), /Something went wrong/);
assert.equal(saved, undefined);
states = [];
const crashingProps = {
  ...props,
  async onSave() {
    throw new TypeError("Failed to fetch");
  },
};
tree = render(formModule.ActivityExpenseForm, crashingProps);
find(tree, "cost-description").props.onChange({
  target: { value: "Entrance" },
});
find(tree, "cost-amount").props.onChange({ target: { value: "400" } });
tree = render(formModule.ActivityExpenseForm, crashingProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.doesNotMatch(formMarkup(crashingProps), /Failed to fetch/);

states = [];
refs = [];
const enabled = [];
let viewData = data;
const viewApi = { ...api, ledger: async () => data };
const CostEditor = () => null;
const PaymentWorkspace = () => null;
const PersonalPayments = () => null;
const view = load(
  "src/components/trips/expenses.tsx",
  {
    react: formReact,
    "next/link": {
      __esModule: true,
      default: ({ scroll, children, ...props }) => {
        void scroll;
        return React.createElement("a", props, children);
      },
    },
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@tanstack/react-query": {
      useQuery(options) {
        enabled.push(options.enabled);
        return {
          data:
            options.queryKey[0] === "expense-currencies"
              ? currencies
              : options.queryKey[2] === "activities"
                ? [resort]
                : viewData,
          isPending: false,
          error: null,
        };
      },
    },
    "@/lib/api": apiMock,
    "@/lib/expenses": { ...ledger, useExpensesApi: () => viewApi },
    "@/lib/activity-expenses": activity,
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "./trip-dialog": {
      TripDialog: ({ open, children }) => (open ? children : null),
    },
    "./trip-states": { TripError },
    "./expense-forms": { ExpenseSelect },
    "./activity-expense-form": formModule,
    "./expense-cost-editor": { ExpenseCostEditor: CostEditor },
    "./expense-payment-workspace": {
      ExpensePaymentWorkspace: PaymentWorkspace,
    },
    "./personal-payments": { PersonalPayments },
  },
  {
    document: { activeElement: null, querySelector: () => null },
    window: {
      confirm: () => true,
      prompt: () => "Repayment entered by mistake",
    },
    crypto: { randomUUID: () => "test-key" },
  },
);
const viewProps = {
  active: false,
  trip: { id: 7, time_zone: "Asia/Manila" },
  participants: people,
  current: { user_id: 3, role: "member" },
  onFailure() {},
};
render(view.Expenses, viewProps);
assert.ok(
  enabled.every((e) => !e),
  "Inactive expense queries pause",
);
states = [];
enabled.length = 0;
tree = render(view.Expenses, { ...viewProps, active: true });
const html = renderToStaticMarkup(tree);
assert.match(html, /1550|1,550/);
assert.match(html, /My share/);
assert.match(html, /View activity/);
assert.doesNotMatch(html, />Add cost</);
assert.doesNotMatch(
  html,
  /Paid for someone|Lent money|Historical repayments need allocation/,
);
assert.ok(enabled.every(Boolean));
states = [];
tree = render(view.Expenses, {
  ...viewProps,
  active: true,
  current: { user_id: 3, role: "viewer" },
});

assert.doesNotMatch(renderToStaticMarkup(tree), /Paid for someone/);
states = [];
refs = [];
viewData = {
  ...data,
  expenses: [{ ...inn, currency: "JPY" }],
  payments: [],
  loans: [],
  settlements: [],
  debts: [],
};
tree = render(view.Expenses, { ...viewProps, active: true });
assert.match(renderToStaticMarkup(tree), /JPY/);
viewData = data;
states = [];
refs = [];
const ownerProps = {
  ...viewProps,
  activityID: "1",
  activityTitle: "Resort",
  active: true,
  current: { user_id: 3, role: "owner" },
};
tree = render(view.ActivityExpenses, ownerProps);
nodes(tree)
  .find((n) => n.props.children === "Add expense")
  .props.onClick();
tree = render(view.ActivityExpenses, ownerProps);
let editor = nodes(tree).find((n) => n.type === CostEditor);
const submittedKeys = [];
viewApi.saveExpense = async (_input, _record, key) => {
  submittedKeys.push(key);
  return undefined;
};
await editor.props.onSave(input);
tree = render(view.ActivityExpenses, ownerProps);
editor = nodes(tree).find((n) => n.type === CostEditor);
assert.ok(editor, "A duplicate-suppressed save must not close the draft");
viewApi.saveExpense = async (_input, _record, key) => {
  submittedKeys.push(key);
  return inn;
};
await editor.props.onSave(input);
assert.equal(submittedKeys[0], submittedKeys[1]);
tree = render(view.ActivityExpenses, ownerProps);
assert.ok(!nodes(tree).some((n) => n.type === CostEditor));
states = [];
tree = render(formModule.ActivityExpenseForm, {
  ...props,
  currentUserIDs: [1, 2],
});
assert.equal(
  nodes(tree).filter((n) => n.props.type === "checkbox" && n.props.checked)
    .length,
  2,
  "New costs must not select former travelers",
);
states = [];
tree = render(formModule.ActivityExpenseForm, {
  ...props,
  editor: { type: "cover" },
});
assert.equal(
  nodes(tree).filter((n) => n.props.type === "checkbox" && n.props.checked)
    .length,
  0,
  "Choose who was covered explicitly",
);

states = [];
tree = render(formModule.ActivityExpenseForm, { ...props, activityID: "" });
assert.equal(
  find(tree, "cost-activity").props.value,
  "",
  "Choose an activity explicitly when starting from All activities",
);
console.log(
  "Expense money, allocation, totals, forms, retry, review, permissions, and inactive-query checks passed.",
);

const reservationLedger = {
  ...data,
  expenses: [inn],
  loans: [],
  settlements: [],
  payments: [data.payments[0]],
  debts: allocations
    .filter((s) => s.user_id !== 1)
    .map((s) => ({
      payment_id: 1,
      activity_id: 1,
      currency: "PHP",
      from_user_id: s.user_id,
      to_user_id: 1,
      amount_minor: s.amount_minor,
    })),
};
let memberState = activity.memberPaymentState(inn, reservationLedger, 3);
assert.equal(memberState.business, 75000n);
assert.equal(memberState.remaining, 80000n);
assert.equal(memberState.paid, 0n);
assert.equal(
  activity.memberPaymentState(inn, reservationLedger, 1).receivable,
  20000n,
);
const beaPaid = {
  ...reservationLedger,
  payments: [
    ...reservationLedger.payments,
    {
      id: 10,
      expense_id: inn.id,
      payer_user_id: 3,
      currency: "PHP",
      amount_minor: "75000",
      allocations: [{ user_id: 3, amount_minor: "75000" }],
    },
  ],
};
memberState = activity.memberPaymentState(inn, beaPaid, 3);
assert.equal(memberState.paid, 75000n);
assert.equal(memberState.remaining, 5000n);
assert.equal(memberState.status, "Partially paid");
assert.equal(
  activity.memberPaymentState(
    inn,
    {
      ...beaPaid,
      debts: beaPaid.debts.map((d) =>
        d.from_user_id === 3 ? { ...d, amount_minor: "0" } : d,
      ),
    },
    3,
  ).status,
  "Paid",
);
assert.equal(
  activity.memberPaymentState(adjusted, reservationLedger, 1).credit,
  10000n,
);

states = [];
refs = [];
saved = undefined;
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-description").props.onChange({ target: { value: "Inn" } });
find(tree, "cost-amount").props.onChange({ target: { value: "4000" } });
find(tree, "planned-coverer").props.onChange("1");
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "planned-amount").props.onChange({ target: { value: "1000" } });
tree = render(formModule.ActivityExpenseForm, props);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.planned_coverer_user_id, 1);
assert.equal(saved.planned_cover_amount_minor, "100000");
assert.equal(
  saved.payer_user_id,
  0,
  "Planned coverage must not create a payment",
);
states = [];
refs = [];
saved = undefined;
const memberPaymentProps = {
  ...props,
  editor: { type: "payment", cost: inn, memberID: 3 },
  ledger: reservationLedger,
};
tree = render(formModule.ActivityExpenseForm, memberPaymentProps);
assert.equal(find(tree, "cost-amount").props.value, "750.00");
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.payer_user_id, 3);
assert.equal(
  JSON.stringify(saved.allocations),
  JSON.stringify([{ user_id: 3, amount_minor: "75000" }]),
);

viewData = reservationLedger;
states = [];
refs = [];
tree = render(view.ActivityExpenses, ownerProps);
nodes(tree)
  .find((n) => n.props.children === "View payments")
  .props.onClick({ currentTarget: null });
tree = render(view.ActivityExpenses, ownerProps);
assert.ok(
  nodes(tree).some((n) => n.type === PaymentWorkspace),
  "View payments opens a dedicated expense payment screen",
);
console.log(
  "Planned coverage, member-specific payment, partial settlement and recipient-only actions passed.",
);

states = [];
refs = [];
saved = undefined;
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-description").props.onChange({ target: { value: "Inn" } });
find(tree, "cost-amount").props.onChange({ target: { value: "4000" } });
tree = render(formModule.ActivityExpenseForm, props);
find(tree, "cost-mode-exact").props.onChange();
tree = render(formModule.ActivityExpenseForm, props);
for (const [i, value] of ["1000", "900", "800", "700", "600"].entries())
  nodes(tree)
    .find((n) => n.props["aria-label"] === `Share for Person ${i + 1}`)
    .props.onChange({ target: { value } });
tree = render(formModule.ActivityExpenseForm, props);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.split_mode, "exact");
assert.equal(
  JSON.stringify(saved.shares.map((s) => s.amount_minor)),
  JSON.stringify(["100000", "90000", "80000", "70000", "60000"]),
);
assert.equal(
  find(tree, "cost-activity").props.value,
  "1",
  "Activity stays available in optional details",
);
console.log(
  "Visible split choices preserve custom shares and activity context.",
);

// The approved form keeps custom splitting in a separate step and preserves failed drafts.
const confirms = [];
let confirmAnswer = true;
const approved = load(
  "src/components/trips/expense-cost-editor.tsx",
  {
    "./expense-fields": { ExpensePriceField: wrap("input") },
    react: { ...formReact, useId: () => "expense" },
    "@/lib/api": apiMock,
    "@/lib/expenses": ledger,
    "@/lib/memberships": {
      participantInitials: (person) => `I${person.user_id}`,
    },
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/input": { Input: wrap("input") },
    "@/components/ui/label": { Label: wrap("label") },
    "@/components/ui/select": {
      ...Object.fromEntries(
        ["Select", "SelectItem", "SelectTrigger", "SelectValue"].map((n) => [
          n,
          wrap("div"),
        ]),
      ),
      SelectContent: ({ children }) => children,
    },
    "./trip-dialog": { TripDialog: ({ children }) => children },
    "./expense-forms": { ExpenseSelect },
    "./trip-states": { TripError },
  },
  {
    window: {
      confirm(message) {
        confirms.push(message);
        return confirmAnswer;
      },
    },
    requestAnimationFrame: (callback) => callback(),
  },
);
const approvedProps = {
  activity: { id: 1, title: "Resort day" },
  tripID: 7,
  people,
  currencies,
  zone: "Asia/Manila",
  onSave: props.onSave,
  onBack() {},
};
const costTree = () => render(approved.ExpenseCostEditor, approvedProps);
const submitCost = () =>
  nodes(costTree())
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {}, stopPropagation() {} });
states = [];
refs = [];
const costMarkup = renderToStaticMarkup(costTree());
assert.match(costMarkup, /Group price/);
assert.doesNotMatch(costMarkup, /Group price ·/);
const membersControl = () => costTree().props.headerAction;
assert.equal(
  membersControl().props["aria-label"],
  "Who is included? All 5 members",
  "The initials announce their question and current value",
);
const initialsMarkup = renderToStaticMarkup(membersControl());
assert.match(initialsMarkup, /I3/);
assert.doesNotMatch(initialsMarkup, /I4/);
assert.match(initialsMarkup, /\+2/);
assert.equal(
  render(approved.ExpenseCostEditor, { ...approvedProps, pending: true }).props
    .headerAction.props.disabled,
  true,
  "The initials sit outside the disabled fieldset, so they block themselves",
);
membersControl().props.onClick();
assert.equal(costTree().props.title, "Who is included?");
assert.ok(!membersControl(), "Only the cost step shows the initials");
states = [];
refs = [];
assert.equal(
  find(costTree(), "expense-coverer").props["aria-labelledby"],
  "expense-coverer-label expense-coverer",
  "Step controls announce their question and current value",
);
for (const id of ["expense-name", "expense-price"])
  assert.equal(
    nodes(costTree()).find((n) => n.props.htmlFor === id).props.className,
    "field-required",
    "Required expense fields are marked",
  );
states = [];
refs = [];
assert.equal(
  render(approved.ExpenseCostEditor, {
    ...approvedProps,
    people: people.slice(0, 1),
  }).props.headerAction.props["aria-label"],
  "Who is included? 1 member",
);
states = [];
refs = [];
saved = undefined;
find(costTree(), "expense-name").props.onChange({ target: { value: "Inn" } });
find(costTree(), "expense-price").props.onChange({ target: { value: "4000" } });
nodes(costTree())
  .find((n) => n.props.label === "Split")
  .props.onChange("exact");
assert.equal(costTree().props.title, "Custom split");
for (const [i, value] of ["1000", "900", "800", "700", "600"].entries())
  find(costTree(), `expense-share-${i + 1}`).props.onChange({
    target: { value },
  });
await submitCost();
assert.equal(costTree().props.title, "Add expense");
fail = true;
await submitCost();
assert.equal(find(costTree(), "expense-price").props.value, "4000");
assert.match(renderToStaticMarkup(costTree()), /Offline/);
fail = false;
await submitCost();
assert.equal(saved.amount_minor, "400000");
assert.equal(saved.payer_user_id, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(saved.shares.map((s) => s.amount_minor))),
  ["100000", "90000", "80000", "70000", "60000"],
);
assert.equal(saved.activity_id, 1);
assert.equal(
  money.expenseMoney("400000", { code: "PHP", decimals: 2 }),
  "₱4,000",
);
console.log(
  "Approved expense/custom-split steps, planning-only save, exact shares and failed-draft recovery passed.",
);

// Errors sit below the step controls, so a blocked step must reach its message.
// The real TripError only shows ApiError text.
states = [];
refs = [];
costTree();
let focusedErrors = 0;
for (const ref of refs) ref.current = { focus: () => focusedErrors++ };
const stepError = () =>
  nodes(costTree()).find((n) => n.type === TripError)?.props.error;
nodes(costTree())
  .find((n) => n.props.label === "Split")
  .props.onChange("exact");
assert.equal(costTree().props.title, "Add expense");
assert.ok(stepError() instanceof ApiError);
assert.match(stepError().message, /Enter a valid price/);
assert.equal(focusedErrors, 1);
find(costTree(), "expense-coverer").props.onClick();
assert.ok(stepError() instanceof ApiError);
assert.match(stepError().message, /Enter a valid price and split first/);
assert.equal(focusedErrors, 2);
find(costTree(), "expense-price").props.onChange({ target: { value: "abc" } });
await submitCost();
assert.ok(stepError() instanceof ApiError, "Local save checks stay readable");
assert.match(stepError().message, /digits and a decimal point/);
assert.equal(focusedErrors, 3);
console.log("Blocked expense steps show and focus their own message.");

// Custom split journey: five people share ₱4,000, so an even split is ₱800 each.
let editorsClosed = 0;
approvedProps.onBack = () => editorsClosed++;
const startExpense = (price = "4000") => {
  find(costTree(), "expense-name").props.onChange({ target: { value: "Inn" } });
  find(costTree(), "expense-price").props.onChange({
    target: { value: price },
  });
};
const openSplit = () =>
  nodes(costTree())
    .find((n) => n.props.label === "Split")
    .props.onChange("exact");
const startSplit = () => {
  startExpense();
  openSplit();
};
const typeShare = (id, value) =>
  find(costTree(), `expense-share-${id}`).props.onChange({ target: { value } });
const shareValues = () =>
  JSON.stringify(
    [1, 2, 3, 4, 5].map(
      (id) => find(costTree(), `expense-share-${id}`).props.value,
    ),
  );
const typeAllShares = (values) =>
  values.forEach((value, i) => typeShare(i + 1, value));
const dismiss = () => costTree().props.onOpenChange(false);
const stepTitle = () => costTree().props.title;
const footerNodes = () => nodes(costTree().props.footer);
const footerText = () => renderToStaticMarkup(costTree().props.footer);
const splitStatus = () =>
  footerNodes().find((n) => "data-balanced" in n.props).props["data-balanced"];
const balanceButton = () =>
  footerNodes().find((n) =>
    /^(Split|Give) the remaining/.test(n.props.children),
  );
const perPersonRadio = () =>
  nodes(costTree()).find(
    (n) => n.props.type === "radio" && n.props.name === "expense-basis",
  );
const memberBoxes = () =>
  nodes(costTree()).filter((n) => n.props.type === "checkbox");
const changeSplitButton = () =>
  nodes(costTree()).find((n) => n.props.children === "Change custom split");
const savedShares = () =>
  JSON.stringify(saved.shares.map((s) => s.amount_minor));

const splitFailures = [];
async function splitScenario(name, run) {
  states = [];
  refs = [];
  confirms.length = 0;
  confirmAnswer = true;
  editorsClosed = 0;
  saved = undefined;
  try {
    await run();
  } catch (cause) {
    splitFailures.push(`${name}: ${cause.message}`);
  }
}

await splitScenario("Back from an untouched split", () => {
  startSplit();
  assert.equal(costTree().props.backLabel, "Back to expense");
  dismiss();
  assert.equal(stepTitle(), "Add expense");
  assert.equal(editorsClosed, 0, "Back must not close the whole expense");
  assert.equal(confirms.length, 0, "Nothing typed, so nothing to confirm");
  assert.equal(find(costTree(), "expense-name").props.value, "Inn");
  assert.equal(find(costTree(), "expense-price").props.value, "4000");
});
await splitScenario("Back after typing asks first", () => {
  startSplit();
  typeShare(1, "2000");
  confirmAnswer = false;
  dismiss();
  assert.equal(stepTitle(), "Custom split");
  assert.equal(find(costTree(), "expense-share-1").props.value, "2000");
  assert.equal(confirms.length, 1);
  confirmAnswer = true;
  dismiss();
  assert.equal(stepTitle(), "Add expense");
  assert.equal(editorsClosed, 0);
  openSplit();
  assert.equal(
    shareValues(),
    JSON.stringify(["800.00", "800.00", "800.00", "800.00", "800.00"]),
  );
});
await splitScenario("Abandoned edits keep the applied split", async () => {
  startSplit();
  typeAllShares(["1000", "900", "800", "700", "600"]);
  await submitCost();
  assert.equal(stepTitle(), "Add expense");
  changeSplitButton().props.onClick();
  typeShare(1, "1");
  dismiss();
  assert.equal(stepTitle(), "Add expense");
  await submitCost();
  assert.equal(saved.split_mode, "exact");
  assert.equal(
    savedShares(),
    JSON.stringify(["100000", "90000", "80000", "70000", "60000"]),
  );
});
await splitScenario("Per-person holds until the split is used", async () => {
  startExpense("400");
  perPersonRadio().props.onChange();
  openSplit();
  assert.match(costTree().props.description, /₱2,000 total/);
  dismiss();
  assert.equal(perPersonRadio().props.checked, true);
  assert.equal(find(costTree(), "expense-price").props.value, "400");
  openSplit();
  await submitCost();
  assert.equal(stepTitle(), "Add expense");
  assert.equal(perPersonRadio().props.checked, false);
  assert.equal(find(costTree(), "expense-price").props.value, "2000.00");
  await submitCost();
  assert.equal(saved.amount_basis, "group");
  assert.equal(saved.amount_minor, "200000");
});
await splitScenario("Running total survives bad fields", () => {
  startSplit();
  typeShare(1, "");
  assert.match(footerText(), /₱800 left to assign/);
  assert.match(footerText(), /₱3,200 of ₱4,000 assigned/);
  assert.equal(find(costTree(), "expense-share-1-error"), undefined);
  assert.equal(
    find(costTree(), "expense-share-1").props["aria-invalid"],
    undefined,
  );
  typeShare(1, "abc");
  assert.match(footerText(), /₱800 left to assign/);
  assert.equal(find(costTree(), "expense-share-1").props["aria-invalid"], true);
  assert.equal(
    find(costTree(), "expense-share-1").props["aria-describedby"],
    "expense-share-1-error",
  );
  assert.match(
    renderToStaticMarkup(find(costTree(), "expense-share-1-error")),
    /digits and a decimal point/,
  );
  typeShare(1, "1,000");
  assert.match(footerText(), /₱200 over/);
  assert.equal(find(costTree(), "expense-share-1-error"), undefined);
});
await splitScenario("Status says how far off the split is", () => {
  startSplit();
  assert.match(footerText(), /Matches the total/);
  assert.match(footerText(), /₱4,000 of ₱4,000 assigned/);
  assert.equal(splitStatus(), true);
  typeShare(1, "700");
  assert.match(footerText(), /₱100 left to assign/);
  assert.equal(splitStatus(), false);
  typeShare(1, "900");
  assert.match(footerText(), /₱100 over/);
  assert.equal(splitStatus(), false);
});
await splitScenario("A blocked split names the fix", async () => {
  startSplit();
  for (const [value, message] of [
    ["700", /₱100 is still left to assign/],
    ["900", /₱100 over/],
    ["", /Add an amount for Person 1/],
    ["abc", /Person 1.*digits and a decimal point/],
  ]) {
    typeShare(1, value);
    await submitCost();
    assert.equal(stepTitle(), "Custom split");
    assert.ok(stepError() instanceof ApiError);
    assert.match(stepError().message, message);
  }
});
await splitScenario("One tap splits the rest", () => {
  startSplit();
  assert.ok(!balanceButton(), "Nothing to balance before an edit");
  typeShare(1, "999.99");
  assert.equal(
    balanceButton().props.children,
    "Split the remaining ₱3,000.01 between the other 4",
  );
  let focused = 0;
  footerNodes().find((n) => n.props.type === "submit").props.ref.current = {
    focus: () => focused++,
  };
  balanceButton().props.onClick();
  assert.equal(
    shareValues(),
    JSON.stringify(["999.99", "750.01", "750.00", "750.00", "750.00"]),
  );
  assert.match(footerText(), /Matches the total/);
  assert.ok(!balanceButton(), "A balanced split has nothing left to balance");
  assert.equal(focused, 1, "Focus must not vanish with the button");
  typeShare(2, "1000");
  assert.equal(
    balanceButton().props.children,
    "Split the remaining ₱2,000.01 between the other 3",
  );
  typeShare(3, "1000");
  typeShare(4, "1000");
  assert.equal(
    balanceButton().props.children,
    "Give the remaining ₱0.01 to the other person",
  );
  typeShare(5, "1");
  assert.ok(!balanceButton(), "Everyone was edited, so nobody is left to fill");
});
await splitScenario("No balancing once edits use up the total", () => {
  startSplit();
  typeShare(1, "1000");
  assert.ok(balanceButton());
  typeShare(1, "4000");
  assert.ok(!balanceButton(), "Nothing remains for the others");
  typeShare(1, "5000");
  assert.ok(!balanceButton(), "A negative remainder cannot be split");
});
await splitScenario("No balancing while an edited row is unfinished", () => {
  startSplit();
  typeShare(1, "1000");
  assert.ok(balanceButton());
  typeShare(1, "");
  assert.ok(!balanceButton(), "A blank row can't be applied afterwards");
  typeShare(1, "abc");
  assert.ok(!balanceButton(), "An unreadable row can't be applied afterwards");
  typeShare(1, "1000");
  assert.ok(balanceButton());
});
await splitScenario("Reset to even replaces the dropdown", () => {
  assert.ok(!costTree().props.titleAction, "Only the custom step offers reset");
  startSplit();
  assert.ok(!nodes(costTree()).some((n) => n.props.label === "Split"));
  const reset = () => costTree().props.titleAction;
  assert.equal(reset().props.children, "Reset to even");
  assert.equal(
    render(approved.ExpenseCostEditor, { ...approvedProps, pending: true })
      .props.titleAction.props.disabled,
    true,
  );
  typeShare(1, "1");
  confirmAnswer = false;
  reset().props.onClick();
  assert.equal(find(costTree(), "expense-share-1").props.value, "1");
  confirmAnswer = true;
  reset().props.onClick();
  assert.equal(
    shareValues(),
    JSON.stringify(["800.00", "800.00", "800.00", "800.00", "800.00"]),
  );
  assert.equal(stepTitle(), "Custom split");
  assert.equal(confirms.length, 2);
  reset().props.onClick();
  assert.equal(confirms.length, 2, "No typed amounts left to warn about");
});
await splitScenario("Focusing an amount selects it", () => {
  startSplit();
  let selections = 0;
  find(costTree(), "expense-share-1").props.onFocus({
    target: { select: () => selections++ },
  });
  assert.equal(selections, 1);
});
// Browsers collapse a clicked selection, and the step focuses its first amount
// itself, so the first click after any focus must select again.
await splitScenario("First click after focus selects the amount", () => {
  startSplit();
  let selections = 0;
  const input = { select: () => selections++ };
  const field = () => find(costTree(), "expense-share-1").props;
  field().onFocus({ target: input });
  assert.equal(selections, 1);
  field().onClick({ currentTarget: input });
  assert.equal(selections, 2, "The first tap must replace, not insert");
  field().onClick({ currentTarget: input });
  assert.equal(selections, 2, "Later taps place the cursor for corrections");
  field().onFocus({ target: input });
  field().onClick({ currentTarget: input });
  assert.equal(selections, 4, "Returning to the field selects again");
});
await splitScenario("An added member is named on the expense", async () => {
  startExpense();
  costTree().props.headerAction.props.onClick();
  memberBoxes()[4].props.onChange({ target: { checked: false } });
  await submitCost();
  openSplit();
  await submitCost();
  assert.equal(stepTitle(), "Add expense");
  costTree().props.headerAction.props.onClick();
  memberBoxes()[4].props.onChange({ target: { checked: true } });
  await submitCost();
  assert.match(renderToStaticMarkup(costTree()), /Add an amount for Person 5/);
  assert.ok(changeSplitButton(), "The fix stays one tap away");
});
await splitScenario("A price change is explained on the expense", async () => {
  startSplit();
  await submitCost();
  find(costTree(), "expense-price").props.onChange({
    target: { value: "5000" },
  });
  assert.match(
    renderToStaticMarkup(costTree()),
    /₱1,000 is still left to assign/,
  );
});
assert.deepEqual(splitFailures, []);
console.log(
  "Custom split back, running total, balancing, reset and outdated-split messages passed.",
);

viewData = {
  ...reservationLedger,
  expenses: [
    { ...inn, activity_id: undefined, activity_name: "Removed resort" },
  ],
};
states = [];
refs = [];
const historicalProps = {
  ...ownerProps,
  activityID: activity.activityKey(viewData.expenses[0]),
  activityTitle: "Removed resort",
};
tree = render(view.ActivityExpenses, historicalProps);
nodes(tree)
  .find((n) => n.props["aria-label"] === "Edit Inn expense")
  .props.onClick();
tree = render(view.ActivityExpenses, historicalProps);
assert.ok(
  nodes(tree).some((n) => n.type === formModule.ActivityExpenseForm),
  "Removed activities retain their historical association editor",
);

const readingFields = load("src/components/trips/expense-fields.tsx", {
  "@/components/ui/input": { Input: wrap("input") },
  "@/lib/money": money,
});
assert.match(
  renderToStaticMarkup(
    readingFields.ExpensePriceField({
      currency: { code: "PHP", decimals: 2 },
      value: "1000",
      onChange() {},
    }),
  ),
  /1,000.00/,
);
assert.match(
  renderToStaticMarkup(
    readingFields.ExpenseDateField({ value: "2026-11-07", onChange() {} }),
  ),
  /November 7, 2026/,
);
assert.match(
  renderToStaticMarkup(
    readingFields.ExpensePriceField({
      currency: { code: "PHP", decimals: 2 },
      value: "invalid",
      onChange() {},
    }),
  ),
  /invalid/,
);

// Reported regressions: a per-person cost cannot reach custom splitting, and
// unpaid costs hide the only visible entry to their payment screens.
const accessFailures = [];
states = [];
refs = [];
find(costTree(), "expense-name").props.onChange({
  target: { value: "Entrance" },
});
find(costTree(), "expense-price").props.onChange({ target: { value: "400" } });
nodes(costTree())
  .find((n) => n.props.type === "radio" && n.props.name === "expense-basis")
  .props.onChange();
const splitControl = nodes(costTree()).find((n) => n.props.label === "Split");
if (splitControl.props.disabled)
  accessFailures.push("Custom split is disabled for a per-person expense");
viewData = {
  ...data,
  expenses: [entrance],
  payments: [],
  settlements: [],
  debts: [],
};
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...ownerProps, compact: true });
if (!nodes(tree).some((n) => n.props.children === "View payments"))
  accessFailures.push("An unpaid expense has no visible View payments button");
assert.deepEqual(accessFailures, []);
nodes(tree)
  .find((node) => node.props.children === "View payments")
  .props.onClick({ currentTarget: null });
tree = render(view.ActivityExpenses, { ...ownerProps, compact: true });
assert.equal(
  nodes(tree).find((node) => node.type === PaymentWorkspace).props.participants,
  people,
);

// A reservation can fully cover its payer while others still owe the business.
const coveredMember = {
  user_id: 1,
  share_minor: "80000",
  paid_minor: "80000",
  remaining_minor: "0",
  business_remaining_minor: "0",
  receivable_minor: "20000",
  credit_minor: "0",
  reimbursements: [],
};
const outstandingDebt = {
  payment_id: 1,
  from_user_id: 3,
  to_user_id: 1,
  currency: "PHP",
  amount_minor: "5000",
};
let paymentStatus = {
  expense: inn,
  business_paid_minor: "100000",
  business_remaining_minor: "300000",
  people,
  payments: reservationLedger.payments,
  receipts: [],
  members: [
    coveredMember,
    {
      ...coveredMember,
      user_id: 3,
      paid_minor: "75000",
      remaining_minor: "5000",
      receivable_minor: "0",
      reimbursements: [outstandingDebt],
    },
  ],
};
let previewQuery, paymentPreview;
const paymentWrites = new Map();
let paymentSaved = 0;
const paymentApi = {
  pending: false,
  error: null,
  reset() {},
  async saveSettlement(input, _record, key) {
    const body = JSON.stringify(input);
    if (!paymentWrites.has(key)) {
      paymentWrites.set(key, body);
      throw new Error("Response lost after commit");
    }
    if (paymentWrites.get(key) !== body)
      throw new ApiError(409, "Changed submission");
    return { id: 1 };
  },
  saveTransaction(_kind, input, record, key) {
    return this.saveSettlement(input, record, key);
  },
};
const paymentModule = load(
  "src/components/trips/expense-payment-workspace.tsx",
  {
    react: { ...formReact, useId: () => "payment" },
    "@/lib/api": apiMock,
    "@/lib/expenses": {
      ...ledger,
      useExpensesApi: () => paymentApi,
    },
    "@tanstack/react-query": {
      useQuery(options) {
        if (options.queryKey.includes("expense-status"))
          return { data: paymentStatus };
        previewQuery = options;
        return { data: paymentPreview };
      },
    },
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/label": { Label: wrap("label") },
    "./expense-fields": {
      ExpensePriceField: wrap("input"),
      ExpenseDateField: wrap("input"),
    },
    "./expense-forms": { ExpenseSelect },
    "./trip-dialog": { TripDialog: ({ children }) => children },
    "./trip-states": { TripError },
  },
  { crypto },
);
const workspaceProps = {
  trip: { id: 7, time_zone: "Asia/Manila" },
  cost: inn,
  currency: currencies[0],
  current: { user_id: 1, role: "owner" },
  participants: people,
  onBack() {},
  onFailure() {},
};
states = [];
refs = [];
tree = render(paymentModule.ExpensePaymentWorkspace, workspaceProps);
nodes(tree.props.footer)
  .find((n) => n.props.children === "Update a payment")
  .props.onClick();
tree = render(paymentModule.ExpensePaymentWorkspace, workspaceProps);
const memberChoice = (id) =>
  nodes(tree).find(
    (n) =>
      n.props.onClick &&
      nodes(n).some((c) => c.props.children === `Person ${id}`),
  );
const paidChoice = memberChoice(1);
assert.equal(
  paidChoice.props.disabled,
  true,
  "A fully paid member must not open a zero-amount payment form",
);
memberChoice(3).props.onClick();
const formElement = render(
  paymentModule.ExpensePaymentWorkspace,
  workspaceProps,
);
states = [];
refs = [];
const paymentTree = () => render(formElement.type, formElement.props);
tree = paymentTree();
const payeeField = nodes(tree).find(
  (n) => n.props.label === "Who received the payment?",
);
assert.equal(payeeField.props.value, "1:1");
assert.equal(
  payeeField.props.options.some((o) => o.value === "business"),
  false,
);
assert.equal(find(tree, "payment-amount").props.value, "50.00");
assert.equal(
  previewQuery.enabled,
  false,
  "Reimbursements need no business preview",
);
find(tree, "payment-amount").props.onChange({ target: { value: "0" } });
assert.match(renderToStaticMarkup(paymentTree()), /Enter a positive amount/);
assert.doesNotMatch(
  renderToStaticMarkup(paymentTree()),
  /Something went wrong/,
);
states = [];
refs = [];
tree = render(formElement.type, {
  ...formElement.props,
  status: {
    ...paymentStatus,
    members: paymentStatus.members.map((m) =>
      m.user_id === 3
        ? { ...m, business_remaining_minor: "75000", remaining_minor: "80000" }
        : m,
    ),
  },
});
assert.equal(find(tree, "payment-amount").props.value, "750.00");
assert.equal(
  nodes(tree).find((n) => n.props.label === "Who received the payment?").props
    .value,
  "business",
);
assert.equal(previewQuery.enabled, true);
states = [];
refs = [];
tree = render(formElement.type, {
  ...formElement.props,
  current: { user_id: 4, role: "owner" },
});
assert.equal(
  tree.props.footer.props.disabled,
  true,
  "An editor cannot confirm a reimbursement received by someone else",
);
console.log(
  "Paid-member selection, reimbursement defaults and local validation passed.",
);

for (const business of [false, true]) {
  states = [];
  refs = [];
  paymentWrites.clear();
  paymentSaved = 0;
  paymentPreview = { after: { members: [] } };
  const retryProps = {
    ...formElement.props,
    status: {
      ...paymentStatus,
      members: paymentStatus.members.map((member) =>
        member.user_id === 3
          ? { ...member, business_remaining_minor: business ? "75000" : "0" }
          : member,
      ),
    },
    onSaved: () => paymentSaved++,
  };
  const retryTree = () => render(formElement.type, retryProps);
  const submitPayment = async () => {
    nodes(retryTree())
      .find((node) => node.type === "form")
      .props.onSubmit({
        preventDefault() {},
        stopPropagation() {},
      });
    await new Promise((resolve) => setImmediate(resolve));
  };
  find(retryTree(), "payment-amount").props.onChange({
    target: { value: "25.00" },
  });
  const originalDate = find(retryTree(), "payment-date").props.value;
  await submitPayment();
  assert.equal(paymentWrites.size, 1);
  assert.equal(
    paymentSaved,
    0,
    "A failed response keeps the payment draft open",
  );
  find(retryTree(), "payment-date").props.onChange({
    target: { value: "2026-10-02" },
  });
  await submitPayment();
  assert.equal(
    paymentWrites.size,
    1,
    "Editing an uncertain payment must not write it twice",
  );
  assert.equal(paymentSaved, 0);
  assert.ok(
    nodes(retryTree()).some((node) => node.props.error?.status === 409),
  );
  find(retryTree(), "payment-date").props.onChange({
    target: { value: originalDate },
  });
  await submitPayment();
  assert.equal(paymentWrites.size, 1);
  assert.equal(
    paymentSaved,
    1,
    "Retrying the original payment resolves its saved result",
  );
  const saveSettlement = paymentApi.saveSettlement;
  paymentApi.saveSettlement = async () => undefined;
  await submitPayment();
  assert.equal(
    paymentSaved,
    1,
    "A duplicate-suppressed save must keep the payment draft open",
  );
  paymentApi.saveSettlement = saveSettlement;
}

states = [];
refs = [];
paymentPreview = undefined;
const joined = { user_id: 99, display_name: "New participant", email: null };
const payerProps = {
  ...formElement.props,
  reservation: true,
  participants: [people[0], people[2], joined],
};
tree = render(formElement.type, payerProps);
const payerField = nodes(tree).find((node) => node.props.label === "Who paid?");
assert.deepEqual(
  Array.from(payerField.props.options, (option) => option.value),
  ["1", "3", "99"],
  "Payers include new participants and exclude former participants in financial history",
);
payerField.props.onChange("99");
tree = render(formElement.type, payerProps);
assert.equal(previewQuery.enabled, true);
await previewQuery.queryFn({});
assert.equal(JSON.parse(calls.at(-1)[1].body).payer_user_id, 99);
assert.equal(
  payerField.props.options.find((option) => option.value === "99").label,
  "New participant",
);
tree = render(formElement.type, { ...payerProps, participants: undefined });
assert.equal(
  nodes(tree).find((node) => node.props.label === "Who paid?").props.disabled,
  true,
);
assert.equal(previewQuery.enabled, false);
console.log(
  "Edited retries keep submission keys; payer choices use current participants.",
);

// Loans use the existing ledger without increasing spending or expense shares.
const loans = [2, 3].map((borrower, index) => ({
  id: index + 1,
  trip_id: 7,
  activity_id: 1,
  activity_name: "Resort",
  description: `Cash for Person ${borrower}`,
  from_user_id: 1,
  to_user_id: borrower,
  currency: "PHP",
  amount_minor: index === 0 ? "25000" : "35000",
  paid_on: "2026-11-02",
  created_by_user_id: 1,
  version: 1,
  people,
}));
const loanLedger = {
  expenses: [
    {
      ...inn,
      description: "Hotel",
      activity_name: "Resort",
      amount_minor: "100000",
      shares: [{ user_id: 2, amount_minor: "100000" }],
    },
  ],
  payments: [],
  loans,
  settlements: [],
  people,
  debts: loans.map((loan) => ({
    loan_id: loan.id,
    activity_id: loan.activity_id,
    activity_name: loan.activity_name,
    description: loan.description,
    currency: loan.currency,
    from_user_id: loan.to_user_id,
    to_user_id: loan.from_user_id,
    amount_minor: loan.amount_minor,
  })),
};
assert.equal(
  activity.personalTotals(loanLedger, 2, "PHP", "1").remaining,
  125000n,
);
assert.equal(activity.personalTotals(loanLedger, 2, "PHP", "1").cost, 100000n);
assert.equal(activity.personalTotals(loanLedger, 1, "PHP", "1").owed, 60000n);
const loanFormProps = {
  ...props,
  editor: { type: "loan" },
  ledger: loanLedger,
  currentUserIDs: [1, 2, 3],
};
for (const [borrower, amount] of [
  [2, "250"],
  [3, "350"],
]) {
  states = [];
  refs = [];
  saved = undefined;
  tree = render(formModule.ActivityExpenseForm, loanFormProps);
  assert.equal(find(tree, "cost-payer").props.disabled, true);
  assert.deepEqual(
    Array.from(find(tree, "loan-borrower").props.options, (p) => p.value),
    ["2", "3"],
  );
  find(tree, "loan-borrower").props.onChange(String(borrower));
  find(tree, "cost-description").props.onChange({ target: { value: "Cash" } });
  find(tree, "cost-amount").props.onChange({ target: { value: amount } });
  tree = render(formModule.ActivityExpenseForm, loanFormProps);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved.amount_minor, `${amount}00`);
  assert.equal(saved.from_user_id, 1);
  assert.equal(saved.to_user_id, borrower);
  for (const invalidBorrower of [1, 5]) {
    saved = undefined;
    find(tree, "loan-borrower").props.onChange(String(invalidBorrower));
    tree = render(formModule.ActivityExpenseForm, loanFormProps);
    await tree.props.onSubmit({ preventDefault() {} });
    assert.equal(saved, undefined);
  }
  find(tree, "loan-borrower").props.onChange("2");
  find(tree, "cost-amount").props.onChange({ target: { value: "0" } });
  tree = render(formModule.ActivityExpenseForm, loanFormProps);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved, undefined);
}

const lenderProps = { ...ownerProps, current: { user_id: 1, role: "member" } };
viewData = loanLedger;
states = [];
refs = [];
tree = render(view.ActivityExpenses, lenderProps);
nodes(tree)
  .find((n) => n.props.children === "Record money lent")
  .props.onClick();
tree = render(view.ActivityExpenses, lenderProps);
let loanForm = nodes(tree).find(
  (n) => n.type === formModule.ActivityExpenseForm,
);
const loanWrites = [];
viewApi.saveTransaction = async (...args) => {
  loanWrites.push(args);
  throw new Error("Offline");
};
const loanInput = { ...loans[0], payer_user_id: 1 };
await assert.rejects(
  loanForm.props.onSave({ ...loanInput, from_user_id: 999 }),
  (error) => error instanceof ApiError && /personally lent/.test(error.message),
);
await assert.rejects(loanForm.props.onSave(loanInput), /Offline/);
tree = render(view.ActivityExpenses, lenderProps);
loanForm = nodes(tree).find((n) => n.type === formModule.ActivityExpenseForm);
assert.ok(loanForm, "Failed loan saves keep the draft open");
viewApi.saveTransaction = async (...args) => {
  loanWrites.push(args);
  return loans[0];
};
await loanForm.props.onSave(loanInput);
assert.equal(loanWrites[0][0], "expense_loans");
assert.equal(
  loanWrites[0][3],
  loanWrites[1][3],
  "Loan retries keep their submission key",
);
assert.equal(
  nodes(render(view.ActivityExpenses, lenderProps)).some(
    (n) => n.type === formModule.ActivityExpenseForm,
  ),
  false,
);

for (const role of ["member", "editor", "owner", "viewer"]) {
  states = [];
  refs = [];
  tree = render(view.ActivityExpenses, {
    ...lenderProps,
    compact: true,
    current: { user_id: 1, role },
  });
  assert.equal(
    nodes(tree).some((n) => n.props.children === "Record money lent"),
    role !== "viewer",
  );
  assert.match(renderToStaticMarkup(tree), /Person 2 borrowed from Person 1/);
  assert.match(renderToStaticMarkup(tree), /Unpaid/);
  assert.equal(
    nodes(tree).some((n) => n.props.children === "Mark as paid"),
    role !== "viewer",
  );
}
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...ownerProps, compact: true });
assert.equal(
  nodes(tree).some((n) => n.props.children === "Mark as paid"),
  false,
  "An unrelated owner cannot confirm receipt",
);
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...lenderProps, managementOnly: true });
assert.doesNotMatch(renderToStaticMarkup(tree), /borrowed from|My payments/);
assert.ok(
  nodes(tree)
    .filter((n) => n.props.children === "Remove loan")
    .every((n) => !n.props.disabled),
);

const personalModule = load(
  "src/components/trips/personal-payments.tsx",
  {
    react: formReact,
    "@/lib/api": apiMock,
    "@/lib/activity-expenses": activity,
    "@/lib/expenses": { ...ledger, useExpensesApi: () => viewApi },
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "./activity-expense-form": formModule,
    "./expense-payment-workspace": {
      ExpensePaymentWorkspace: PaymentWorkspace,
    },
    "./trip-dialog": {
      TripDialog: ({ open, children }) => (open ? children : null),
    },
  },
  {
    crypto: { randomUUID: () => "receipt-key" },
    window: { confirm: () => true },
  },
);
const personalProps = { ...lenderProps, ledger: loanLedger, currencies };
function personal(overrides = {}) {
  return render(personalModule.PersonalPayments, {
    ...personalProps,
    ...overrides,
  });
}
const combinedLedger = {
  ...loanLedger,
  payments: [
    {
      id: 90,
      expense_id: inn.id,
      payer_user_id: 1,
      amount_minor: "10000",
      allocations: [{ user_id: 2, amount_minor: "10000" }],
    },
  ],
  debts: [
    ...loanLedger.debts,
    {
      payment_id: 90,
      activity_id: 1,
      activity_name: "Resort",
      description: "Hotel deposit",
      currency: "PHP",
      from_user_id: 2,
      to_user_id: 1,
      amount_minor: "10000",
    },
  ],
};
states = [];
refs = [];
assert.match(
  renderToStaticMarkup(personal({ ledger: combinedLedger })),
  /Owed to me: ₱700/,
);
states = [];
refs = [];
const combinedBorrower = renderToStaticMarkup(
  personal({ ledger: combinedLedger, current: { user_id: 2, role: "member" } }),
);
assert.match(combinedBorrower, /To pay: ₱1,250/);
assert.match(combinedBorrower, /Pay to business/);
assert.match(combinedBorrower, /Expense reimbursement/);
assert.match(combinedBorrower, /Borrowed money/);
states = [];
refs = [];
assert.match(renderToStaticMarkup(personal()), /Owed to me: ₱600/);
states = [];
refs = [];
const borrowerHTML = renderToStaticMarkup(
  personal({ current: { user_id: 2, role: "member" } }),
);
assert.match(borrowerHTML, /To pay: ₱1,250/);
assert.doesNotMatch(borrowerHTML, /Cash for Person 3/);
states = [];
refs = [];
assert.doesNotMatch(
  renderToStaticMarkup(personal({ current: { user_id: 4, role: "member" } })),
  /Cash for Person|Mark as paid/,
);
states = [];
refs = [];
assert.doesNotMatch(
  renderToStaticMarkup(personal({ current: { user_id: 1, role: "viewer" } })),
  /Mark as paid/,
);
states = [];
refs = [];
tree = personal();
nodes(tree)
  .find((n) => n.props.children === "Mark as paid")
  .props.onClick({ currentTarget: null });
tree = personal();
let receiptForm = nodes(tree).find(
  (n) => n.type === formModule.ActivityExpenseForm,
);
const receiptWrites = [];
viewApi.saveSettlement = async (...args) => {
  receiptWrites.push(args);
  throw new Error("Offline");
};
const receiptInput = {
  ...loanLedger.debts[0],
  paid_on: "2026-11-02",
  amount_minor: "10000",
};
await assert.rejects(
  receiptForm.props.onSave({ ...receiptInput, to_user_id: 999 }),
  (error) =>
    error instanceof ApiError && /Only the recipient/.test(error.message),
);
await assert.rejects(receiptForm.props.onSave(receiptInput), /Offline/);
tree = personal();
receiptForm = nodes(tree).find(
  (n) => n.type === formModule.ActivityExpenseForm,
);
assert.ok(receiptForm, "Failed receipts keep the draft open");
viewApi.saveSettlement = async (...args) => {
  receiptWrites.push(args);
  return { id: 1 };
};
await receiptForm.props.onSave(receiptInput);
assert.equal(receiptWrites[0][0].loan_id, 1);
assert.equal(receiptWrites[0][0].amount_minor, "10000");
assert.equal(receiptWrites[0][2], receiptWrites[1][2]);
assert.equal(
  nodes(personal()).some((n) => n.type === formModule.ActivityExpenseForm),
  false,
);

states = [];
refs = [];
saved = undefined;
const receiptProps = {
  ...props,
  ledger: loanLedger,
  editor: { type: "repayment", debt: loanLedger.debts[0] },
};
tree = render(formModule.ActivityExpenseForm, receiptProps);
assert.equal(find(tree, "cost-amount").props.value, "250.00");
find(tree, "cost-amount").props.onChange({ target: { value: "251" } });
tree = render(formModule.ActivityExpenseForm, receiptProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved, undefined, "Receipts cannot exceed the outstanding amount");
find(tree, "cost-amount").props.onChange({ target: { value: "100" } });
tree = render(formModule.ActivityExpenseForm, receiptProps);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.loan_id, 1);
assert.equal(saved.amount_minor, "10000");

viewData = {
  ...loanLedger,
  expenses: [],
  loans: [...loans, { ...loans[0], id: 3, currency: "JPY" }],
  debts: [
    ...loanLedger.debts,
    { ...loanLedger.debts[0], loan_id: 3, currency: "JPY" },
  ],
};
states = [];
refs = [];
tree = render(view.Expenses, { ...viewProps, active: true });
assert.doesNotMatch(renderToStaticMarkup(tree), /No expenses yet/);
assert.match(renderToStaticMarkup(tree), /JPY/);
assert.ok(
  nodes(tree).some((n) => n.type === PersonalPayments),
  "Trip renders personal payments",
);
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...lenderProps, compact: true });
assert.ok(
  nodes(tree).some((n) => n.type === PersonalPayments),
  "Activity renders the same personal payments",
);
assert.match(renderToStaticMarkup(tree), /₱0|JPY 0/);
states = [];
refs = [];
assert.match(renderToStaticMarkup(personal({ ledger: viewData })), /JPY/);
states = [];
refs = [];
assert.doesNotMatch(
  renderToStaticMarkup(
    personal({
      ledger: {
        ...viewData,
        debts: viewData.debts.map((d) => ({ ...d, activity_id: 2 })),
      },
      activityID: "1",
    }),
  ),
  /Cash for Person/,
);

viewData = {
  ...loanLedger,
  settlements: [{ ...receiptInput, id: 10 }],
  debts: loanLedger.debts.map((d, i) =>
    i === 0 ? { ...d, amount_minor: "15000" } : d,
  ),
};
states = [];
refs = [];
tree = render(view.ActivityExpenses, lenderProps);
assert.match(renderToStaticMarkup(tree), /Partially paid/);
assert.equal(
  nodes(tree).find((n) => n.props.children === "Remove loan").props.disabled,
  true,
);
assert.ok(nodes(tree).some((n) => n.props.children === "Receipt history"));
viewData = {
  ...viewData,
  debts: viewData.debts.map((d) => ({ ...d, amount_minor: "0" })),
};
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...lenderProps, compact: true });
assert.match(renderToStaticMarkup(tree), /Paid/);
assert.match(renderToStaticMarkup(tree), /Cash for Person 2/);
assert.equal(
  nodes(tree).some((n) => n.props.children === "Mark as paid"),
  false,
);
console.log(
  "Activity loans, personal obligations, loan-only currencies, repayment permissions and retry checks passed.",
);

// Activity finances disclose one task at a time, using the same ledger and permissions.
viewData = loanLedger;
const selectedViews = [];
const flowProps = {
  ...lenderProps,
  compact: true,
  onViewChange: (next) => selectedViews.push(next),
};
function finance(screen, overrides = {}) {
  states = [];
  refs = [];
  return render(view.ActivityExpenses, {
    ...flowProps,
    view: screen,
    ...overrides,
  });
}
tree = finance("overview");
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Cash for Person|View payments|Mark as paid|Record money lent|Add expense/,
);
assert.equal(
  nodes(tree).some((n) => n.type === PersonalPayments),
  false,
);
nodes(tree)
  .find((n) => n.props["data-finance-link"] === "details")
  .props.onClick();
assert.deepEqual(selectedViews, ["details"]);
assert.equal(
  nodes(tree).some((n) => n.props.className === "activity-finance-tabs"),
  false,
);

tree = finance("details");
const expenseTabs = (tree) =>
  nodes(tree).find((n) => n.props.className === "activity-finance-tabs");
assert.equal(expenseTabs(tree).props.value, "details");
assert.deepEqual(
  nodes(expenseTabs(tree))
    .filter((n) => n.props["aria-controls"])
    .map((n) => n.props.children),
  ["All expenses", "My expenses"],
);
assert.match(renderToStaticMarkup(tree), /1 expense/);
const detailPanel = nodes(tree).find((n) => n.props.role === "tabpanel");
assert.equal(detailPanel.props["aria-labelledby"], "expense-details-1");
expenseTabs(tree).props.onValueChange("personal");
assert.equal(selectedViews.at(-1), "personal");
assert.match(renderToStaticMarkup(tree), /Hotel/);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Person 2 borrowed from|My payments/,
);
const borrowLink = nodes(tree).find(
  (n) => n.props["data-finance-link"] === "loans",
);
borrowLink.props.onClick();
assert.equal(selectedViews.at(-1), "loans");
assert.match(renderToStaticMarkup(borrowLink), /2 loans/);
assert.match(renderToStaticMarkup(borrowLink), /600/);
assert.equal(
  nodes(tree).some((n) => n.type === PersonalPayments),
  false,
);
tree = finance("personal");
assert.equal(expenseTabs(tree).props.value, "personal");
expenseTabs(tree).props.onValueChange("details");
assert.equal(selectedViews.at(-1), "details");
assert.equal(
  nodes(tree).find((n) => n.type === PersonalPayments).props.showExpenses,
  true,
);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Borrow list|Add expense|Cash for Person/,
);

for (const role of ["owner", "editor", "member", "viewer"]) {
  const detail = finance("details", { current: { user_id: 1, role } });
  const add = nodes(detail).filter(
    (n) =>
      n.props.onClick &&
      React.Children.toArray(n.props.children).includes("Add expense"),
  );
  assert.equal(add.length, role === "owner" || role === "editor" ? 1 : 0);
}
viewData = { ...loanLedger, expenses: [] };
assert.match(renderToStaticMarkup(finance("details")), /0 expenses/);
viewData = {
  ...loanLedger,
  expenses: [loanLedger.expenses[0], { ...loanLedger.expenses[0], id: 99 }],
};
assert.match(renderToStaticMarkup(finance("details")), /2 expenses/);

viewData = {
  ...loanLedger,
  loans: [
    ...loans,
    { ...loans[0], id: 99, from_user_id: 2, to_user_id: 3 },
    { ...loans[0], id: 100, activity_id: 2 },
  ],
};
tree = finance("loans");
assert.equal(
  nodes(tree).filter((n) => n.type === "article").length,
  2,
  "Only my loans for this activity appear",
);
assert.match(renderToStaticMarkup(tree), /Add borrow/);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Hotel|My payments|View payments/,
);
for (const role of ["member", "editor", "owner", "viewer"]) {
  tree = finance("loans", { current: { user_id: 1, role } });
  assert.equal(
    nodes(tree).some((n) => n.props.children === "Add borrow"),
    role !== "viewer",
  );
  assert.equal(
    nodes(tree).some((n) => n.props.children === "Mark as paid"),
    role !== "viewer",
  );
}
// A borrower with multiple loans still gets one independently actionable row per loan.
viewData = { ...loanLedger, loans: [loans[0], { ...loans[0], id: 3 }] };
assert.equal(
  nodes(finance("loans")).filter((n) => n.type === "article").length,
  2,
);

const undone = [];
viewApi.remove = async (...args) => undone.push(args);
viewData = {
  ...loanLedger,
  loans: [loans[0]],
  debts: [{ ...loanLedger.debts[0], amount_minor: "0" }],
  settlements: [
    { ...receiptInput, loan_id: 1, id: 40, version: 1 },
    { ...receiptInput, loan_id: 1, id: 41, version: 2 },
  ],
};
tree = finance("loans");
assert.match(renderToStaticMarkup(tree), /Paid/);
assert.equal(
  nodes(tree).some((n) => n.props.children === "Mark as paid"),
  false,
);
await nodes(tree)
  .find((n) => n.props.children === "Undo")
  .props.onClick({ currentTarget: { isConnected: true, closest: () => null } });
assert.equal(undone[0][0], "settlements");
assert.equal(
  undone[0][1].id,
  41,
  "Undo reverses only the latest active receipt",
);
assert.equal(undone[0][2], "Repayment entered by mistake");
tree = finance("loans", { current: { user_id: 1, role: "viewer" } });
assert.equal(
  nodes(tree).some((n) => n.props.children === "Undo"),
  false,
);
viewData = { ...viewData, loans: [] };
assert.match(
  renderToStaticMarkup(finance("loans")),
  /haven.t recorded any money lent/,
);
assert.ok(
  nodes(finance("details")).some(
    (n) => n.props["data-finance-link"] === "loans",
  ),
  "Empty Borrow list stays discoverable",
);

// Paid means the settled part of my own share, never the cash I lent or covered for others.
const ownCost = {
  ...inn,
  amount_minor: "200000",
  shares: [
    { user_id: 1, amount_minor: "100000" },
    { user_id: 2, amount_minor: "100000" },
  ],
};
const paidLedger = {
  ...loanLedger,
  expenses: [ownCost],
  payments: [
    {
      id: 1,
      expense_id: ownCost.id,
      payer_user_id: 1,
      amount_minor: "180000",
      allocations: [
        { user_id: 1, amount_minor: "100000" },
        { user_id: 2, amount_minor: "80000" },
      ],
    },
  ],
  debts: [
    ...loanLedger.debts,
    {
      payment_id: 1,
      activity_id: 1,
      currency: "PHP",
      from_user_id: 2,
      to_user_id: 1,
      amount_minor: "80000",
      description: "Reservation",
    },
  ],
};
states = [];
refs = [];
tree = personal({ showExpenses: true, activityID: "1", ledger: paidLedger });
const summaryValues = (node) =>
  nodes(node)
    .filter((n) => n.type === "dd")
    .map((n) => n.props.children);
assert.deepEqual(
  summaryValues(tree),
  ["100000", "100000", "0"].map((n) => money.expenseMoney(n, currencies[0])),
);
assert.match(renderToStaticMarkup(tree), /Reservation|Expense reimbursement/);
assert.ok(
  nodes(tree).some((n) => n.props["aria-label"] === "View Inn payments"),
  "Fully settled expense shares remain visible",
);
const personalTrigger = { isConnected: true };
nodes(tree)
  .find((n) => n.props["aria-label"] === "View Inn payments")
  .props.onClick({ currentTarget: personalTrigger });
tree = personal({ showExpenses: true, activityID: "1", ledger: paidLedger });
assert.equal(
  nodes(tree).find((n) => n.type === PaymentWorkspace).props.backLabel,
  "Back to My Expenses",
);
states = [];
refs = [];
tree = personal({
  showExpenses: true,
  activityID: "1",
  current: { user_id: 2, role: "member" },
  ledger: {
    ...paidLedger,
    loans: [],
    debts: [
      {
        payment_id: 1,
        activity_id: 1,
        currency: "PHP",
        from_user_id: 2,
        to_user_id: 1,
        amount_minor: "40000",
      },
    ],
  },
});
assert.deepEqual(
  summaryValues(tree),
  ["100000", "40000", "60000"].map((n) => money.expenseMoney(n, currencies[0])),
);
console.log(
  "Activity overview/detail/personal/borrow disclosure, settled-share totals, lender filtering and Undo passed.",
);

// Compact personal balances keep the recipient and debt attached to their action.
states = [];
refs = [];
tree = personal({ showExpenses: true, activityID: "1", ledger: paidLedger });
assert.equal(
  nodes(tree).filter(
    (n) => n.type === "h4" && n.props.children === "Owed to you",
  ).length,
  1,
);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Owed to me:|Expense reimbursement/,
);
const compactReceipt = nodes(tree).find(
  (n) =>
    n.props["aria-label"] ===
    `Mark ${money.expenseMoney("80000", currencies[0])} from Person 2 as paid`,
);
assert.ok(
  compactReceipt,
  "The action identifies the person and outstanding amount",
);
compactReceipt.props.onClick({ currentTarget: personalTrigger });
tree = personal({ showExpenses: true, activityID: "1", ledger: paidLedger });
const compactReceiptForm = nodes(tree).find(
  (n) => n.type === formModule.ActivityExpenseForm,
);
assert.equal(compactReceiptForm.props.editor.debt.payment_id, 1);
assert.equal(compactReceiptForm.props.editor.debt.from_user_id, 2);
assert.equal(compactReceiptForm.props.editor.debt.amount_minor, "80000");
console.log(
  "Compact personal balances preserve named repayment actions and amounts.",
);
