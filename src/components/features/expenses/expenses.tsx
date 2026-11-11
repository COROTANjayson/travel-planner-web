"use client";

import { useRef, useState } from "react";
import type { MyEntry } from "@/lib/trip-expenses";
import { MarkAsPaidDialog } from "@/components/features/expenses/dialogs/mark-as-paid-dialog";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { localDate } from "@/lib/activity-time";
import { allActivities, allActivitiesKey } from "@/lib/itinerary";
import { TripBalance } from "@/components/features/expenses/trip-balance";
import { TripExpenseList } from "@/components/features/expenses/trip-expense-list";
import {
  useFinance,
  type Context,
} from "@/components/features/expenses/use-finance";
import { TripError } from "@/components/shared/trip-states";

export function Expenses(props: Context & { active: boolean }) {
  const { trip, active, participants, current } = props;
  const { api, ledger, currencies } = useFinance(props, active);
  const [selected, setSelected] = useState<MyEntry | null>(null);
  const receiptKey = useRef("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const filterRef = useRef<HTMLButtonElement | null>(null);
  const mobileFilterRef = useRef<HTMLButtonElement | null>(null);
  const canReceive = !!current && current.role !== "viewer";
  function close() {
    if (api.pending) return;
    setSelected(null);
    api.reset();
  }
  const read = useApi();
  const activities = useQuery({
    queryKey: allActivitiesKey(trip.id),
    enabled: active,
    retry: false,
    queryFn: ({ signal }) => allActivities(read, trip.id, signal),
  });
  if (!active) return null;
  const data = ledger.data;
  const me = current?.user_id ?? 0;
  const people = data
    ? [
        ...new Map(
          [...data.people, ...(participants ?? [])].map((p) => [p.user_id, p]),
        ).values(),
      ]
    : [];
  const loaded =
    data && activities.data && currencies.data
      ? { data, activities: activities.data, currencies: currencies.data }
      : null;
  const heading = (
    <h2
      id="trip-expenses-heading"
      className="trip-balance-title sr-only md:not-sr-only"
    >
      Your expenses
    </h2>
  );
  return (
    <section
      className="trip-expenses-page space-y-4 md:space-y-6"
      aria-labelledby="trip-expenses-heading"
    >
      {loaded ? (
        <TripBalance
          title={heading}
          ledger={loaded.data}
          me={me}
          currencies={loaded.currencies}
        />
      ) : (
        heading
      )}
      {loaded && (
        <p className="text-sm text-muted-foreground">
          {canReceive
            ? "Tap an amount owed to you to record money received."
            : "Manage payments inside each activity."}
        </p>
      )}
      {(ledger.isPending || activities.isPending || currencies.isPending) && (
        <p role="status">Loading trip expenses…</p>
      )}
      {(ledger.error || activities.error || currencies.error) && (
        <TripError
          error={ledger.error ?? activities.error ?? currencies.error}
          retry={() => {
            void ledger.refetch();
            void activities.refetch();
            void currencies.refetch();
          }}
        />
      )}
      {loaded && (
        <TripExpenseList
          ledger={loaded.data}
          activities={loaded.activities}
          people={people}
          me={me}
          currencies={loaded.currencies}
          today={localDate(new Date().toISOString(), trip.time_zone)}
          filterRef={filterRef}
          mobileFilterRef={mobileFilterRef}
          onReceive={
            canReceive
              ? (entry, button) => {
                  if (!entry.debt || entry.debt.to_user_id !== current.user_id)
                    return;
                  api.reset();
                  receiptKey.current = crypto.randomUUID();
                  trigger.current = button;
                  setSelected(entry);
                }
              : undefined
          }
        />
      )}
      {loaded && current && canReceive && (
        <MarkAsPaidDialog
          debt={selected?.debt ?? null}
          setDebt={() => setSelected(null)}
          api={api}
          people={people}
          currencies={loaded.currencies}
          current={current}
          participants={participants}
          trip={trip}
          ledger={loaded.data}
          close={close}
          finalFocus={() =>
            trigger.current?.isConnected
              ? trigger.current
              : mobileFilterRef.current?.getClientRects().length
                ? mobileFilterRef.current
                : filterRef.current
          }
          receiptKey={receiptKey}
          backLabel="Back to expenses"
          description={
            selected ? `${selected.title} · ${selected.detail}` : undefined
          }
        />
      )}
    </section>
  );
}
