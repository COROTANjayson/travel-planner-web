"use client";

import type { Screen } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/lib/expenses";

export function PaymentChooseScreen({
  data,
  editor,
  money,
  name,
  setScreen,
}: {
  data: PaymentStatus;
  editor: boolean;
  money: (value: string) => string;
  name: (id: number) => string;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the member whose payment you want to update.
      </p>
      {data.members.map((row) => (
        <Button
          variant="outline"
          className="figma-select-button [&[data-slot='button']]:[font-size:1rem] [&[data-slot='button']]:[width:100%] [&[data-slot='button']]:[min-height:3rem] [&[data-slot='button']]:[height:auto] [&[data-slot='button']]:[justify-content:space-between] [&[data-slot='button']]:[border-radius:0.875rem] [&[data-slot='button']]:[padding:0.75rem] [&[data-slot='button']]:[white-space:normal] [&[data-slot='button']]:[text-align:left]"
          key={row.user_id}
          disabled={BigInt(row.remaining_minor) <= 0n}
          onClick={() => setScreen({ type: "payment", user: row.user_id })}
        >
          <span>{name(row.user_id)}</span>
          <span>
            {BigInt(row.remaining_minor) <= 0n
              ? "Share fully paid"
              : `${money(row.remaining_minor)} left`}
          </span>
        </Button>
      ))}
      {editor && BigInt(data.business_remaining_minor) > 0n && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setScreen({ type: "payment", reservation: true })}
        >
          Record reservation or advance
        </Button>
      )}
    </div>
  );
}
