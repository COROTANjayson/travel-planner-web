import type {
  BusinessPayment,
  PaymentStatus,
  Settlement,
} from "@/lib/expenses";

export type Recorded =
  | { kind: "expense_payments"; record: BusinessPayment }
  | { kind: "settlements"; record: Settlement };

export const paidOnLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Everything recorded for one member, newest first: payments they made to the
// business and reimbursements they paid back.
export function memberRecords(status: PaymentStatus, user: number): Recorded[] {
  return [
    ...status.payments
      .filter((p) => p.payer_user_id === user)
      .map((record) => ({ kind: "expense_payments" as const, record })),
    ...status.receipts
      .filter((s) => s.from_user_id === user)
      .map((record) => ({ kind: "settlements" as const, record })),
  ].sort((a, b) => b.record.paid_on.localeCompare(a.record.paid_on));
}
