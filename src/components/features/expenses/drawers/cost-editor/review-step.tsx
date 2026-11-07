"use client";

import {
  expenseName,
  type CostPreview,
  type ExpensePerson,
} from "@/lib/expenses";

export function ReviewStep({
  review,
  people,
  money,
}: {
  review: CostPreview;
  people: ExpensePerson[];
  money: (value: string | bigint) => string;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Recorded payments stay unchanged. Review the updated balances before
        saving.
      </p>
      <div className="figma-money-summary">
        <p>
          Expense total: {money(review.before.expense.amount_minor)} →{" "}
          {money(review.after.expense.amount_minor)}
        </p>
        <p>
          Paid to business: {money(review.before.business_paid_minor)} →{" "}
          {money(review.after.business_paid_minor)}
        </p>
      </div>
      <div className="divide-y">
        {review.after.members.map((member) => {
          const before = review.before.members.find(
            (m) => m.user_id === member.user_id,
          );
          return (
            <div key={member.user_id} className="py-3 space-y-2">
              <strong>
                {expenseName(people.find((p) => p.user_id === member.user_id))}
              </strong>
              <p className="text-sm">
                Still to pay: {money(before?.remaining_minor ?? "0")} →{" "}
                {money(member.remaining_minor)}
              </p>
              {BigInt(member.credit_minor) > 0n && (
                <p className="text-sm text-primary">
                  Credit requiring correction: {money(member.credit_minor)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
