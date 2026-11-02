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
assert.equal(
  money.parseMoney("92233720368547758.07", 2),
  "9223372036854775807",
);
for (const value of [
  "-1",
  "1e3",
  "1,000",
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
  /Saving may have completed/,
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
const TripError = ({ error }) => React.createElement("p", null, error.message);
const formModule = load("src/components/trips/activity-expense-form.tsx", {
  react: formReact,
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
    if (fail) throw new Error("Offline");
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

states = [];
refs = [];
const enabled = [];
let viewData = data;
const viewApi = { ...api, ledger: async () => data };
const CostEditor = () => null;
const PaymentWorkspace = () => null;
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
  },
  {
    document: { activeElement: null, querySelector: () => null },
    window: { confirm: () => true },
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
const approved = load(
  "src/components/trips/expense-cost-editor.tsx",
  {
    "./expense-fields": { ExpensePriceField: wrap("input") },
    react: { ...formReact, useId: () => "expense" },
    "@/lib/api": apiMock,
    "@/lib/expenses": ledger,
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/input": { Input: wrap("input") },
    "@/components/ui/label": { Label: wrap("label") },
    "@/components/ui/select": Object.fromEntries(
      [
        "Select",
        "SelectContent",
        "SelectItem",
        "SelectTrigger",
        "SelectValue",
      ].map((n) => [n, wrap("div")]),
    ),
    "./trip-dialog": { TripDialog: ({ children }) => children },
    "./expense-forms": { ExpenseSelect },
    "./trip-states": { TripError },
  },
  {
    window: { confirm: () => true },
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
    "./trip-states": {
      TripError: ({ error }) =>
        React.createElement(
          "p",
          null,
          error instanceof ApiError
            ? error.message
            : "Something went wrong. Please try again.",
        ),
    },
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
