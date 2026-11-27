import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLoader, isAutoLoaded } from "./lib/load.mjs";

const load = createLoader({
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
});
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
// A task's expense carries its task; leaving it out keeps the saved link.
assert.equal(sanitized.prep_task_id, undefined);
assert.equal(
  ledger.expenseInput({ ...input, prep_task_id: 12 }).prep_task_id,
  12,
);
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
// A new expense with someone paying the reservation first also records that
// payment to the business, so the others owe the payer right away.
calls.length = 0;
response = { ...sanitized, id: 9, version: 1 };
await api.saveExpense(
  {
    ...input,
    planned_coverer_user_id: 2,
    planned_cover_amount_minor: "100000",
  },
  undefined,
  "reserve-key",
);
const reservationCall = calls.find(([path]) =>
  path.endsWith?.("/expense_payments"),
);
assert.ok(reservationCall, "The reservation is recorded with the expense");
assert.deepEqual(
  {
    ...JSON.parse(reservationCall[1].body),
    key: reservationCall[1].headers["Idempotency-Key"],
  },
  {
    expense_id: 9,
    currency: input.currency,
    amount_minor: "100000",
    paid_on: input.incurred_on,
    payer_user_id: 2,
    key: "reserve-key:reservation",
  },
);
calls.length = 0;
await api.saveExpense(
  {
    ...input,
    planned_coverer_user_id: 2,
    planned_cover_amount_minor: "100000",
  },
  { ...response },
  "edit-key",
);
assert.ok(
  !calls.some(([path]) => path.endsWith?.("/expense_payments")),
  "Editing keeps Record reservation for an existing expense",
);
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
const resort = { id: 1, title: "Resort", category: "Rest" };
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

const loanLedgerShape = {
  ...cash,
  expenses: [
    {
      ...inn,
      payer_user_id: 1,
      shares: [{ user_id: 3, amount_minor: "5000" }],
    },
  ],
  payments: [cash.payments[0]],
  loans: [
    {
      id: 1,
      trip_id: 7,
      activity_id: 1,
      activity_name: "Resort",
      description: "Cash",
      from_user_id: 1,
      to_user_id: 2,
      currency: "PHP",
      amount_minor: "25000",
      paid_on: "2026-11-02",
    },
    {
      id: 2,
      trip_id: 7,
      activity_id: 1,
      activity_name: "Resort",
      description: "Cash",
      from_user_id: 1,
      to_user_id: 3,
      currency: "PHP",
      amount_minor: "35000",
      paid_on: "2026-11-02",
    },
  ],
  settlements: [
    {
      id: 9,
      loan_id: 1,
      currency: "PHP",
      amount_minor: "10000",
      paid_on: "2026-11-03",
      from_user_id: 2,
      to_user_id: 1,
    },
  ],
  debts: [
    {
      payment_id: 1,
      activity_id: 1,
      activity_name: "Resort",
      description: "Inn",
      currency: "PHP",
      from_user_id: 3,
      to_user_id: 1,
      amount_minor: "5000",
    },
    {
      loan_id: 1,
      activity_id: 1,
      activity_name: "Resort",
      description: "Cash",
      currency: "PHP",
      from_user_id: 2,
      to_user_id: 1,
      amount_minor: "15000",
    },
    {
      loan_id: 2,
      activity_id: 1,
      activity_name: "Resort",
      description: "Cash",
      currency: "PHP",
      from_user_id: 3,
      to_user_id: 1,
      amount_minor: "35000",
    },
  ],
};
// Group and Personal rows, filters and totals for the trip Expenses page.
const views = load("src/lib/expense-views.ts");
assert.equal(
  views.categoryOf({ activity_id: 9 }, [{ id: 9, category: "" }]),
  "Other",
);
const groupCost = (id, amount, split, extra = {}) => ({
  ...inn,
  id,
  description: `Cost ${id}`,
  amount_minor: String(amount),
  incurred_on: "2026-11-05",
  shares: split.map(([user_id, value]) => ({
    user_id,
    amount_minor: String(value),
  })),
  ...extra,
});
const groupPayment = (
  id,
  expense_id,
  payer_user_id,
  covers,
  currency = "PHP",
) => ({
  id,
  expense_id,
  payer_user_id,
  currency,
  paid_on: "2026-11-05",
  amount_minor: String(covers.reduce((n, [, v]) => n + v, 0)),
  allocations: covers.map(([user_id, value]) => ({
    user_id,
    amount_minor: String(value),
  })),
});
const groupDebt = (payment_id, from_user_id, to_user_id, amount) => ({
  payment_id,
  from_user_id,
  to_user_id,
  activity_id: 1,
  currency: "PHP",
  description: "Debt",
  amount_minor: String(amount),
});
const groupLedger = {
  ...data,
  expenses: [
    // Paid by 1; 2 has repaid, 3 repaid part, 4 repaid nothing.
    groupCost(10, 40000, [
      [1, 10000],
      [2, 10000],
      [3, 10000],
      [4, 10000],
    ]),
    // Nobody has paid or plans to, and it has no activity.
    groupCost(
      11,
      30000,
      [
        [1, 15000],
        [2, 15000],
      ],
      {
        activity_id: undefined,
        activity_name: "",
        incurred_on: "2026-11-09",
      },
    ),
    // One person, another currency, fully paid.
    groupCost(12, 500, [[3, 500]], { currency: "JPY" }),
    // The share shrank after it was paid.
    groupCost(13, 10000, [[1, 10000]]),
    // A zero share never owes anything.
    groupCost(14, 5000, [
      [1, 5000],
      [2, 0],
    ]),
    // Half paid to the business, with someone planning to cover it.
    groupCost(
      15,
      20000,
      [
        [1, 10000],
        [2, 10000],
      ],
      {
        planned_coverer_user_id: 2,
        planned_cover_amount_minor: "20000",
      },
    ),
    // 2 left the split after being covered, then 1 was over-repaid by 3.
    groupCost(16, 10000, [[1, 10000]]),
  ],
  payments: [
    groupPayment(1, 10, 1, [
      [1, 10000],
      [2, 10000],
      [3, 10000],
      [4, 10000],
    ]),
    groupPayment(2, 12, 3, [[3, 500]], "JPY"),
    groupPayment(3, 13, 1, [[1, 12000]]),
    groupPayment(4, 14, 1, [[1, 5000]]),
    groupPayment(5, 15, 1, [[1, 10000]]),
    groupPayment(6, 16, 1, [
      [1, 10000],
      [3, 4000],
    ]),
  ],
  debts: [
    groupDebt(1, 2, 1, 0),
    groupDebt(1, 3, 1, 4000),
    groupDebt(1, 4, 1, 10000),
    groupDebt(6, 3, 1, -1000),
    { ...groupDebt(undefined, 3, 1, 25000), loan_id: 7 },
  ],
  loans: [
    {
      ...loanLedgerShape.loans[0],
      id: 7,
      from_user_id: 1,
      to_user_id: 3,
      amount_minor: "25000",
    },
  ],
  settlements: [],
};
const groupFor = (me, id) =>
  views.groupRows(groupLedger, me).find((r) => r.expense.id === id);
assert.deepEqual(
  views
    .groupRows(groupLedger, 3)
    .map((r) => r.expense.id)
    .join(),
  "11,16,15,14,13,12,10",
  "Every cost is listed newest first, including ones outside your shares",
);
let groupedRow = groupFor(3, 10);
assert.deepEqual(
  [groupedRow.paid, groupedRow.paidPeople, groupedRow.people].join(),
  "26000,2,4",
  "A part-repaid share counts its money but not its person",
);
assert.equal(groupedRow.covered, true);
assert.equal(groupedRow.owe, 4000n);
assert.equal(groupFor(1, 10).owed, 14000n);
assert.equal(groupFor(1, 10).owe, 0n);
assert.equal(groupFor(2, 10).owe, 0n);
assert.equal(groupFor(2, 10).needsPayment, true, "Others still owe");
groupedRow = groupFor(3, 11);
assert.equal(groupedRow.noPayer, true);
assert.equal(groupedRow.share, 0n);
assert.equal(groupedRow.owe, 0n);
assert.equal(groupedRow.needsPayment, true);
assert.equal(groupFor(3, 12).settled, true);
assert.equal(groupFor(3, 12).people, 1);
groupedRow = groupFor(1, 13);
assert.deepEqual(
  [groupedRow.settled, groupedRow.needsPayment, groupedRow.credit].join(),
  "false,false,2000",
  "A credit is neither settled nor waiting for payment",
);
assert.equal(groupFor(1, 14).settled, true);
assert.equal(groupFor(1, 14).paidPeople, 2);
groupedRow = groupFor(2, 15);
assert.equal(groupedRow.covered, false);
assert.equal(groupedRow.noPayer, false);
assert.equal(groupedRow.owe, 10000n);
assert.equal(groupFor(1, 16).owe, 1000n, "An over-repayment is owed back");
assert.equal(groupFor(2, 99), undefined);
const idsFor = (filter, me) =>
  views
    .groupRows(groupLedger, me)
    .filter((r) => views.matchesGroup(filter, r))
    .map((r) => r.expense.id)
    .sort((a, b) => a - b)
    .join();
assert.equal(idsFor("all", 3), "10,11,12,13,14,15,16");
assert.equal(idsFor("payment", 3), "10,11,15");
assert.equal(idsFor("settled", 3), "12,14");
assert.equal(idsFor("owe", 3), "10");
assert.equal(idsFor("owed", 1), "10,13");
assert.equal(idsFor("owe", 2), "11,15");
for (const fixture of [groupLedger, data, cash, loanLedgerShape])
  for (const me of [1, 2, 3, 4, 5, 99]) {
    const rows = views.groupRows(fixture, me);
    const totals = views.groupTotals(fixture, me);
    assert.equal(
      totals.length,
      new Set(fixture.expenses.map((e) => e.currency)).size,
    );
    for (const t of totals) {
      const own = rows.filter((r) => r.expense.currency === t.currency);
      for (const key of ["total", "share", "owe", "owed"])
        assert.equal(
          t[key],
          own.reduce((n, r) => n + r[key], 0n),
          `Group ${key} for ${me} in ${t.currency} equals its rows`,
        );
    }
  }
assert.equal(
  views.groupTotals(cash, 3)[0].owe,
  activity.personalTotals(data, 3, "PHP").remaining,
  "A loan never reaches the Group figures",
);
assert.equal(
  activity.personalTotals(cash, 3, "PHP").remaining,
  activity.personalTotals(data, 3, "PHP").remaining + 10000n,
  "The shared money calculation itself is unchanged",
);
const privateExpense = (id, extra = {}) => ({
  id,
  trip_id: 7,
  created_by_user_id: 1,
  activity_id: 1,
  activity_name: "Resort",
  description: `Private ${id}`,
  currency: "PHP",
  amount_minor: "18000",
  incurred_on: "2026-11-04",
  version: 1,
  ...extra,
});
const privateExpenses = [
  privateExpense(1),
  privateExpense(2, { currency: "JPY", amount_minor: "900" }),
  privateExpense(3, {
    activity_id: undefined,
    activity_name: "Old tour",
    incurred_on: "2026-11-01",
  }),
];
const ownRows = views.personalRows(privateExpenses, loanLedgerShape, 1);
assert.equal(
  ownRows.map((r) => `${r.kind}-${r.record.id}`).join(),
  "expense-2,expense-1,loan-2,loan-1,expense-3",
);
assert.equal(
  views.personalRows([], loanLedgerShape, 2).length,
  0,
  "Money you borrowed is not money you lent",
);
assert.equal(views.borrowedLoans(loanLedgerShape, 2).length, 1);
assert.equal(ownRows.filter((r) => views.matchesPersonal("lent", r)).length, 2);
assert.equal(
  ownRows.filter((r) => views.matchesPersonal("expenses", r)).length,
  3,
);
assert.equal(
  views
    .personalSummary(ownRows)
    .map((t) => `${t.currency}:${t.spent}:${t.lent}`)
    .join(),
  "JPY:900:0,PHP:36000:50000",
  "Lending never counts as spending and currencies stay apart",
);
const overRepaid = views.personalRows(
  [],
  {
    ...loanLedgerShape,
    debts: [{ ...loanLedgerShape.debts[1], amount_minor: "-500" }],
  },
  1,
);
assert.equal(
  views.personalSummary(overRepaid)[0].lent,
  35000n,
  "A credit never reduces what another borrower still owes",
);
assert.equal(
  views.groupRows(groupLedger, 1).length,
  groupLedger.expenses.length,
  "Private expenses are not an input to any Group function",
);
console.log(
  "Group and Personal rows, filters, progress, credits, currencies and totals passed.",
);

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
const { TripError } = load("src/components/shared/trip-states.tsx", {
  "next/link": { default: wrap("a") },
  "@/lib/api": apiMock,
  "@/components/ui/alert": {
    Alert: wrap("div"),
    AlertTitle: wrap("p"),
    AlertDescription: wrap("p"),
  },
  "@/components/ui/button": { Button: wrap("button") },
  "@/components/ui/skeleton": { Skeleton: wrap("div") },
});
const formModule = load(
  "src/components/features/expenses/activity-expense-form/activity-expense-form.tsx",
  {
    react: formReact,
    "@/lib/api": apiMock,
    "@/lib/activity-expenses": activity,
    "@/lib/expenses": ledger,
    "@/lib/money": money,
    "@/components/features/expenses/expense-forms": { ExpenseSelect },
    "@/components/shared/trip-states": { TripError },
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/input": { Input: wrap("input") },
    "@/components/ui/label": { Label: wrap("label") },
  },
);
function nodes(el) {
  if (!React.isValidElement(el)) return [];
  const children = isAutoLoaded(el.type)
    ? el.type(el.props)
    : el.props.children;
  return [el, ...React.Children.toArray(children).flatMap(nodes)];
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

// Older purchases without an activity keep their context and original payer.
for (const activities of [[], [resort]]) {
  states = [];
  saved = undefined;
  const unassigned = {
    ...inn,
    activity_id: undefined,
    activity_name: "",
    payer_user_id: 2,
  };
  const unassignedProps = {
    ...props,
    activityID: "unassigned",
    activities,
    editor: { type: "cost", cost: unassigned },
    ledger: { ...data, payments: [] },
  };
  tree = render(formModule.ActivityExpenseForm, unassignedProps);
  find(tree, "cost-description").props.onChange({
    target: { value: "Corrected purchase" },
  });
  tree = render(formModule.ActivityExpenseForm, unassignedProps);
  fail = true;
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved, undefined);
  tree = render(formModule.ActivityExpenseForm, unassignedProps);
  assert.equal(
    find(tree, "cost-description").props.value,
    "Corrected purchase",
  );
  fail = false;
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved.description, "Corrected purchase");
  assert.equal(saved.activity_id, 0);
  assert.equal(saved.payer_user_id, 2);
  assert.equal(saved.version, unassigned.version);
}
states = [];
saved = undefined;
const newUnassignedProps = { ...props, activityID: "", activities: [] };
tree = render(formModule.ActivityExpenseForm, newUnassignedProps);
find(tree, "cost-description").props.onChange({
  target: { value: "New cost" },
});
find(tree, "cost-amount").props.onChange({ target: { value: "100" } });
tree = render(formModule.ActivityExpenseForm, newUnassignedProps);
await tree.props.onSubmit({ preventDefault() {} });
tree = render(formModule.ActivityExpenseForm, newUnassignedProps);
assert.equal(saved, undefined);
assert.match(renderToStaticMarkup(tree), /Choose an activity first/);

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
const DeleteExpenseConfirmation = () => null;
const PersonalPayments = () => null;
const viewMocks = {
  "@/components/features/expenses/dialogs/delete-expense-dialog": {
    DeleteExpenseDialog: DeleteExpenseConfirmation,
  },
  "@/components/ui/popover": {
    Popover: wrap("div"),
    PopoverTrigger: wrap("button"),
    PopoverContent: wrap("div"),
    PopoverTitle: wrap("span"),
  },
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
  "@/components/ui/select": {
    Select: ({ children }) => React.createElement("div", null, children),
    SelectTrigger: wrap("button"),
    SelectValue: wrap("span"),
    SelectContent: ({ children }) => React.createElement("div", null, children),
    SelectItem: ({ children }) => React.createElement("div", null, children),
  },
  "@/components/shared/trip-dialog": {
    TripDialog: ({ open, children }) => (open ? children : null),
  },
  "@/components/shared/trip-states": { TripError },
  "@/components/features/expenses/expense-forms": { ExpenseSelect },
  "@/components/features/expenses/activity-expense-form/activity-expense-form":
    formModule,
  "@/components/features/expenses/drawers/cost-editor/expense-cost-editor": {
    ExpenseCostEditor: CostEditor,
  },
  "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace":
    {
      ExpensePaymentWorkspace: PaymentWorkspace,
    },
  "@/components/features/expenses/personal-payments/personal-payments": {
    PersonalPayments,
  },
};
const viewGlobals = {
  document: { activeElement: null, querySelector: () => null },
  window: {
    confirm: () => true,
    prompt: () => "Repayment entered by mistake",
  },
  crypto: { randomUUID: () => "test-key" },
};
const activityView = load(
  "src/components/features/expenses/activity-expenses.tsx",
  viewMocks,
  viewGlobals,
);
const viewProps = {
  active: false,
  trip: { id: 7, time_zone: "Asia/Manila" },
  participants: people,
  current: { user_id: 3, role: "member" },
  onFailure() {},
};
// Inspect what each mode renders and hands to its dialogs.
const pageMocks = {
  ...viewMocks,
  "@/components/shared/options-menu": { OptionsMenu: () => null },
  "@/components/features/expenses/drawers/group-expense-details": {
    GroupExpenseDetails: () => null,
  },
  "@/components/features/expenses/drawers/expense-history-drawer": {
    ExpenseHistoryDrawer: () => null,
  },
  "@/components/features/expenses/drawers/personal-expense-details": {
    PersonalExpenseDetails: () => null,
  },
  "@/components/features/expenses/drawers/loan-details": {
    LoanDetails: () => null,
  },
  "@/components/features/expenses/dialogs/expense-editor-dialog": {
    ExpenseEditorDialog: () => null,
  },
  "@/components/features/expenses/dialogs/mark-as-paid-dialog": {
    MarkAsPaidDialog: () => null,
  },
  "@/components/features/expenses/dialogs/personal-expense-dialog": {
    PersonalExpenseDialog: () => null,
  },
  "@/components/features/expenses/dialogs/confirm-removal-dialog": {
    ConfirmRemovalDialog: () => null,
  },
};
const mocked = (path, name) =>
  pageMocks[`@/components/features/expenses/${path}`][name];
const GroupDetails = mocked(
  "drawers/group-expense-details",
  "GroupExpenseDetails",
);
const HistoryDrawer = mocked(
  "drawers/expense-history-drawer",
  "ExpenseHistoryDrawer",
);
const PersonalDetails = mocked(
  "drawers/personal-expense-details",
  "PersonalExpenseDetails",
);
const LoanDrawer = mocked("drawers/loan-details", "LoanDetails");
const EditorDialog = mocked(
  "dialogs/expense-editor-dialog",
  "ExpenseEditorDialog",
);
const ReceiveDialog = mocked("dialogs/mark-as-paid-dialog", "MarkAsPaidDialog");
const PersonalForm = mocked(
  "dialogs/personal-expense-dialog",
  "PersonalExpenseDialog",
);
const ConfirmRemoval = mocked(
  "dialogs/confirm-removal-dialog",
  "ConfirmRemovalDialog",
);
const RowMenu = pageMocks["@/components/shared/options-menu"].OptionsMenu;
let query = "",
  personalData = privateExpenses,
  failing = {};
const replaced = [];
const personalApi = {
  pending: false,
  error: null,
  reset() {},
  list: async () => personalData,
  get: async () => privateExpenses[0],
  save: async () => privateExpenses[0],
  remove: async () => true,
};
pageMocks["next/navigation"] = {
  useSearchParams: () => new URLSearchParams(query),
};
pageMocks["@tanstack/react-query"] = {
  useQuery(options) {
    enabled.push(options.enabled);
    const name =
      options.queryKey[0] === "expense-currencies"
        ? "currencies"
        : options.queryKey[2];
    const value = {
      currencies,
      activities: [resort],
      ledger: viewData,
      "personal-expenses": personalData,
    }[name];
    const error = failing[name] ?? null;
    return {
      data: error ? undefined : value,
      isPending: !error && value === undefined,
      isFetching: false,
      error,
      refetch() {},
    };
  },
};
pageMocks["@/lib/personal-expenses"] = {
  personalExpensesKey: (id) => ["trip", id, "personal-expenses"],
  usePersonalExpensesApi: () => personalApi,
};
const pageGlobals = {
  ...viewGlobals,
  window: {
    ...viewGlobals.window,
    location: { pathname: "/trips/7/expenses" },
    history: { replaceState: (_s, _t, url) => replaced.push(url) },
  },
  URLSearchParams,
};
const page = load(
  "src/components/features/expenses/expenses.tsx",
  pageMocks,
  pageGlobals,
);
const view = { ...activityView, ...page };
const show = (props = {}) => {
  states = [];
  refs = [];
  return render(page.Expenses, { ...viewProps, active: true, ...props });
};
const htmlOf = (props) => renderToStaticMarkup(show(props));
render(page.Expenses, viewProps);
assert.equal(enabled.length, 4);
assert.ok(
  enabled.every((e) => !e),
  "Inactive expense queries pause",
);
enabled.length = 0;
viewData = groupLedger;
let html = htmlOf();
assert.ok(enabled.every(Boolean));
assert.match(html, /Group totals/, "Group is the default");
assert.match(html, /Group total<\/dt>/);
assert.match(html, /Your share<\/dt>/);
assert.match(html, /You owe<\/dt><dd[^>]*>₱40</);
assert.match(html, /You’re owed<\/dt><dd[^>]*>₱50</); // Covered without a share (₱40) plus ₱10 over-repaid.
assert.match(html, />JPY<\/p>/, "Each currency has its own totals");
assert.match(html, /JPY 500/);
assert.equal((html.match(/data-expense-row="group-/g) ?? []).length, 7);
assert.match(html, /₱260 of ₱400 paid back · 2 of 4 people/);
assert.match(html, /₱0 of ₱300 paid · no payer yet/);
assert.match(html, /₱100 of ₱200 paid · 1 of 2 people/);
assert.match(html, /All paid · 1 of 1 person</);
assert.match(html, /No activity · 2 people/);
assert.doesNotMatch(
  html,
  /Private 1|Your personal spend|still to get back/,
  "Group never shows private records",
);
assert.match(html, /Only editors can change group expenses/);
assert.doesNotMatch(html, /Add group expense|still need payment/);
html = htmlOf({ current: { user_id: 3, role: "editor" } });
assert.match(html, /Add group expense/);
assert.match(html, /3 expenses still need payment · 1 has no payer yet/);
assert.doesNotMatch(html, /Only editors can change/);
query = "filter=settled";
html = htmlOf();
assert.equal((html.match(/data-expense-row="group-/g) ?? []).length, 2);
assert.match(html, /Group total<\/dt>/, "Totals do not follow the filter");
query = "filter=nonsense";
assert.equal((htmlOf().match(/data-expense-row="group-/g) ?? []).length, 7);
query = "filter=owed";
assert.match(
  htmlOf({ current: { user_id: 5, role: "member" } }),
  /Nothing matches this filter/,
);
query = "mode=personal";
html = htmlOf({ current: { user_id: 1, role: "member" } });
assert.match(html, /Your personal spend<\/dt><dd[^>]*>₱360</);
assert.match(html, /Lent, still to get back<\/dt><dd[^>]*>₱250</);
assert.match(html, /Private 1/);
assert.match(html, /Old tour \(removed\)/);
assert.match(html, /₱250 left/);
assert.match(html, /Money I lent/);
assert.doesNotMatch(
  html,
  /Cost 10|Group total/,
  "Personal never shows group expenses",
);
html = htmlOf({ current: { user_id: 1, role: "viewer" } });
assert.match(html, /Private 1/);
assert.match(html, /Add expense/, "Viewers add their own private expenses");
assert.doesNotMatch(html, />Money I lent/, "Viewers cannot lend");
query = "mode=personal&filter=lent";
html = htmlOf({ current: { user_id: 1, role: "member" } });
assert.equal((html.match(/data-expense-row="loan-/g) ?? []).length, 1);
assert.doesNotMatch(html, /data-expense-row="expense-/);

// Each half of Personal survives the other failing, and neither blocks Group.
query = "mode=personal";
failing = { ledger: new ApiError(503, "Ledger offline") };
html = htmlOf({ current: { user_id: 1, role: "member" } });
assert.match(html, /Private 1/);
assert.match(html, /Ledger offline/);
assert.match(html, /Try again/);
assert.doesNotMatch(html, /still to get back|>Money I lent/);
failing = { "personal-expenses": new ApiError(503, "Private offline") };
html = htmlOf({ current: { user_id: 1, role: "member" } });
assert.match(html, /Private offline/);
assert.match(html, /₱250 left/);
assert.doesNotMatch(html, /Your personal spend/);
query = "";
html = htmlOf();
assert.match(html, /Cost 10/);
assert.doesNotMatch(html, /Private offline/);
failing = { activities: new ApiError(503, "Activities offline") };
html = htmlOf();
assert.match(html, /Cost 10/);
assert.match(html, /Resort/, "The saved activity title stays readable");
assert.doesNotMatch(html, /Resort \(removed\)/);
failing = { ledger: new ApiError(503, "Ledger offline") };
html = htmlOf();
assert.match(html, /Ledger offline/);
assert.match(html, /aria-pressed="true"/, "The mode switch stays usable");
failing = {};
viewData = undefined;
html = htmlOf();
assert.match(html, /Loading expenses/);
viewData = { ...data, expenses: [], payments: [], debts: [] };
html = htmlOf();
assert.match(html, /No group expenses yet/);
assert.doesNotMatch(html, /Group total<|Filter expenses/);
query = "mode=personal";
personalData = [];
assert.match(htmlOf(), /No personal expenses yet/);
personalData = privateExpenses;

// Mode and filter live in the URL without dropping other parameters.
query = "x=1&filter=owe";
viewData = groupLedger;
let shown = nodes(show());
shown
  .find(
    (n) =>
      n.props["aria-pressed"] === false && n.props.children[1] === "Personal",
  )
  .props.onClick();
assert.equal(replaced.at(-1), "?x=1&mode=personal");
query = "mode=personal";
shown = nodes(show());
shown
  .find(
    (n) => n.props["aria-pressed"] === false && n.props.children[1] === "Group",
  )
  .props.onClick();
assert.equal(replaced.at(-1), "/trips/7/expenses");
query = "";
shown = nodes(show({ current: { user_id: 3, role: "owner" } }));
shown
  .find((n) => n.props["aria-label"] === "Show expenses that need payment")
  .props.onClick();
assert.equal(replaced.at(-1), "?filter=payment");

// History stays reachable for every role, from both modes.
for (const role of ["owner", "editor", "member", "viewer"])
  for (const mode of ["", "mode=personal"]) {
    query = mode;
    states = [];
    refs = [];
    const historyProps = {
      ...viewProps,
      active: true,
      current: { user_id: 3, role },
    };
    const entry = nodes(render(page.Expenses, historyProps)).find((n) =>
      React.Children.toArray(n.props.children).includes("Balances and history"),
    );
    entry.props.onClick();
    const drawer = nodes(render(page.Expenses, historyProps)).find(
      (n) => n.type === HistoryDrawer,
    );
    assert.equal(drawer.props.current.role, role);
  }
query = "";

// Group: row activation, editor actions, and the dialogs they open.
const groupModule = load(
  "src/components/features/expenses/group-expenses.tsx",
  pageMocks,
  pageGlobals,
);
const groupApi = {
  pending: false,
  error: null,
  reset() {},
  get: async () => inn,
  saveExpense: async () => inn,
  remove: async () => true,
};
const groupProps = {
  ...viewProps,
  current: { user_id: 1, role: "editor" },
  headingRef: { current: null },
  onModeChange() {},
  ledger: groupLedger,
  activities: [resort],
  currencies,
  api: groupApi,
  filter: "all",
  setFilter() {},
};
const groupTree = (props = groupProps) =>
  nodes(render(groupModule.GroupExpenses, props));
states = [];
refs = [];
let listed = groupTree();
assert.equal(listed.filter((n) => n.type === RowMenu).length, 7);
listed.find((n) => n.props["data-expense-row"] === "group-10").props.onClick();
let drawerNode = groupTree().find((n) => n.type === GroupDetails);
assert.equal(drawerNode.props.cost.id, 10);
assert.equal(drawerNode.props.initialScreen, undefined);
drawerNode.props.onBack();
const menu = (id) =>
  groupTree().find((n) => n.type === RowMenu && n.props.name === `Cost ${id}`)
    .props.items;
menu(11)[0].onClick();
drawerNode = groupTree().find((n) => n.type === GroupDetails);
assert.equal(
  drawerNode.props.initialScreen,
  "reservation",
  "An unpaid cost goes straight to its business payment",
);
drawerNode.props.onBack();
menu(10)[0].onClick();
drawerNode = groupTree().find((n) => n.type === GroupDetails);
assert.equal(
  drawerNode.props.initialScreen,
  null,
  "A paid business leaves only recipient-confirmed repayments",
);
drawerNode.props.onBack();
menu(10)[1].onClick();
let costEditor = groupTree().find((n) => n.type === CostEditor);
assert.equal(costEditor.props.initial.id, 10);
assert.equal(
  costEditor.props.activities,
  undefined,
  "Editing keeps its activity",
);
costEditor.props.onBack();
menu(11)[1].onClick();
assert.equal(
  groupTree().find((n) => n.type === EditorDialog).props.editing.cost.id,
  11,
  "Costs without an activity keep their existing form",
);
groupTree()
  .find((n) => n.type === EditorDialog)
  .props.close();
groupTree()
  .find((n) =>
    React.Children.toArray(n.props.children).includes("Add group expense"),
  )
  .props.onClick();
costEditor = groupTree().find((n) => n.type === CostEditor);
assert.equal(costEditor.props.activities.length, 1);
assert.equal(costEditor.props.initial, undefined);
const groupKeys = [];
groupApi.saveExpense = async (_input, _cost, key) => {
  groupKeys.push(key);
  throw new ApiError(503, "Offline");
};
await assert.rejects(costEditor.props.onSave({}), /Offline/);
costEditor = groupTree().find((n) => n.type === CostEditor);
assert.ok(costEditor, "A failed save keeps the draft open");
groupApi.saveExpense = async (_input, _cost, key) => {
  groupKeys.push(key);
  return inn;
};
await costEditor.props.onSave({});
assert.equal(groupKeys[0], groupKeys[1], "Retries reuse the submission key");
assert.ok(!groupTree().some((n) => n.type === CostEditor));
menu(10)[2].onClick();
let deletion = groupTree().find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletion.props.hasPayments, true);
const removedKinds = [];
groupApi.remove = async (kind, record) => {
  removedKinds.push([kind, record.id]);
  return true;
};
// Losing the role or the record while confirming blocks the request.
deletion = groupTree({
  ...groupProps,
  current: { user_id: 1, role: "viewer" },
}).find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletion.props.isEditor, false);
await assert.rejects(deletion.props.onDelete(), /permission/);
deletion = groupTree({
  ...groupProps,
  ledger: {
    ...groupLedger,
    expenses: groupLedger.expenses.filter((e) => e.id !== 10),
  },
}).find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletion.props.available, false);
await assert.rejects(deletion.props.onDelete(), /no longer available/);
assert.equal(removedKinds.length, 0);
deletion = groupTree().find((n) => n.type === DeleteExpenseConfirmation);
await deletion.props.onDelete();
assert.equal(removedKinds.join(), "expenses,10");
assert.ok(!groupTree().some((n) => n.type === DeleteExpenseConfirmation));
states = [];
refs = [];
for (const role of ["member", "viewer"]) {
  listed = groupTree({ ...groupProps, current: { user_id: 1, role } });
  assert.ok(!listed.some((n) => n.type === RowMenu));
  assert.equal(
    listed.filter((n) => n.props["data-expense-row"]).length,
    7,
    "Every role can open every group expense",
  );
}

// Personal: private expenses and money lent.
const privateModule = load(
  "src/components/features/expenses/personal-expenses.tsx",
  pageMocks,
  pageGlobals,
);
const loanApi = {
  pending: false,
  error: null,
  reset() {},
  saveTransaction: async () => inn,
  remove: async () => true,
};
const privateProps = {
  ...viewProps,
  current: { user_id: 1, role: "member" },
  headingRef: { current: null },
  onModeChange() {},
  expenses: privateExpenses,
  ledger: {
    ...loanLedgerShape,
    loans: loanLedgerShape.loans.map((l) => ({ ...l, created_by_user_id: 1 })),
  },
  activities: [resort],
  activitiesError: false,
  currencies,
  api: personalApi,
  loans: loanApi,
  filter: "all",
  setFilter() {},
};
const privateTree = (props = privateProps) =>
  nodes(render(privateModule.PersonalExpenses, props));
const openRow = (key) =>
  privateTree()
    .find((n) => n.props["data-expense-row"] === key)
    .props.onClick();
states = [];
refs = [];
openRow("expense-1");
let detailNode = privateTree().find((n) => n.type === PersonalDetails);
assert.equal(detailNode.props.record.id, 1);
detailNode.props.onEdit();
let personalForm = privateTree().find((n) => n.type === PersonalForm);
assert.equal(personalForm.props.record.version, 1);
const personalFormKey = personalForm.key;
const personalSaves = [];
personalApi.save = async (...args) => {
  personalSaves.push(args);
  throw new ApiError(409, "Changed");
};
await assert.rejects(
  personalForm.props.onSave({ description: "Mine" }),
  /Changed/,
);
assert.ok(
  privateTree().some((n) => n.type === PersonalForm),
  "A conflict keeps the form open",
);
personalApi.get = async () => ({ ...privateExpenses[0], version: 5 });
await privateTree()
  .find((n) => n.type === PersonalForm)
  .props.onReload();
personalForm = privateTree().find((n) => n.type === PersonalForm);
assert.equal(
  personalForm.key,
  personalFormKey,
  "Reloading keeps the same form, so typed values survive",
);
personalApi.save = async (...args) => {
  personalSaves.push(args);
  return privateExpenses[0];
};
await personalForm.props.onSave({ description: "Mine" });
assert.equal(
  personalSaves[1][1].version,
  5,
  "The retry carries the new version",
);
assert.equal(personalSaves[0][2], personalSaves[1][2]);
assert.ok(!privateTree().some((n) => n.type === PersonalForm));
detailNode = privateTree().find((n) => n.type === PersonalDetails);
detailNode.props.onDelete();
let removal = privateTree().find((n) => n.type === ConfirmRemoval);
assert.match(removal.props.summary, /Private 1 · ₱180/);
personalApi.remove = async () => {
  throw new ApiError(503, "Offline");
};
await assert.rejects(removal.props.onConfirm(), /Offline/);
assert.ok(privateTree().some((n) => n.type === ConfirmRemoval));
const privateRemovals = [];
personalApi.remove = async (record) => {
  privateRemovals.push(record.id);
  return true;
};
await privateTree()
  .find((n) => n.type === ConfirmRemoval)
  .props.onConfirm();
assert.equal(privateRemovals.join(), "1");
assert.ok(!privateTree().some((n) => n.type === ConfirmRemoval));
assert.ok(!privateTree().some((n) => n.type === PersonalDetails));
openRow("loan-1");
let loanNode = privateTree().find((n) => n.type === LoanDrawer);
assert.equal(loanNode.props.canReceive, true);
assert.equal(loanNode.props.canRemove, true);
loanNode.props.onReceive();
let receiving = privateTree().find((n) => n.type === ReceiveDialog);
assert.equal(receiving.props.debt.loan_id, 1);
assert.equal(receiving.props.debt.amount_minor, "15000");
receiving.props.close();
loanNode = privateTree({
  ...privateProps,
  current: { user_id: 1, role: "viewer" },
}).find((n) => n.type === LoanDrawer);
assert.equal(loanNode.props.canReceive, false, "Viewers keep read-only loans");
assert.equal(loanNode.props.canRemove, false);
loanNode = privateTree({
  ...privateProps,
  ledger: loanLedgerShape,
}).find((n) => n.type === LoanDrawer);
assert.equal(
  loanNode.props.canRemove,
  false,
  "A member cannot remove a loan someone else recorded",
);
privateTree()
  .find((n) =>
    React.Children.toArray(n.props.children).includes("Money I lent"),
  )
  .props.onClick();
let lendDialog = privateTree().find((n) => n.type === EditorDialog);
assert.equal(lendDialog.props.editing.type, "loan");
assert.equal(lendDialog.props.pickActivities.length, 1);
await assert.rejects(
  lendDialog.props.save({ from_user_id: 2 }),
  /money you personally lent/,
);
const lendKeys = [];
loanApi.saveTransaction = async (kind, _input, _record, key) => {
  lendKeys.push([kind, key]);
  return inn;
};
await lendDialog.props.save({ from_user_id: 1 });
assert.equal(lendKeys[0][0], "expense_loans");
assert.equal(
  privateTree().find((n) => n.type === EditorDialog).props.editing,
  null,
);
console.log(
  "Group and Personal modes, filters, roles, failures, retries, conflicts and permission changes passed.",
);

// The real personal form keeps what was typed through failures and conflicts.
const personalFormModule = load(
  "src/components/features/expenses/dialogs/personal-expense-dialog.tsx",
  {
    ...viewMocks,
    react: {
      ...formReact,
      useId: () => "personal",
    },
    "@/components/features/expenses/activity-picker": {
      ActivityPicker: () => null,
    },
    "@/components/shared/trip-dialog": {
      TripDialog: ({ children, footer }) =>
        React.createElement("div", null, children, footer),
    },
  },
  viewGlobals,
);
let personalSaved,
  personalFailure = null;
const personalFormProps = {
  activities: [resort],
  activitiesError: false,
  currencies,
  zone: "Asia/Manila",
  pending: false,
  finalFocus: () => null,
  onClose() {},
  async onSave(value) {
    if (personalFailure) throw personalFailure;
    personalSaved = value;
  },
};
const personalFormTree = (extra = {}) =>
  render(personalFormModule.PersonalExpenseDialog, {
    ...personalFormProps,
    ...extra,
  });
const submitPersonal = async (extra) => {
  await nodes(personalFormTree(extra))
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {}, stopPropagation() {} });
  return renderToStaticMarkup(personalFormTree(extra));
};
states = [];
refs = [];
assert.match(await submitPersonal(), /Name this expense/);
nodes(personalFormTree())
  .find((n) => n.props.id === "personal-name")
  .props.onChange({ target: { value: " Coffee " } });
assert.match(await submitPersonal(), /Enter an amount/);
const setPersonalAmount = (value) =>
  nodes(personalFormTree())
    .find((n) => n.props.id === "personal-amount" && n.props.onChange)
    .props.onChange({ target: { value } });
for (const [value, message] of [
  ["0", /positive amount/],
  ["1.234", /2 decimal places/],
  ["abc", /digits and a decimal point/],
  ["92233720368547758.08", /too large/],
]) {
  setPersonalAmount(value);
  assert.match(await submitPersonal(), message);
}
assert.equal(personalSaved, undefined);
setPersonalAmount("1,180.50");
personalFailure = new ApiError(503, "Offline");
html = await submitPersonal();
assert.match(html, /Offline/);
assert.match(html, /Coffee/);
assert.match(html, /1,180\.50/);
personalFailure = new ApiError(409, "Changed elsewhere");
let reloads = 0;
const reloadable = { onReload: async () => void reloads++ };
html = await submitPersonal(reloadable);
assert.match(html, /Reload latest expense/);
await nodes(personalFormTree(reloadable))
  .find((n) => n.props.children === "Reload latest expense")
  .props.onClick();
html = renderToStaticMarkup(personalFormTree(reloadable));
assert.equal(reloads, 1);
assert.match(html, /What you typed is kept/);
assert.match(html, /1,180\.50/);
personalFailure = null;
await submitPersonal(reloadable);
assert.equal(personalSaved.amount_minor, "118050");
assert.equal(personalSaved.activity_id, undefined);
assert.ok(!("shares" in personalSaved) && !("payer_user_id" in personalSaved));
// An activity deleted since is not resent, so the saved title survives.
states = [];
refs = [];
const orphan = { record: { ...privateExpenses[0], activity_id: 404 } };
await submitPersonal(orphan);
assert.equal(personalSaved.activity_id, undefined);
states = [];
refs = [];
await submitPersonal({ ...orphan, activities: [], activitiesError: true });
assert.equal(
  personalSaved.activity_id,
  404,
  "A failed activity list never clears a saved activity",
);
let releasePersonal,
  personalCalls = 0;
states = [];
refs = [];
const slowForm = {
  record: privateExpenses[0],
  onSave: () => {
    personalCalls++;
    return new Promise((resolve) => {
      releasePersonal = resolve;
    });
  },
};
const slowSubmit = nodes(personalFormTree(slowForm)).find(
  (n) => n.type === "form",
);
const submitEvent = { preventDefault() {}, stopPropagation() {} };
const firstSubmit = slowSubmit.props.onSubmit(submitEvent);
await slowSubmit.props.onSubmit(submitEvent);
assert.equal(personalCalls, 1, "Rapid submits save once");
releasePersonal();
await firstSubmit;

// The hook sends only private fields and keeps its key and version rules.
const personalCallsMade = [];
let personalResponse = () => privateExpenses[0];
const invalidated = [];
const toasts = [];
const personalHook = load("src/lib/personal-expenses.ts", {
  react: { ...formReact, useCallback: (fn) => fn },
  "@tanstack/react-query": {
    useQueryClient: () => ({
      invalidateQueries: async ({ queryKey }) =>
        invalidated.push(queryKey.join()),
    }),
  },
  sonner: { toast: { success: (text) => toasts.push(text) } },
  "@/lib/api": {
    ApiError,
    useApi:
      () =>
      async (path, init = {}) => {
        personalCallsMade.push([init.method ?? "GET", path, init]);
        return personalResponse(path, init);
      },
  },
});
const privateAccessFailures = [];
states = [];
refs = [];
const hook = render(
  () =>
    personalHook.usePersonalExpensesApi(7, (error) =>
      privateAccessFailures.push(error.status),
    ),
  {},
);
await hook.save(
  {
    description: " Coffee ",
    currency: "PHP",
    amount_minor: "1",
    incurred_on: "2026-11-01",
    activity_id: 0,
    created_by_user_id: 9,
    shares: [],
  },
  undefined,
  "key-1",
);
assert.equal(personalCallsMade[0][1], "/api/v1/trips/7/personal-expenses");
assert.equal(personalCallsMade[0][2].headers["Idempotency-Key"], "key-1");
assert.equal(
  personalCallsMade[0][2].body,
  '{"description":"Coffee","currency":"PHP","amount_minor":"1","incurred_on":"2026-11-01"}',
);
assert.ok(
  invalidated.every((key) => key === "trip,7,personal-expenses"),
  "Private writes never touch the shared ledger cache",
);
await hook.save(
  privateExpenses[0],
  { ...privateExpenses[0], version: 4 },
  "key-2",
);
assert.equal(personalCallsMade[1][0], "PUT");
assert.equal(JSON.parse(personalCallsMade[1][2].body).version, 4);
personalResponse = () => undefined;
await hook.remove({ ...privateExpenses[0], version: 6 });
assert.equal(
  personalCallsMade[2][1],
  "/api/v1/trips/7/personal-expenses/1?version=6",
);
assert.equal(
  toasts.join(),
  "Personal expense saved.,Personal expense saved.,Personal expense deleted.",
);
for (const [status, refreshed, denied] of [
  [404, 1, 0],
  [409, 1, 0],
  [403, 1, 1],
  [503, 0, 0],
]) {
  invalidated.length = privateAccessFailures.length = 0;
  personalResponse = () => {
    throw new ApiError(status, "No");
  };
  await assert.rejects(hook.remove(privateExpenses[0]), /No/);
  assert.equal(invalidated.length, refreshed, `${status} refresh`);
  assert.equal(privateAccessFailures.length, denied, `${status} access`);
}
personalResponse = () => {
  throw new TypeError("Failed to fetch");
};
await assert.rejects(
  hook.save(privateExpenses[0], undefined, "key-3"),
  /may have completed/,
);
personalResponse = (path) =>
  path.endsWith("offset=0")
    ? Array.from({ length: 100 }, (_, id) => privateExpense(id + 1))
    : [privateExpense(101)];
assert.equal((await hook.list()).length, 101, "Every page is loaded");
console.log(
  "Private expense form, conflicts, retries, pagination and cache isolation passed.",
);

// Details and history keep their own restrictions.
const loanDetailsModule = load(
  "src/components/features/expenses/drawers/loan-details.tsx",
  {
    ...viewMocks,
    "@/components/shared/trip-dialog": {
      TripDialog: ({ children, footer }) =>
        React.createElement("div", null, children, footer),
    },
  },
);
const loanDetailProps = {
  loan: loanLedgerShape.loans[0],
  ledger: loanLedgerShape,
  activities: [resort],
  name: (id) => `P${id}`,
  money: money.moneyIn(currencies),
  canReceive: true,
  canRemove: true,
  pending: false,
  onReceive() {},
  onRemove() {},
  onBack() {},
  finalFocus: () => null,
};
const loanHtml = (extra) =>
  renderToStaticMarkup(
    render(loanDetailsModule.LoanDetails, { ...loanDetailProps, ...extra }),
  );
html = loanHtml({});
assert.match(html, /Left to get back<\/dt><dd[^>]*>₱150</);
assert.match(html, /P2 paid you/);
assert.match(html, /Record repayment/);
assert.doesNotMatch(html, />Remove</, "Repaid loans cannot be removed");
html = loanHtml({ loan: loanLedgerShape.loans[1] });
assert.match(html, />Remove</);
assert.match(html, /No repayments yet/);
html = loanHtml({ canReceive: false, canRemove: false });
assert.doesNotMatch(html, /Record repayment|>Remove</);

viewData = {
  ...loanLedgerShape,
  settlements: [
    ...loanLedgerShape.settlements,
    {
      id: 10,
      currency: "PHP",
      amount_minor: "700",
      paid_on: "2026-11-01",
      from_user_id: 2,
      to_user_id: 1,
    },
  ],
  reversed_settlements: [
    { ...loanLedgerShape.settlements[0], id: 11, amount_minor: "800" },
  ],
};
const historyHtml = (user_id, role) => {
  states = [];
  refs = [];
  return renderToStaticMarkup(
    render(activityView.ActivityExpenses, {
      ...viewProps,
      active: true,
      activityID: "",
      activityTitle: "Balances and history",
      view: "history",
      current: { user_id, role },
    }),
  );
};
html = historyHtml(2, "member");
assert.match(html, /Money you borrowed/);
assert.match(html, /₱150 to repay/);
assert.match(html, /Repayment history/);
assert.match(html, /Receipt history/);
assert.match(html, /awaiting association/, "Legacy receipts stay reachable");
assert.match(html, /Reversed receipt/);
assert.doesNotMatch(html, /Associate existing receipt|Correct receipt/);
html = historyHtml(1, "member");
assert.match(html, /Reimbursements owed to you/);
assert.match(html, />Mark paid</);
assert.match(html, /Correct receipt/, "Recipients correct their own receipts");
html = historyHtml(1, "viewer");
assert.doesNotMatch(html, />Mark paid<|Correct receipt/);
assert.match(html, /Read-only access/);
assert.match(historyHtml(5, "editor"), /Associate existing receipt/);
assert.doesNotMatch(historyHtml(5, "editor"), /Add expense|Add borrow/);
viewData = data;
console.log(
  "Loan details, borrowed money, reimbursements and retained history passed.",
);

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
  "src/components/features/expenses/drawers/cost-editor/expense-cost-editor.tsx",
  {
    "@/components/features/expenses/expense-fields": {
      ExpensePriceField: wrap("input"),
    },
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
    "@/components/shared/trip-dialog": {
      TripDialog: ({ children }) => children,
    },
    "@/components/features/expenses/expense-forms": { ExpenseSelect },
    "@/components/shared/trip-states": { TripError },
  },
  {
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
// The Split row opens the members step; its link leads to custom amounts.
const openCustom = () => {
  find(costTree(), "expense-split").props.onClick();
  if (costTree().props.title === "Who is included?")
    nodes(costTree())
      .find((n) => n.props.children === "Split with custom amounts")
      .props.onClick();
};
const submitCost = () =>
  nodes(costTree())
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {}, stopPropagation() {} });
states = [];
refs = [];
const costMarkup = renderToStaticMarkup(costTree());
assert.match(costMarkup, /Group price/);
assert.doesNotMatch(costMarkup, /Group price ·/);
// Figma: a centered dialog (bottom sheet on mobile), not the side drawer.
assert.equal(costTree().props.presentation, undefined);
assert.equal(costTree().props.mobilePresentation, "sheet");
assert.match(costTree().props.description, /^Resort day · \w+day, \w+ \d+$/);
find(costTree(), "expense-split").props.onClick();
assert.equal(costTree().props.title, "Who is included?");
assert.equal(costTree().props.description, "All 5 members");
states = [];
refs = [];
assert.equal(
  find(costTree(), "expense-coverer").props["aria-labelledby"],
  "expense-coverer-label expense-coverer",
  "Step controls announce their question and current value",
);
for (const id of ["expense-name", "expense-price"])
  assert.match(
    nodes(costTree()).find((n) => n.props.htmlFor === id).props.className,
    /after:content-\['\*'\]/,
    "Required expense fields are marked",
  );
// An activity's first expense starts with the activity name, selected so
// typing replaces it; once edited, focusing no longer selects.
states = [];
refs = [];
{
  const named = () =>
    find(
      render(approved.ExpenseCostEditor, {
        ...approvedProps,
        defaultName: "Resort day",
      }),
      "expense-name",
    );
  assert.equal(named().props.value, "Resort day");
  let selections = 0;
  named().props.onFocus({ target: { select: () => selections++ } });
  assert.equal(selections, 1);
  named().props.onChange({ target: { value: "Resort day pass" } });
  assert.equal(named().props.onFocus, undefined);
}

// Activity drafts stage plans; only direct expense saves record a reservation.
{
  const { ActivityExpenseDrafts } = load(
    "src/components/features/expenses/activity-expense-drafts.tsx",
    viewMocks,
    viewGlobals,
  );
  const draftProps = {
    tripID: 7,
    title: "Resort day",
    zone: "Asia/Manila",
    people,
    changes: [],
    onChange() {},
    pending: false,
  };
  states = [];
  refs = [];
  const draft = () => render(ActivityExpenseDrafts, draftProps);
  nodes(draft())
    .find((n) => n.props["aria-label"] === "Add expense")
    .props.onClick({ currentTarget: null });
  const editor = nodes(draft()).find((n) => n.type === CostEditor);
  assert.equal(editor.props.recordsPayment, false);
  for (const recordsPayment of [false, true]) {
    states = [];
    refs = [];
    const edit = () =>
      render(approved.ExpenseCostEditor, { ...editor.props, recordsPayment });
    find(edit(), "expense-price").props.onChange({ target: { value: "100" } });
    find(edit(), "expense-coverer").props.onClick();
    nodes(edit())
      .find((n) => n.props.label === "Who will pay first?")
      .props.onChange("1");
    const html = renderToStaticMarkup(edit());
    assert.match(
      html,
      recordsPayment
        ? /Recorded as paid to the business when you save/
        : /A plan, not a payment/,
    );
  }
}
states = [];
refs = [];
saved = undefined;
find(costTree(), "expense-name").props.onChange({ target: { value: "Inn" } });
find(costTree(), "expense-price").props.onChange({ target: { value: "4000" } });
assert.match(renderToStaticMarkup(costTree()), /₱800 each · 5 people/);
assert.match(renderToStaticMarkup(costTree()), /Evenly among 5 people/);
assert.match(renderToStaticMarkup(costTree()), /Decide later/);
openCustom();
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
openCustom();
assert.equal(costTree().props.title, "Who is included?");
assert.ok(stepError() instanceof ApiError);
assert.match(stepError().message, /Enter a valid price/);
assert.equal(focusedErrors, 1);
costTree().props.onOpenChange(false);
assert.equal(costTree().props.title, "Add expense");
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
const openSplit = openCustom;
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
// The split status sits in the body, under the amounts.
const footerText = () => renderToStaticMarkup(costTree());
const splitStatus = () =>
  nodes(costTree()).find((n) => "data-balanced" in n.props).props[
    "data-balanced"
  ];
const balanceButton = () =>
  nodes(costTree()).find((n) =>
    /^(Split|Give) the remaining/.test(n.props.children),
  );
// Group total comes first in the toggle, Per person second.
const perPersonRadio = () =>
  nodes(costTree()).filter(
    (n) => n.props.type === "radio" && n.props.name === "expense-basis",
  )[1];
const memberBoxes = () =>
  nodes(costTree()).filter((n) => n.props.type === "checkbox");
const changeSplitButton = () => find(costTree(), "expense-split");
const savedShares = () =>
  JSON.stringify(saved.shares.map((s) => s.amount_minor));

const splitFailures = [];
async function splitScenario(name, run) {
  states = [];
  refs = [];
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
  dismiss();
  assert.equal(stepTitle(), "Add expense");
  assert.equal(editorsClosed, 0, "Back must not close the whole expense");
  assert.equal(find(costTree(), "expense-name").props.value, "Inn");
  assert.equal(find(costTree(), "expense-price").props.value, "4000");
});
await splitScenario("Back after typing discards the amounts", () => {
  startSplit();
  typeShare(1, "2000");
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
  openSplit();
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
  assert.match(costTree().props.description, /Inn · ₱2,000/);
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
  // Figma: Reset to even sits in the body above the amounts, inside the
  // form's fieldset, so it is disabled while saving like the amounts.
  const reset = () =>
    nodes(costTree()).find((n) => n.props.children === "Reset to even");
  assert.ok(!reset(), "Only the custom step offers reset");
  startSplit();
  assert.ok(!nodes(costTree()).some((n) => n.props.label === "Split"));
  assert.ok(reset());
  typeShare(1, "1");
  reset().props.onClick();
  assert.equal(
    shareValues(),
    JSON.stringify(["800.00", "800.00", "800.00", "800.00", "800.00"]),
  );
  assert.equal(stepTitle(), "Custom split");
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
  changeSplitButton().props.onClick();
  memberBoxes()[4].props.onChange({ target: { checked: false } });
  await submitCost();
  openSplit();
  await submitCost();
  assert.equal(stepTitle(), "Add expense");
  changeSplitButton().props.onClick();
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

const readingFields = load(
  "src/components/features/expenses/expense-fields.tsx",
  {
    "@/components/ui/input": { Input: wrap("input") },
    "@/lib/money": money,
  },
);
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
perPersonRadio().props.onChange();
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
let previewQuery, paymentPreview, previewFailure;
const paymentWrites = new Map();
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
  "src/components/features/expenses/drawers/payment-workspace/expense-payment-workspace.tsx",
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
        return { data: paymentPreview, error: previewFailure };
      },
    },
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/label": { Label: wrap("label") },
    "@/components/features/expenses/expense-fields": {
      ExpensePriceField: wrap("input"),
      ExpenseDateField: wrap("input"),
    },
    "@/components/features/expenses/expense-forms": { ExpenseSelect },
    "@/components/shared/trip-dialog": {
      TripDialog: ({ children }) => children,
    },
    "@/components/shared/trip-states": { TripError },
    "@/components/shared/options-menu": { OptionsMenu: () => null },
  },
  { crypto, document: { activeElement: null } },
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
// The workspace renders the payments drawer, then the payment modal over it.
// Tapping a member row opens their payment modal straight away; there is no
// member-detail screen and no "Update a payment" picker.
tree = render(paymentModule.ExpensePaymentWorkspace, workspaceProps);
assert.equal(
  nodes([tree.props.children].flat()[0].props.footer).some(
    (n) => n.props.children === "Update a payment",
  ),
  false,
);
const memberRow = (id) =>
  nodes(tree).find((n) =>
    n.props["aria-label"]?.startsWith(`View Person ${id}’s`),
  );
const openModal = (id) => {
  tree = render(paymentModule.ExpensePaymentWorkspace, workspaceProps);
  memberRow(id).props.onClick();
  return [
    render(paymentModule.ExpensePaymentWorkspace, workspaceProps).props
      .children,
  ].flat()[1];
};
// A fully paid member's modal shows progress, their payments and only Done.
const paidElement = openModal(1);
states = [];
refs = [];
tree = render(paidElement.type, paidElement.props);
let modalHtml = renderToStaticMarkup(tree);
assert.match(modalHtml, /₱800 of ₱800 paid/);
assert.doesNotMatch(modalHtml, /To pay/);
assert.match(modalHtml, />Paid</);
assert.deepEqual(
  nodes(tree.props.footer)
    .map((n) => n.props.children)
    .filter((c) => typeof c === "string"),
  ["Done"],
);
states = [];
refs = [];
const memberElement = openModal(3);
assert.ok(memberElement, "Tapping a member opens their payment modal");
const memberModal = (overrides = {}) => {
  const props = { ...memberElement.props, ...overrides };
  return () => render(memberElement.type, props);
};
const rowAction = (t, label) =>
  nodes(t).find((n) => n.props["aria-label"]?.startsWith(label));
const submitInline = async (t) => {
  nodes(t)
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {}, stopPropagation() {} });
  await new Promise((resolve) => setImmediate(resolve));
};
const withMember3 = (changes) => ({
  ...paymentStatus,
  members: paymentStatus.members.map((m) =>
    m.user_id === 3 ? { ...m, ...changes } : m,
  ),
});

// Each debt is its own row. The recipient marks a reimbursement received;
// the full amount is filled in and no business preview is involved.
states = [];
refs = [];
let memberView = memberModal();
modalHtml = renderToStaticMarkup(memberView());
assert.match(modalHtml, /To pay/);
assert.equal(
  rowAction(memberView(), "Mark paid"),
  undefined,
  "No business debt",
);
rowAction(memberView(), "Mark received").props.onClick();
assert.equal(find(memberView(), "payment-amount").props.value, "50.00");
// The ocean card becomes the amount entry for that payee.
assert.match(renderToStaticMarkup(memberView()), /To Person 1/);
assert.match(renderToStaticMarkup(memberView()), /Paid today · change/);
find(memberView(), "payment-amount").props.onChange({ target: { value: "0" } });
assert.match(renderToStaticMarkup(memberView()), /Enter a positive amount/);
find(memberView(), "payment-amount").props.onChange({
  target: { value: "60" },
});
assert.match(renderToStaticMarkup(memberView()), /Enter at most ₱50/);
console.log(
  "Member payment rows, recipient-only receipts and amount limits passed.",
);

// Business share: an editor marks it paid as a member payment.
{
  const calls = [];
  const saved = { saveTransaction: paymentApi.saveTransaction };
  paymentApi.saveTransaction = async (...args) => (calls.push(args), { id: 1 });
  const businessOnly = withMember3({
    business_remaining_minor: "30000",
    remaining_minor: "30000",
    reimbursements: [],
  });
  states = [];
  refs = [];
  memberView = memberModal({ status: businessOnly });
  assert.equal(find(memberView(), "payment-amount").props.value, "300.00");
  assert.equal(
    calls.length,
    0,
    "Opening the sole business payment never saves it",
  );
  await submitInline(memberView());
  assert.equal(calls.at(-1)[1].amount_minor, "30000");
  for (const role of ["member", "viewer"]) {
    states = [];
    refs = [];
    memberView = memberModal({
      status: businessOnly,
      current: { user_id: 3, role },
    });
    assert.equal(
      find(memberView(), "payment-amount"),
      undefined,
      "Read-only business payments never auto-open",
    );
  }
  states = [];
  refs = [];
  memberView = memberModal({
    status: withMember3({
      business_remaining_minor: "75000",
      remaining_minor: "80000",
    }),
  });
  rowAction(memberView(), "Mark paid").props.onClick();
  assert.equal(find(memberView(), "payment-amount").props.value, "750.00");
  await submitInline(memberView());
  const [kind, input] = calls.at(-1);
  assert.equal(kind, "expense_payments");
  assert.equal(input.payer_user_id, 3);
  assert.equal(input.member_user_id, 3);
  assert.equal(input.amount_minor, "75000");
  Object.assign(paymentApi, saved);
}

// An editor who didn't receive the reimbursement can't confirm it.
states = [];
refs = [];
memberView = memberModal({ current: { user_id: 4, role: "owner" } });
assert.equal(rowAction(memberView(), "Mark received"), undefined);
assert.match(
  renderToStaticMarkup(memberView()),
  /Reservation · Person 1 confirms/,
);

// A lost response keeps its key: retrying the same payment resolves it, and an
// edited retry is refused instead of writing twice.
states = [];
refs = [];
paymentWrites.clear();
memberView = memberModal();
rowAction(memberView(), "Mark received").props.onClick();
find(memberView(), "payment-amount").props.onChange({
  target: { value: "25.00" },
});
await submitInline(memberView());
assert.equal(paymentWrites.size, 1);
assert.ok(
  nodes(memberView()).some((n) => n.type === TripError),
  "A lost response is shown and the row stays open",
);
find(memberView(), "payment-amount").props.onChange({
  target: { value: "20.00" },
});
await submitInline(memberView());
assert.equal(paymentWrites.size, 1, "An edited retry must not write twice");
assert.ok(nodes(memberView()).some((n) => n.props.error?.status === 409));
find(memberView(), "payment-amount").props.onChange({
  target: { value: "25.00" },
});
await submitInline(memberView());
assert.equal(paymentWrites.size, 1);
assert.doesNotMatch(renderToStaticMarkup(memberView()), /Changed submission/);
console.log("Member payments keep submission keys across retries.");

// Recorded payments can be changed or undone from the ⋯ menu.
{
  const calls = [];
  const saved = {
    remove: paymentApi.remove,
    saveTransaction: paymentApi.saveTransaction,
    saveSettlement: paymentApi.saveSettlement,
  };
  paymentApi.remove = async (...args) => (
    calls.push(["remove", ...args]),
    true
  );
  paymentApi.saveTransaction = async (...args) => (
    calls.push(["transaction", ...args]),
    { id: 1 }
  );
  paymentApi.saveSettlement = async (...args) => (
    calls.push(["settlement", ...args]),
    { id: 1 }
  );
  const payment = {
    ...paymentStatus.payments[0],
    version: 3,
    paid_on: "2026-10-01",
  };
  const receipt = {
    id: 50,
    version: 2,
    payment_id: payment.id,
    from_user_id: 3,
    to_user_id: 1,
    currency: "PHP",
    amount_minor: "2500",
    paid_on: "2026-10-02",
  };
  const modal = (user, status, current = workspaceProps.current) => {
    const props = {
      ...paidElement.props,
      user,
      status: { ...paymentStatus, payments: [payment], ...status },
      current,
    };
    return () => render(paidElement.type, props);
  };
  const menu = (t, what) =>
    nodes(t).find((n) => n.props.items && n.props.name?.includes(what));
  const pick = (t, what, label) =>
    menu(t, what)
      .props.items.find((i) => i.label === label)
      .onClick();

  // Undo a business payment: confirm on the row, no reason needed.
  states = [];
  refs = [];
  let row = modal(1, {});
  pick(row(), "to Inn", "Undo");
  assert.match(renderToStaticMarkup(row()), /Undo · to Inn/);
  assert.match(renderToStaticMarkup(row()), /Balances update right away/);
  await submitInline(row());
  assert.deepEqual(calls.at(-1).slice(0, 3), [
    "remove",
    "expense_payments",
    payment,
  ]);
  assert.equal(calls.at(-1)[3], undefined);

  // A date correction must keep a payment made specifically for someone else.
  const forSomeoneElse = {
    ...payment,
    amount_minor: "10000",
    allocations: [{ user_id: 3, amount_minor: "10000" }],
  };
  states = [];
  refs = [];
  row = modal(1, { payments: [forSomeoneElse] });
  pick(row(), "to Inn", "Change");
  nodes(row())
    .find((n) => n.props["aria-label"]?.startsWith("Date paid:"))
    .props.onClick();
  find(row(), "payment-date").props.onChange({
    target: { value: "2026-10-02" },
  });
  await submitInline(row());
  assert.equal(
    JSON.stringify(calls.at(-1)[2].allocations),
    JSON.stringify(forSomeoneElse.allocations),
    "Correcting a date must not apply someone else's coverage to the payer",
  );
  assert.equal(calls.at(-1)[2].paid_on, "2026-10-02");

  // A zero allocation to another member's credit must not block a correction.
  states = [];
  refs = [];
  row = modal(1, {
    payments: [
      forSomeoneElse,
      {
        ...payment,
        id: 99,
        allocations: [{ user_id: 1, amount_minor: "90000" }],
      },
    ],
  });
  pick(row(), "to Inn", "Change");
  const beforeCreditCorrection = calls.length;
  await submitInline(row());
  assert.equal(calls.length, beforeCreditCorrection + 1);

  // Change a business payment: amount and date pre-filled, saved with version.
  states = [];
  refs = [];
  row = modal(1, {});
  pick(row(), "to Inn", "Change");
  assert.equal(find(row(), "payment-amount").props.value, "1000.00");
  find(row(), "payment-amount").props.onChange({ target: { value: "900" } });
  const writesBeforeCoverage = calls.length;
  await submitInline(row());
  assert.equal(
    calls.length,
    writesBeforeCoverage,
    "Changing an amount requires matching coverage",
  );
  assert.match(
    renderToStaticMarkup(row()),
    /Coverage amounts must equal the payment/,
  );
  // Explicitly choose the API's own-share-first allocation for the new amount.
  nodes(row())
    .find((n) => n.props.setManual)
    .props.setManual(false);
  await submitInline(row());
  const [, kind, input, record] = calls.at(-1);
  assert.equal(kind, "expense_payments");
  assert.equal(record, payment);
  assert.equal(input.version, 3);
  assert.equal(input.amount_minor, "90000");
  assert.equal(input.paid_on, "2026-10-01");
  assert.equal(
    JSON.stringify(input.allocations),
    JSON.stringify(activity.allocatePayment("90000", 1, inn.shares)),
  );

  // A payment with linked repayments is locked until they are undone.
  states = [];
  refs = [];
  row = modal(1, { receipts: [receipt] });
  assert.ok(menu(row(), "to Inn").props.items.every((i) => i.disabled));
  assert.match(renderToStaticMarkup(row()), /Undo the repayments to/);

  // Undoing a reimbursement needs a reason, as the API requires.
  states = [];
  refs = [];
  calls.length = 0;
  row = modal(3, { receipts: [receipt] });
  pick(row(), "to Person 1", "Undo");
  await submitInline(row());
  assert.equal(calls.length, 0, "No reason, no undo");
  find(row(), "payment-reason").props.onChange({
    target: { value: "Entered twice" },
  });
  await submitInline(row());
  assert.deepEqual(calls.at(-1), [
    "remove",
    "settlements",
    receipt,
    "Entered twice",
  ]);

  // Viewers see what was paid but cannot change or undo it.
  states = [];
  refs = [];
  row = modal(1, {}, { user_id: 2, role: "viewer" });
  assert.match(renderToStaticMarkup(row()), /to Inn/);
  assert.equal(menu(row(), "to Inn"), undefined);

  // Undoing the last payment removes a payer who has no share from the status.
  states = [];
  refs = [];
  row = modal(99, { payments: [], receipts: [], members: [] });
  assert.equal(
    row(),
    null,
    "A missing member closes safely instead of crashing",
  );
  Object.assign(paymentApi, saved);
}
console.log(
  "Member payment modal: paid state, change and undo with permissions passed.",
);

// Shared payments remain available without a plan and after a first deposit.
{
  const original = paymentStatus;
  const reservationCard = (cost = inn, current = workspaceProps.current) => {
    states = [];
    refs = [];
    const t = render(paymentModule.ExpensePaymentWorkspace, {
      ...workspaceProps,
      cost,
      current,
    });
    assert.equal([t.props.children].flat()[0].props.footer, undefined);
    return nodes(t).find(
      (n) =>
        n.type === "button" &&
        n.props["aria-label"] === `Record reservation for ${cost.description}`,
    );
  };
  assert.ok(reservationCard({ ...inn, planned_coverer_user_id: undefined }));
  assert.ok(reservationCard({ ...inn, planned_coverer_user_id: 1 }));
  assert.ok(reservationCard(inn, { user_id: 1, role: "editor" }));
  for (const role of ["member", "viewer"]) {
    assert.equal(reservationCard(inn, { user_id: 1, role }), undefined);
  }
  paymentStatus = { ...original, business_remaining_minor: "0" };
  assert.equal(reservationCard(), undefined);
  paymentStatus = { ...original, business_remaining_minor: "-100" };
  assert.equal(reservationCard(), undefined);
  paymentStatus = original;
}

states = [];
refs = [];
paymentPreview = undefined;
const joined = { user_id: 99, display_name: "New participant", email: null };
// The business summary opens the reservation form over the drawer.
const reservationWorkspace = {
  ...workspaceProps,
  cost: {
    ...inn,
    planned_coverer_user_id: 3,
    planned_cover_amount_minor: "20000",
  },
};
tree = render(paymentModule.ExpensePaymentWorkspace, reservationWorkspace);
nodes(tree)
  .find(
    (n) =>
      n.props["aria-label"] === `Record reservation for ${inn.description}`,
  )
  .props.onClick();
const formElement = [
  render(paymentModule.ExpensePaymentWorkspace, reservationWorkspace).props
    .children,
].flat()[1];
const payerProps = {
  ...formElement.props,
  participants: [people[0], people[2], joined],
};
// Reopening after a deposit uses what remains, rather than repeating the deposit.
for (const cost of [
  { ...inn, planned_coverer_user_id: 1, planned_cover_amount_minor: "100000" },
  { ...inn, planned_coverer_user_id: 0, planned_cover_amount_minor: "" },
]) {
  states = [];
  refs = [];
  const t = render(formElement.type, { ...payerProps, cost });
  assert.equal(find(t, "payment-amount").props.value, "3000.00");
  assert.equal(previewQuery.enabled, true);
}
states = [];
refs = [];
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
  assert.equal(find(tree, "cost-payer"), undefined);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Lent by/);
  assert.equal(find(tree, "loan-borrower").props.value, "0");
  assert.equal(find(tree, "cost-activity"), undefined);
  // Figma: Record money lent ends with Date lent.
  assert.ok(find(tree, "cost-date"));
  assert.deepEqual(
    Array.from(find(tree, "loan-borrower").props.options, (p) => p.value),
    ["0", "2", "3"],
  );
  find(tree, "loan-borrower").props.onChange(String(borrower));
  find(tree, "cost-description").props.onChange({ target: { value: "Cash" } });
  find(tree, "cost-amount").props.onChange({ target: { value: amount } });
  tree = render(formModule.ActivityExpenseForm, loanFormProps);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved.amount_minor, `${amount}00`);
  assert.equal(saved.from_user_id, 1);
  assert.equal(saved.to_user_id, borrower);
  for (const invalidBorrower of [0, 1, 5]) {
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
    nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
    role !== "viewer",
  );
}
states = [];
refs = [];
tree = render(view.ActivityExpenses, { ...ownerProps, compact: true });
assert.equal(
  nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
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
  "src/components/features/expenses/personal-payments/personal-payments.tsx",
  {
    react: formReact,
    "@/lib/api": apiMock,
    "@/lib/activity-expenses": activity,
    "@/lib/expenses": { ...ledger, useExpensesApi: () => viewApi },
    "@/lib/money": money,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/features/expenses/activity-expense-form/activity-expense-form":
      formModule,
    "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace":
      {
        ExpensePaymentWorkspace: PaymentWorkspace,
      },
    "@/components/shared/trip-dialog": {
      TripDialog: ({ open, children }) => (open ? children : null),
    },
  },
  {
    crypto: { randomUUID: () => "receipt-key" },
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
assert.match(renderToStaticMarkup(tree), /Record repayment/);
assert.doesNotMatch(renderToStaticMarkup(tree), /Mark as paid/);
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

states = [];
refs = [];
saved = undefined;
const simpleReceiptProps = { ...receiptProps, simpleRepayment: true };
tree = render(formModule.ActivityExpenseForm, simpleReceiptProps);
assert.equal(find(tree, "cost-amount").props.value, "250.00");
html = renderToStaticMarkup(tree);
assert.doesNotMatch(html, /Received only part|Use full amount|cost-currency/);
assert.match(html, /Left to receive:.*?0/);
await tree.props.onSubmit({ preventDefault() {} });
assert.equal(saved.amount_minor, "25000");
for (const value of ["251", "0", "-1", "", "abc", "1.001"]) {
  find(tree, "cost-amount").props.onChange({ target: { value } });
  tree = render(formModule.ActivityExpenseForm, simpleReceiptProps);
  assert.equal(find(tree, "cost-amount").props["aria-invalid"], true);
  assert.ok(nodes(tree).find((n) => n.props.type === "submit").props.disabled);
  assert.match(renderToStaticMarkup(tree), /repayment-error/);
}
assert.match(renderToStaticMarkup(tree), /Left to receive:.*?250/);
find(tree, "cost-amount").props.onChange({ target: { value: "100" } });
tree = render(formModule.ActivityExpenseForm, simpleReceiptProps);
assert.equal(find(tree, "cost-amount").props["aria-invalid"], false);
assert.equal(
  nodes(tree).find((n) => n.props.type === "submit").props.disabled,
  false,
);
assert.match(renderToStaticMarkup(tree), /Left to receive:.*?150/);
await tree.props.onSubmit({ preventDefault() {} });
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
const savedPersonal = personalData;
personalData = [];
query = "mode=personal";
html = htmlOf({ current: { user_id: 1, role: "member" } });
assert.match(html, /Lent to Person 2/);
assert.match(html, /₱250 left/);
assert.match(
  html,
  /Lent, still to get back<\/dt><dd[^>]*>₱600</,
  "Personal adds up money lent to others",
);
assert.match(html, /JPY 25,000/, "Currencies stay separate");
assert.match(
  html,
  /Your personal spend<\/dt><dd[^>]*>₱0</,
  "Loans aren't expenses, so they never count as spending",
);
assert.doesNotMatch(html, /Mark as paid/);
query = "";
assert.match(
  htmlOf({ current: { user_id: 1, role: "member" } }),
  /No group expenses yet/,
  "Loans alone add nothing to Group",
);
personalData = savedPersonal;
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
  nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
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
// The Figma Expenses row: count, total and your share in one tappable card.
assert.match(
  renderToStaticMarkup(tree).replace(/<[^>]+>/g, " "),
  /Expenses\s+\d+ expenses?(?: · \d+ from Prep)?\s+.+ total\s+Your share /,
);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Estimated total|View expenses/,
);
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
  /History and corrections|View payments/,
);
const expenseRow = nodes(tree).find(
  (n) => n.props["aria-label"] === "View Hotel payments",
);
assert.ok(expenseRow, "The expense row opens payments");
assert.equal(
  nodes(expenseRow).filter((n) => n.props.onClick).length,
  1,
  "Each row has one action, without nested buttons",
);
const expenseTrigger = { isConnected: true };
expenseRow.props.onClick({ currentTarget: expenseTrigger });
tree = render(view.ActivityExpenses, { ...flowProps, view: "details" });
const expenseWorkspace = nodes(tree).find((n) => n.type === PaymentWorkspace);
assert.equal(expenseWorkspace.props.finalFocus(), expenseTrigger);
expenseWorkspace.props.onBack();
tree = render(view.ActivityExpenses, { ...flowProps, view: "details" });
assert.equal(
  nodes(tree).some((n) => n.type === PaymentWorkspace),
  false,
);
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
assert.match(renderToStaticMarkup(tree), /2 loans/);
assert.doesNotMatch(renderToStaticMarkup(tree), /history and corrections/i);
assert.ok(
  renderToStaticMarkup(tree).indexOf("Add borrow") <
    renderToStaticMarkup(tree).indexOf("<article"),
  "Add borrow is above the loan rows",
);
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Hotel|My payments|View payments/,
);
for (const role of ["member", "editor", "owner", "viewer"]) {
  tree = finance("loans", { current: { user_id: 1, role } });
  assert.equal(
    nodes(tree).some((n) =>
      React.Children.toArray(n.props.children).includes("Add borrow"),
    ),
    role !== "viewer",
  );
  assert.equal(
    nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
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
assert.doesNotMatch(
  renderToStaticMarkup(tree),
  /Outstanding|history and corrections/i,
);
assert.equal(
  nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
  false,
);
await nodes(tree)
  .find((n) => n.props.children === "Undo repayment")
  .props.onClick({ currentTarget: { isConnected: true, closest: () => null } });
assert.equal(undone[0][0], "settlements");
assert.equal(
  undone[0][1].id,
  41,
  "Undo reverses only the latest active receipt",
);
assert.equal(undone[0][2], "Repayment entered by mistake");
assert.equal(
  nodes(tree).find(
    (n) => n.props.children === "Remove loan (undo repayments first)",
  ).props.disabled,
  true,
  "Loans with active repayments cannot be removed",
);
tree = finance("loans", { current: { user_id: 1, role: "viewer" } });
assert.equal(
  nodes(tree).some((n) => n.props.children === "Undo repayment"),
  false,
);
for (const [amount, status] of [
  ["25000", "Unpaid"],
  ["10000", "Partially paid"],
  ["-1000", "Credit for review"],
]) {
  viewData = {
    ...viewData,
    debts: [{ ...viewData.debts[0], amount_minor: amount }],
  };
  tree = finance("loans");
  assert.match(renderToStaticMarkup(tree), new RegExp(status));
  assert.equal(
    nodes(tree).some((n) => /^Record repayment/.test(n.props.children)),
    BigInt(amount) > 0n,
  );
}
viewData = {
  ...viewData,
  debts: [{ ...viewData.debts[0], amount_minor: "10000" }],
};
viewApi.pending = true;
tree = finance("loans");
for (const label of ["Record repayment", "Undo repayment"])
  assert.equal(
    nodes(tree).find((n) => n.props.children === label).props.disabled,
    true,
  );
viewApi.pending = false;
viewData = { ...viewData, settlements: [] };
tree = finance("loans");
const removeBorrow = nodes(tree).find(
  (n) => n.props.children === "Remove loan",
);
assert.ok(removeBorrow && !removeBorrow.props.disabled);
const removedBefore = undone.length;
let removalConfirmation;
viewGlobals.window.confirm = (message) => {
  removalConfirmation = message;
  return false;
};
await removeBorrow.props.onClick();
assert.match(removalConfirmation, /Remove this loan.*Balances will change/);
assert.equal(
  undone.length,
  removedBefore,
  "Cancel leaves the borrow unchanged",
);
viewGlobals.window.confirm = () => true;
await removeBorrow.props.onClick();
assert.equal(undone.length, removedBefore + 1);
assert.equal(undone.at(-1)[0], "expense_loans");
assert.equal(undone.at(-1)[1].id, loans[0].id);
assert.equal(
  nodes(finance("loans", { current: { user_id: 1, role: "viewer" } })).some(
    (n) => n.props.children === "Remove loan",
  ),
  false,
);
viewData = { ...viewData, loans: [{ ...loans[0], created_by_user_id: 2 }] };
assert.equal(
  nodes(finance("loans", { current: { user_id: 1, role: "member" } })).some(
    (n) => n.props.children === "Remove loan",
  ),
  false,
  "Members cannot remove another person's loan record",
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
assert.equal(
  nodes(tree).some((n) => n.props["aria-label"] === "View Inn payments"),
  false,
  "Settled expenses stay in All expenses instead of repeating below the balance summary",
);
const personalTrigger = { isConnected: true };
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
assert.match(renderToStaticMarkup(tree), /You owe/);
assert.match(renderToStaticMarkup(tree), /Pay to business/);
assert.match(renderToStaticMarkup(tree), /Expense reimbursement/);
nodes(tree)
  .find((n) => n.props["aria-label"] === "View Inn payments")
  .props.onClick({ currentTarget: personalTrigger });
tree = personal({ showExpenses: true, activityID: "1", ledger: paidLedger });
assert.equal(
  nodes(tree).find((n) => n.type === PaymentWorkspace).props.backLabel,
  "Back to My Expenses",
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
assert.doesNotMatch(renderToStaticMarkup(tree), /Owed to me:/);
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

// Shared presentation retains labels, currency, errors and the original input.
const { ExpenseAmountPanel } = load(
  "src/components/features/expenses/expense-amount-panel.tsx",
  { "@/components/ui/label": { Label: wrap("label") } },
);
const panel = ExpenseAmountPanel({
  inputID: "panel-amount",
  label: "Amount paid",
  currency: "JPY",
  required: true,
  children: React.createElement("input", {
    id: "panel-amount",
    value: "invalid",
    readOnly: true,
    "aria-invalid": true,
    "aria-describedby": "panel-error",
  }),
  footer: React.createElement(
    "p",
    { id: "panel-error" },
    "Correct this amount",
  ),
});
const panelMarkup = renderToStaticMarkup(panel);
assert.match(panelMarkup, /for="panel-amount"/);
assert.match(panelMarkup, /<span>JPY<\/span>/);
assert.match(panelMarkup, /aria-invalid="true"/);
assert.match(panelMarkup, /value="invalid"/);
assert.match(panelMarkup, /Correct this amount/);
assert.match(
  renderToStaticMarkup(
    readingFields.ExpensePriceField({
      currency: { code: "JPY", decimals: 0 },
      value: "1000000",
      onChange() {},
    }),
  ),
  /1,000,000/,
);
console.log(
  "Shared money panels preserve accessible labels, invalid drafts, errors and currency precision.",
);

for (const [decimals, placeholder] of [
  [2, "0.00"],
  [0, "0"],
]) {
  const field = readingFields.ExpensePriceField({
    currency: { code: decimals ? "PHP" : "JPY", decimals },
    value: "",
  });
  const input = field.props.children[0];
  assert.equal(input.props.placeholder, placeholder);
  assert.equal(
    input.props.value,
    "",
    "The zero hint must not become an entered amount",
  );
}

// Detached costs stay reachable even when the editor has no share in them.
const detachedCost = {
  ...inn,
  activity_id: undefined,
  activity_name: "",
  prep_task_name: "Book flights",
  shares: [{ user_id: 1, amount_minor: inn.amount_minor }],
};
viewData = {
  ...data,
  expenses: [
    detachedCost,
    {
      ...inn,
      id: 102,
      activity_id: undefined,
      activity_name: "Removed activity",
    },
  ],
  payments: [],
  loans: [],
  settlements: [],
  debts: [],
};
assert.equal(
  activity.personalTotals(viewData, 1, inn.currency, "unassigned").cost,
  BigInt(inn.amount_minor) +
    BigInt(
      inn.shares.find((share) => share.user_id === 1)?.amount_minor ?? "0",
    ),
  "Unassigned totals include costs from removed activities",
);
for (const role of ["owner", "member", "viewer"]) {
  states = [];
  refs = [];
  const overviewProps = {
    ...viewProps,
    active: true,
    current: { user_id: 3, role },
  };
  // Costs outside your shares are ordinary Group rows for every role.
  html = renderToStaticMarkup(render(view.Expenses, overviewProps));
  assert.match(html, /Removed activity \(removed\)/);
  assert.match(html, /From Prep/);
  assert.equal((html.match(/data-expense-row="group-/g) ?? []).length, 2);
  states = [];
  refs = [];
  const unassignedProps = {
    ...overviewProps,
    activityID: "unassigned",
    activityTitle: "Costs without an activity",
  };
  tree = render(view.ActivityExpenses, unassignedProps);
  assert.equal(
    nodes(tree).filter((n) => n.props.children === "View payments").length,
    2,
  );
  const edit = nodes(tree).find(
    (n) => n.props["aria-label"] === "Edit Inn expense",
  );
  if (role !== "owner") {
    assert.equal(
      edit,
      undefined,
      "Members and viewers cannot edit planned costs",
    );
  } else {
    edit.props.onClick();
    tree = render(view.ActivityExpenses, unassignedProps);
    const sharedEditor = nodes(tree).find((n) => n.type === CostEditor);
    assert.ok(
      sharedEditor,
      "Detached task costs use the shared editor instead of requiring an activity",
    );
    assert.equal(sharedEditor.props.activity.id, undefined);
    assert.equal(sharedEditor.props.initial.prep_task_name, "Book flights");
    assert.equal(
      nodes(tree).some((n) => n.type === formModule.ActivityExpenseForm),
      false,
    );
    sharedEditor.props.onBack();
    tree = render(view.ActivityExpenses, unassignedProps);
  }
  nodes(tree)
    .find((n) => n.props.children === "View payments")
    .props.onClick({ currentTarget: {} });
  tree = render(view.ActivityExpenses, unassignedProps);
  const workspace = nodes(tree).find((n) => n.type === PaymentWorkspace);
  assert.equal(workspace.props.cost.id, detachedCost.id);
  assert.equal(workspace.props.current.role, role);
  assert.equal(workspace.props.backLabel, "Back to expenses");
}
console.log(
  "Detached costs remain reachable with editor, member and viewer permissions.",
);

// Both entry points select a record; only the confirmation calls the removal API.
const deletionProps = { ...ownerProps, view: "details" };
const originalRemove = viewApi.remove;
const originalExpenseQuery = viewGlobals.document.querySelector;
const expenseFocusTargets = new Map([
  [inn.id, { isConnected: true, kind: "expense row" }],
  [entrance.id, { isConnected: true, kind: "next expense row" }],
]);
viewGlobals.document.querySelector = (selector) => {
  const match = selector.match(/^\[data-expense-open="(\d+)"\]$/);
  return match
    ? expenseFocusTargets.get(Number(match[1]))
    : { isConnected: true, kind: "hidden action" };
};
let deleted = [];
viewApi.remove = async (kind, record) => {
  deleted.push([kind, record]);
  return true;
};
viewData = {
  ...data,
  expenses: [inn, entrance],
  payments: [],
  loans: [],
  debts: [],
  settlements: [],
};
states = [];
refs = [];
tree = render(view.ActivityExpenses, deletionProps);
const costNode = nodes(tree).find(
  (n) => n.props.cost?.id === inn.id && n.props.requestDelete,
);
costNode.props.requestDelete();
assert.equal(
  deleted.length,
  0,
  "Revealing or requesting Delete never removes a record",
);
tree = render(view.ActivityExpenses, deletionProps);
let deletionDialog = nodes(tree).find(
  (n) => n.type === DeleteExpenseConfirmation,
);
deletionDialog.props.onClose();
assert.equal(
  deletionDialog.props.finalFocus(),
  expenseFocusTargets.get(inn.id),
  "Cancelling must focus the expense, without revealing the hidden mobile ellipsis",
);
tree = render(view.ActivityExpenses, deletionProps);
assert.equal(
  nodes(tree).some((n) => n.type === DeleteExpenseConfirmation),
  false,
);
assert.equal(deleted.length, 0, "Cancel preserves the expense");
nodes(tree)
  .find((n) => n.props.requestDelete)
  .props.requestDelete();
tree = render(view.ActivityExpenses, deletionProps);
deletionDialog = nodes(tree).find((n) => n.type === DeleteExpenseConfirmation);
await deletionDialog.props.onDelete();
assert.equal(
  deletionDialog.props.finalFocus(),
  expenseFocusTargets.get(entrance.id),
  "Deleting must focus the next expense, not its hidden action button",
);
assert.equal(deleted.length, 1);
assert.equal(deleted[0][0], "expenses");
assert.equal(deleted[0][1].version, inn.version);
tree = render(view.ActivityExpenses, deletionProps);
assert.equal(
  nodes(tree).some((n) => n.type === DeleteExpenseConfirmation),
  false,
);

nodes(tree)
  .find((n) => n.props.requestDelete)
  .props.requestDelete();
viewData = {
  ...viewData,
  payments: [{ ...data.payments[0], expense_id: inn.id }],
};
tree = render(view.ActivityExpenses, deletionProps);
deletionDialog = nodes(tree).find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletionDialog.props.hasPayments, true);
await deletionDialog.props.onDelete();
assert.equal(
  deleted.length,
  2,
  "Recorded payments do not block confirmed expense deletion",
);
tree = render(view.ActivityExpenses, deletionProps);
nodes(tree)
  .find((n) => n.props.requestDelete)
  .props.requestDelete();
tree = render(view.ActivityExpenses, {
  ...deletionProps,
  current: { user_id: 3, role: "viewer" },
});
deletionDialog = nodes(tree).find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletionDialog.props.isEditor, false);
await assert.rejects(deletionDialog.props.onDelete(), /permission/);
viewData = { ...viewData, expenses: [], payments: [] };
tree = render(view.ActivityExpenses, deletionProps);
deletionDialog = nodes(tree).find((n) => n.type === DeleteExpenseConfirmation);
assert.equal(deletionDialog.props.available, false);
await assert.rejects(deletionDialog.props.onDelete(), /no longer available/);
viewApi.remove = originalRemove;
viewGlobals.document.querySelector = originalExpenseQuery;

// Exercise the actual gesture handlers without a DOM or a gesture library.
const swipeModule = load(
  "src/components/features/expenses/expense-swipe-row.tsx",
  {
    react: formReact,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/shared/options-menu": { OptionsMenu: () => null },
  },
);
let reveal = false,
  requested = 0,
  editRequested = 0;
const swipeProps = {
  id: 1,
  name: "Inn",
  enabled: true,
  disabled: false,
  open: false,
  onOpenChange: (value) => {
    reveal = value;
  },
  onDelete: () => requested++,
  onEdit: () => editRequested++,
  children: "Expense",
};

// Prep exposes the same row actions, preserving the editor and delete safeguards.
const SwipeActions = () => null;
const prepLib = load("src/lib/prep.ts", viewMocks);
let prepRemoved = 0;
const prepFinance = {
  ...viewApi,
  remove: async () => {
    prepRemoved++;
    return true;
  },
};
const prepCost = { ...inn, prep_task_id: 91 };
let prepLedger = { ...data, expenses: [prepCost] };
const taskDetails = load(
  "src/components/features/prep/drawers/task-details-drawer.tsx",
  {
    ...viewMocks,
    "@/lib/prep": { ...prepLib, usePrepApi: () => ({ pending: false }) },
    "@/components/shared/options-menu": { OptionsMenu: () => null },
    "@/components/features/expenses/expense-swipe-row": {
      ExpenseSwipeRow: SwipeActions,
    },
    "@/components/features/expenses/use-finance": {
      useFinance: () => ({
        api: prepFinance,
        ledger: { data: prepLedger },
        currencies: { data: currencies },
      }),
    },
  },
  viewGlobals,
);
const taskProps = {
  ...ownerProps,
  canEdit: true,
  task: {
    id: 91,
    title: "Book hotel",
    kind: "one_person",
    ready_user_ids: [],
    waiting_user_ids: [],
  },
  onAction() {},
  onOpen() {},
  onClose() {},
  finalFocus: () => null,
};
states = [];
refs = [];
const prepTree = (overrides = {}) =>
  render(taskDetails.TaskDetailsDrawer, { ...taskProps, ...overrides });
const prepActions = () =>
  nodes(prepTree()).find((n) => n.type === SwipeActions);
prepActions().props.onEdit();
assert.equal(
  nodes(prepTree()).find((n) => n.type === CostEditor).props.initial.id,
  prepCost.id,
);
nodes(prepTree())
  .find((n) => n.type === CostEditor)
  .props.onBack();
prepActions().props.onDelete();
assert.equal(prepRemoved, 0, "Prep Delete first opens confirmation");
let prepConfirmation = () =>
  nodes(prepTree()).find((n) => n.type === DeleteExpenseConfirmation);
prepConfirmation().props.onClose();
assert.equal(prepRemoved, 0, "Cancelling keeps the Prep expense");
prepActions().props.onDelete();
await assert.rejects(
  nodes(prepTree({ current: { user_id: 1, role: "member" } }))
    .find((n) => n.type === DeleteExpenseConfirmation)
    .props.onDelete(),
  /owners and editors/,
);
prepLedger = { ...prepLedger, expenses: [] };
assert.equal(prepConfirmation().props.available, false);
await assert.rejects(
  prepConfirmation().props.onDelete(),
  /no longer available/,
);
prepLedger = { ...prepLedger, expenses: [prepCost] };
await prepConfirmation().props.onDelete();
assert.equal(prepRemoved, 1);
assert.equal(prepConfirmation(), undefined);
for (const role of ["member", "viewer"]) {
  states = [];
  refs = [];
  assert.equal(
    nodes(prepTree({ current: { user_id: 1, role } })).find(
      (n) => n.type === SwipeActions,
    ).props.enabled,
    false,
  );
}
console.log(
  "Prep expense edit, delete confirmation, cancellation and permissions passed.",
);

const pointerTarget = { style: {}, setPointerCapture() {} };
const pointer = (x, y = 0) => ({
  pointerId: 1,
  isPrimary: true,
  button: 0,
  clientX: x,
  clientY: y,
  target: { closest: () => null },
  currentTarget: pointerTarget,
});
function dragExpense(x, y = 0, cancel = false) {
  states = [];
  refs = [];
  reveal = false;
  pointerTarget.style = {};
  const row = render(swipeModule.ExpenseSwipeRow, swipeProps);
  const surface = nodes(row).find((n) => n.props.onPointerMove);
  surface.props.onPointerDown(pointer(200));
  surface.props.onPointerMove(pointer(200 + x, y));
  surface.props.onLostPointerCapture({
    target: {},
    currentTarget: pointerTarget,
  });
  surface.props[cancel ? "onPointerCancel" : "onPointerUp"]();
  return row;
}
dragExpense(-200);
assert.equal(reveal, true);
assert.equal(pointerTarget.style.transform, "translateX(-144px)");
assert.equal(requested, 0, "A full swipe only reveals the actions");
assert.equal(editRequested, 0, "A full swipe never opens the editor");
dragExpense(-30);
assert.equal(reveal, false, "A short drag snaps closed");
dragExpense(-80, 100);
assert.equal(reveal, false, "Vertical scrolling never reveals Delete");
dragExpense(-80, 0, true);
assert.equal(
  reveal,
  false,
  "Cancelled pointer capture restores the previous state",
);
states = [];
refs = [];
const openSwipe = render(swipeModule.ExpenseSwipeRow, {
  ...swipeProps,
  open: true,
});
reveal = true;
nodes(openSwipe)
  .find((n) => n.props["aria-label"] === "Actions for Inn")
  .props.onClick();
assert.equal(
  reveal,
  false,
  "Ellipsis closes the revealed action without a menu",
);
assert.equal(requested, 0, "Ellipsis never requests deletion");
states = [];
refs = [];
const closedSwipe = render(swipeModule.ExpenseSwipeRow, swipeProps);
nodes(closedSwipe)
  .find((n) => n.props["aria-label"] === "Actions for Inn")
  .props.onClick();
assert.equal(
  reveal,
  true,
  "Ellipsis reveals the same Edit and Delete actions as swiping",
);
const revealedEdit = nodes(openSwipe).find(
  (n) => n.props["aria-label"] === "Edit Inn",
);
assert.equal(revealedEdit.props.tabIndex, 0);
revealedEdit.props.onClick();
assert.equal(editRequested, 1, "The revealed Edit action opens the editor");
const hiddenEdit = nodes(closedSwipe).find(
  (n) => n.props["aria-label"] === "Edit Inn",
);
assert.equal(hiddenEdit.props.tabIndex, -1);
assert.equal(hiddenEdit.props["aria-hidden"], true);
nodes(openSwipe)
  .find((n) => n.props["aria-label"] === "Delete Inn")
  .props.onClick();
assert.equal(requested, 1, "The revealed action requests confirmation");
states = [];
refs = [];
assert.equal(
  render(swipeModule.ExpenseSwipeRow, { ...swipeProps, enabled: false }),
  "Expense",
);

const alertMocks = Object.fromEntries(
  [
    "AlertDialog",
    "AlertDialogCancel",
    "AlertDialogContent",
    "AlertDialogDescription",
    "AlertDialogFooter",
    "AlertDialogHeader",
    "AlertDialogTitle",
  ].map((name) => [name, wrap("div")]),
);
const deleteModule = load(
  "src/components/features/expenses/dialogs/delete-expense-dialog.tsx",
  {
    react: formReact,
    "@/components/ui/button": { Button: wrap("button") },
    "@/components/ui/alert-dialog": alertMocks,
    "@/components/shared/trip-states": { TripError },
  },
);
let confirms = 0,
  closes = 0,
  releaseDelete;
const confirmProps = {
  cost: inn,
  hasPayments: false,
  isEditor: true,
  available: true,
  pending: false,
  money: (amount) => amount,
  finalFocus: () => null,
  onClose: () => closes++,
  onDelete: async () => {
    confirms++;
    await new Promise((resolve) => {
      releaseDelete = resolve;
    });
  },
};
states = [];
refs = [];
tree = render(deleteModule.DeleteExpenseDialog, confirmProps);
const confirmButton = nodes(tree).find(
  (n) => n.props.children === "Delete expense",
);
const confirming = confirmButton.props.onClick();
await confirmButton.props.onClick();
tree.props.onOpenChange(false);
assert.equal(confirms, 1, "Rapid confirmation clicks submit only once");
assert.equal(closes, 0, "Confirmation cannot be dismissed during submission");
releaseDelete();
await confirming;
for (const blocked of [{ isEditor: false }, { available: false }]) {
  states = [];
  refs = [];
  tree = render(deleteModule.DeleteExpenseDialog, {
    ...confirmProps,
    ...blocked,
  });
  assert.equal(
    nodes(tree).some((n) => n.props.children === "Delete expense"),
    false,
  );
}
states = [];
refs = [];
tree = render(deleteModule.DeleteExpenseDialog, {
  ...confirmProps,
  hasPayments: true,
});
assert.ok(
  nodes(tree).some((n) => n.props.children === "Delete expense"),
  "Paid expenses still offer confirmation",
);
states = [];
refs = [];
const failureProps = {
  ...confirmProps,
  onDelete: async () => {
    throw new ApiError(503, "Offline");
  },
};
tree = render(deleteModule.DeleteExpenseDialog, failureProps);
await nodes(tree)
  .find((n) => n.props.children === "Delete expense")
  .props.onClick();
tree = render(deleteModule.DeleteExpenseDialog, failureProps);
assert.ok(nodes(tree).some((n) => n.props.children === "Try again"));
assert.ok(nodes(tree).some((n) => n.props.error?.message === "Offline"));
console.log(
  "Expense swipe, cancellation, confirmation, duplicate-submit protection, failures, paid expense deletion and permission changes passed.",
);
