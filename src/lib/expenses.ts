"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, useApi } from "@/lib/api";
import type { TripRole } from "@/lib/memberships";

export interface Currency {
  code: string;
  decimals: number;
}
export interface ExpensePerson {
  user_id: number;
  display_name: string;
  email: string | null;
}
export interface Share {
  user_id: number;
  amount_minor: string;
}
export interface ExpenseInput {
  planned_coverer_user_id?: number;
  planned_cover_amount_minor?: string;
  activity_id?: number;
  amount_basis?: "group" | "per_person";
  description: string;
  currency: string;
  amount_minor: string;
  incurred_on: string;
  payer_user_id: number;
  split_mode: "equal" | "exact";
  shares: { user_id: number; amount_minor?: string }[];
  version?: number;
}
export interface SettlementInput {
  correction_reason?: string;
  payment_id?: number;
  loan_id?: number;
  currency: string;
  amount_minor: string;
  paid_on: string;
  from_user_id: number;
  to_user_id: number;
  version?: number;
}
interface RecordBase {
  id: number;
  trip_id: number;
  created_by_user_id: number;
  version: number;
  created_at: string;
  updated_at: string;
  people: ExpensePerson[];
}
export interface Expense extends Omit<ExpenseInput, "version">, RecordBase {
  activity_name?: string;
  shares: Share[];
}
export interface Settlement
  extends Omit<SettlementInput, "version">, RecordBase {}
export interface Transfer {
  from_user_id: number;
  to_user_id: number;
  amount_minor: string;
}
export interface CurrencyBalance {
  currency: string;
  total_spent_minor: string;
  balances: Share[];
  suggested_transfers: Transfer[];
}
export interface ExpenseSummary {
  currencies: CurrencyBalance[];
  people: ExpensePerson[];
}
export interface BusinessPayment extends RecordBase {
  expense_id: number;
  payer_user_id: number;
  currency: string;
  amount_minor: string;
  paid_on: string;
  allocations: Share[];
}
export interface Loan extends RecordBase {
  activity_id: number;
  activity_name: string;
  description: string;
  from_user_id: number;
  to_user_id: number;
  currency: string;
  amount_minor: string;
  paid_on: string;
}
export interface TransactionInput {
  member_user_id?: number;
  correction_reason?: string;
  payment_id?: number;
  loan_id?: number;
  activity_id?: number;
  expense_id?: number;
  description?: string;
  payer_user_id?: number;
  from_user_id?: number;
  to_user_id?: number;
  currency: string;
  amount_minor: string;
  paid_on: string;
  allocations?: Share[];
  version?: number;
}
export interface Debt {
  payment_id?: number;
  loan_id?: number;
  activity_id?: number;
  activity_name: string;
  description: string;
  currency: string;
  from_user_id: number;
  to_user_id: number;
  amount_minor: string;
}
export interface ActivityLedger {
  reversed_settlements?: Settlement[];
  expenses: Expense[];
  payments: BusinessPayment[];
  loans: Loan[];
  settlements: Settlement[];
  people: ExpensePerson[];
  debts: Debt[];
}
export type FinancialRecord = Expense | Settlement | BusinessPayment | Loan;
export type LedgerKind =
  "expenses" | "settlements" | "expense_payments" | "expense_loans";
export const expensePageSize = 50;
export const expenseName = (person?: ExpensePerson) =>
  person?.display_name.trim() || person?.email || "Traveler";
export function canManageExpense(
  role: TripRole | undefined,
  userID: number | undefined,
  creatorID: number,
) {
  return (
    role === "owner" ||
    role === "editor" ||
    (role === "member" && userID === creatorID)
  );
}
export function expenseInput(input: ExpenseInput): ExpenseInput {
  return {
    ...(input.activity_id ? { activity_id: input.activity_id } : {}),
    ...(input.amount_basis ? { amount_basis: input.amount_basis } : {}),
    planned_coverer_user_id: input.planned_coverer_user_id ?? 0,
    planned_cover_amount_minor: input.planned_cover_amount_minor ?? "",
    description: input.description.trim(),
    currency: input.currency,
    amount_minor: input.amount_minor,
    incurred_on: input.incurred_on,
    payer_user_id: input.payer_user_id,
    split_mode: input.split_mode,
    shares: input.shares.map((share) =>
      input.split_mode === "equal"
        ? { user_id: share.user_id }
        : { user_id: share.user_id, amount_minor: share.amount_minor },
    ),
    ...(input.version === undefined ? {} : { version: input.version }),
  };
}
export function settlementInput(input: SettlementInput): SettlementInput {
  return {
    ...(input.correction_reason
      ? { correction_reason: input.correction_reason }
      : {}),
    ...(input.payment_id ? { payment_id: input.payment_id } : {}),
    ...(input.loan_id ? { loan_id: input.loan_id } : {}),
    currency: input.currency,
    amount_minor: input.amount_minor,
    paid_on: input.paid_on,
    from_user_id: input.from_user_id,
    to_user_id: input.to_user_id,
    ...(input.version === undefined ? {} : { version: input.version }),
  };
}

export function useExpensesApi(
  tripID: number,
  onFailure: (error: Error) => void | Promise<void>,
) {
  const api = useApi(),
    client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const base = `/api/v1/trips/${tripID}`;
  async function read<T>(path: string, signal?: AbortSignal) {
    const data = await api<T>(path, { signal });
    if (data === undefined)
      throw new ApiError(
        500,
        "Unable to load the expense ledger. Please retry.",
      );
    return data;
  }
  const refresh = useCallback(
    () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["trip", tripID, "ledger"] }),
        client.invalidateQueries({
          queryKey: ["trip", tripID, "expense-status"],
        }),
        client.invalidateQueries({
          queryKey: ["trip", tripID, "payment-preview"],
        }),
      ]),
    [client, tripID],
  );
  async function mutate(
    kind: LedgerKind,
    method: "POST" | "PUT" | "DELETE",
    input?: ExpenseInput | SettlementInput | TransactionInput,
    record?: FinancialRecord,
    key?: string,
    reason?: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const data = await api<FinancialRecord>(
        `${base}/${kind}${record ? `/${record.id}` : ""}${method === "DELETE" ? `?version=${record!.version}${reason ? `&correction_reason=${encodeURIComponent(reason)}` : ""}` : ""}`,
        {
          method,
          ...(input
            ? {
                headers: {
                  "Content-Type": "application/json",
                  ...(key ? { "Idempotency-Key": key } : {}),
                },
                body: JSON.stringify(
                  kind === "expenses"
                    ? expenseInput(input as ExpenseInput)
                    : kind === "settlements"
                      ? settlementInput(input as SettlementInput)
                      : input,
                ),
              }
            : {}),
        },
      );
      if (method !== "DELETE" && data === undefined)
        throw new ApiError(
          500,
          "Saving may have completed. Retry this submission or refresh the ledger before creating another record.",
        );
      await refresh();
      toast.success(
        method === "DELETE"
          ? "Record deleted."
          : kind === "expenses"
            ? "Expense saved."
            : kind === "expense_loans"
              ? "Loan recorded."
              : "Payment recorded.",
      );
      return data ?? true;
    } catch (cause) {
      const failure =
        cause instanceof ApiError
          ? cause
          : new ApiError(
              500,
              "Saving may have completed. Retry this submission or refresh the ledger before creating another record.",
            );
      setError(failure);
      if (failure.status === 400) {
        await client.invalidateQueries({
          queryKey: ["trip", tripID, "members"],
        });
        await refresh();
      }
      if ([403, 404, 409].includes(failure.status)) {
        await refresh();
        if (failure.status === 403) await onFailure(failure);
      }
      throw failure;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    pending,
    error,
    reset: () => setError(null),
    refresh,
    ledger: (signal?: AbortSignal) =>
      read<ActivityLedger>(`${base}/expense-ledger`, signal),
    saveTransaction: (
      kind: "expense_payments" | "expense_loans",
      input: TransactionInput,
      record?: BusinessPayment | Loan,
      key?: string,
    ) => mutate(kind, record ? "PUT" : "POST", input, record, key),
    currencies: (signal?: AbortSignal) =>
      read<Currency[]>("/api/v1/expense-currencies", signal),
    summary: (signal?: AbortSignal) =>
      read<ExpenseSummary>(`${base}/balances`, signal),
    list: <T extends FinancialRecord>(
      kind: LedgerKind,
      currency: string,
      offset: number,
      signal?: AbortSignal,
    ) =>
      read<T[]>(
        `${base}/${kind}?limit=${expensePageSize}&offset=${offset}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`,
        signal,
      ),
    get: <T extends FinancialRecord>(kind: LedgerKind, id: number) =>
      read<T>(`${base}/${kind}/${id}`),
    saveExpense: (input: ExpenseInput, record?: Expense, key?: string) =>
      mutate("expenses", record ? "PUT" : "POST", input, record, key),
    saveSettlement: (
      input: SettlementInput,
      record?: Settlement,
      key?: string,
    ) => mutate("settlements", record ? "PUT" : "POST", input, record, key),
    remove: (kind: LedgerKind, record: FinancialRecord, reason?: string) =>
      mutate(kind, "DELETE", undefined, record, undefined, reason),
    receiptHistory: (id: number) =>
      read<ReceiptHistory[]>(`${base}/settlements/${id}/history`),
  };
}

export interface ReceiptHistory {
  id: number;
  actor_user_id: number;
  action: string;
  reason: string;
  before: Settlement | null;
  after: Settlement | null;
  created_at: string;
}

export interface CostChange extends ExpenseInput {
  id?: number;
}
export interface MemberPaymentStatus {
  user_id: number;
  share_minor: string;
  paid_minor: string;
  remaining_minor: string;
  business_remaining_minor: string;
  receivable_minor: string;
  credit_minor: string;
  reimbursements: Debt[];
}
export interface PaymentStatus {
  expense: Expense;
  business_paid_minor: string;
  business_remaining_minor: string;
  members: MemberPaymentStatus[];
  payments: BusinessPayment[];
  receipts: Settlement[];
  people: ExpensePerson[];
}
export interface PaymentPreview {
  allocations: Share[];
  own_covered_minor: string;
  reimbursements: Share[];
  business_remaining_minor: string;
  after: PaymentStatus;
}

export interface CostPreview {
  before: PaymentStatus;
  after: PaymentStatus;
}
