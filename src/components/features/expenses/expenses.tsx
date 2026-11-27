"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { ExpenseHistoryDrawer } from "@/components/features/expenses/drawers/expense-history-drawer";
import { ExpenseListLoading } from "@/components/features/expenses/expense-list-parts";
import { GroupExpenses } from "@/components/features/expenses/group-expenses";
import {
  ExpensesHeading,
  type ExpenseMode,
} from "@/components/features/expenses/mode-switch";
import { PersonalExpenses } from "@/components/features/expenses/personal-expenses";
import {
  useFinance,
  type Context,
} from "@/components/features/expenses/use-finance";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { ApiError, useApi } from "@/lib/api";
import {
  groupFilters,
  personalFilters,
  type GroupFilter,
  type PersonalFilter,
} from "@/lib/expense-views";
import { allActivities, allActivitiesKey } from "@/lib/itinerary";
import {
  personalExpensesKey,
  usePersonalExpensesApi,
} from "@/lib/personal-expenses";

/** The trip Expenses page: Group (shared) and Personal (private) modes. */
export function Expenses(props: Context & { active: boolean }) {
  const { trip, active, participants, current, onFailure } = props;
  const context = { trip, participants, current, onFailure };
  const { api, ledger, currencies } = useFinance(props, active);
  const personalApi = usePersonalExpensesApi(trip.id, onFailure);
  const personal = useQuery({
    queryKey: personalExpensesKey(trip.id),
    queryFn: ({ signal }) => personalApi.list(signal),
    enabled: active,
    retry: false,
  });
  const read = useApi();
  const activities = useQuery({
    queryKey: allActivitiesKey(trip.id),
    enabled: active,
    retry: false,
    queryFn: ({ signal }) => allActivities(read, trip.id, signal),
  });
  useEffect(() => {
    if (
      personal.error instanceof ApiError &&
      [403, 404].includes(personal.error.status)
    )
      void onFailure(personal.error);
  }, [personal.error, onFailure]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  // Mode and filter live in the URL, so returning from Prep or an itinerary
  // page, or reloading, shows the same list.
  const params = useSearchParams();
  const mode: ExpenseMode =
    params.get("mode") === "personal" ? "personal" : "group";
  const filter = params.get("filter") ?? "";
  function show(nextMode: ExpenseMode, nextFilter: string) {
    const next = new URLSearchParams(params);
    if (nextMode === "group") next.delete("mode");
    else next.set("mode", nextMode);
    if (nextFilter === "all") next.delete("filter");
    else next.set("filter", nextFilter);
    window.history.replaceState(
      null,
      "",
      next.size ? `?${next}` : window.location.pathname,
    );
  }
  if (!active) return null;
  const changeMode = (next: ExpenseMode) => {
    if (next !== mode) show(next, "all");
  };
  const group = mode === "group";
  const currencyList = currencies.data;
  const loading =
    currencies.isPending ||
    (group
      ? ledger.isPending
      : personal.isPending || (ledger.isPending && !ledger.error));
  const ready = group
    ? ledger.data && currencyList
    : currencyList && (personal.data || ledger.data);
  // A failed half is reported next to the half that loaded.
  const errors = [
    ledger.error && {
      key: "ledger",
      title: group ? undefined : "Money you lent couldn’t load",
      query: ledger,
    },
    !group &&
      personal.error && {
        key: "personal",
        title: "Your personal expenses couldn’t load",
        query: personal,
      },
    currencies.error && {
      key: "currencies",
      title: undefined,
      query: currencies,
    },
    activities.error && {
      key: "activities",
      title: "Activities couldn’t load",
      query: activities,
    },
  ].filter((e) => !!e);
  const errorList = errors.map((e) => (
    <TripError
      key={e.key}
      title={e.title}
      error={e.query.error}
      retry={() => void e.query.refetch()}
      pending={e.query.isFetching}
    />
  ));
  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-6"
      aria-labelledby="trip-expenses-heading"
    >
      {!ready && (
        <ExpensesHeading
          headingRef={headingRef}
          mode={mode}
          onModeChange={changeMode}
        />
      )}
      {!ready && errorList}
      {!ready && loading && <ExpenseListLoading label="Loading expenses…" />}
      {group && ledger.data && currencyList && (
        <GroupExpenses
          {...context}
          headingRef={headingRef}
          onModeChange={changeMode}
          errors={errorList}
          ledger={ledger.data}
          activities={activities.data ?? []}
          currencies={currencyList}
          api={api}
          filter={
            Object.hasOwn(groupFilters, filter)
              ? (filter as GroupFilter)
              : "all"
          }
          setFilter={(next) => show("group", next)}
        />
      )}
      {!group && ready && currencyList && (
        <PersonalExpenses
          {...context}
          headingRef={headingRef}
          onModeChange={changeMode}
          errors={errorList}
          expenses={personal.data}
          ledger={ledger.data}
          activities={activities.data ?? []}
          activitiesError={!activities.data}
          currencies={currencyList}
          api={personalApi}
          loans={api}
          filter={
            Object.hasOwn(personalFilters, filter)
              ? (filter as PersonalFilter)
              : "all"
          }
          setFilter={(next) => show("personal", next)}
        />
      )}
      {ledger.data && currencyList && (
        <Button
          ref={historyTrigger}
          variant="ghost"
          className="justify-self-start text-muted-foreground"
          onClick={() => setHistoryOpen(true)}
        >
          <ClockCounterClockwiseIcon aria-hidden="true" />
          Balances and history
        </Button>
      )}
      {historyOpen && (
        <ExpenseHistoryDrawer
          {...context}
          onBack={() => setHistoryOpen(false)}
          finalFocus={() => historyTrigger.current ?? headingRef.current}
        />
      )}
    </section>
  );
}
