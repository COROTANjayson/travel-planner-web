"use client";

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
  const { ledger, currencies } = useFinance(props, active);
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
  return (
    <section className="space-y-6" aria-labelledby="trip-expenses-heading">
      <div>
        <h2 id="trip-expenses-heading" className="text-2xl font-semibold">
          Trip expenses
        </h2>
        <p className="text-muted-foreground">
          Your balance and every cost, loan and settlement that involves you.
          Open an activity in the itinerary to add or settle expenses.
        </p>
      </div>
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
      {data && activities.data && currencies.data && (
        <>
          <TripBalance ledger={data} me={me} currencies={currencies.data} />
          <TripExpenseList
            ledger={data}
            activities={activities.data}
            people={people}
            me={me}
            currencies={currencies.data}
            today={localDate(new Date().toISOString(), trip.time_zone)}
          />
        </>
      )}
    </section>
  );
}
