"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft, Ellipsis } from "lucide-react";
import { Expenses } from "@/components/features/expenses/expenses";
import { MobileBottomNav } from "@/components/features/account/mobile-bottom-nav";
import { Button } from "@/components/ui/button";
import { allActivitiesKey, type Activity } from "@/lib/itinerary";
import type { ActivityLedger } from "@/lib/expenses";
import type { Trip } from "@/lib/trips";
import type { Participant } from "@/lib/memberships";
const trip: Trip = {
  id: 999999,
  name: "Cebu beach getaway",
  destination_place_id: null,
  destination: "Mactan",
  start_date: "2026-11-02",
  end_date: "2026-11-08",
  starts_at: null,
  ends_at: null,
  time_zone: "Asia/Manila",
  created_at: "",
  updated_at: "",
};
const people: Participant[] = [
  { user_id: 1, display_name: "Alex", email: null, role: "owner" },
  {
    user_id: 2,
    display_name: "",
    email: "pukollogruwa-5796@yopmail.com",
    role: "member",
  },
];
const base = {
  trip_id: trip.id,
  created_by_user_id: 1,
  version: 1,
  created_at: "",
  updated_at: "",
  people,
};
const activities: Activity[] = [
  {
    id: 1,
    trip_id: trip.id,
    title: "Mactan beach day",
    category: "Activity",
    starts_at: "2026-11-02T01:00:00Z",
    ends_at: "2026-11-02T12:00:00Z",
    time_zone: "Asia/Manila",
    notes: "",
    place_id: null,
    place: null,
    checklist: [],
    created_by_user_id: 1,
    created_at: "",
    updated_at: "",
  },
];
const costs = [
  ["Resort day-use entrance", 40000],
  ["Shared tricycle transfers", 20000],
  ["Beach lunch", 35000],
  ["Dinner", 20000],
  ["Island snacks", 10000],
  ["Cold drinks", 10000],
  ["Parking", 5000],
  ["Boat tour", 35000],
] as const;
const ledger: ActivityLedger = {
  people,
  expenses: costs.map(([description, amount], index) => ({
    ...base,
    id: 8 - index,
    activity_id: 1,
    activity_name: "Mactan beach day",
    description,
    currency: "PHP",
    amount_minor: String(amount),
    incurred_on: "2026-11-02",
    payer_user_id: 0,
    split_mode: "equal",
    shares: [{ user_id: 1, amount_minor: String(amount) }],
  })),
  payments: costs.map(([, amount], index) => ({
    ...base,
    id: index + 1,
    expense_id: 8 - index,
    payer_user_id: 1,
    currency: "PHP",
    amount_minor: String(amount - (index === 7 ? 15000 : 0)),
    paid_on: "2026-11-02",
    allocations: [
      { user_id: 1, amount_minor: String(amount - (index === 7 ? 15000 : 0)) },
    ],
  })),
  loans: [
    {
      ...base,
      id: 1,
      activity_id: 1,
      activity_name: "Mactan beach day",
      description: "Beach-day cash advance ? snacks & drinks",
      from_user_id: 1,
      to_user_id: 2,
      currency: "PHP",
      amount_minor: "50000",
      paid_on: "2026-11-02",
    },
  ],
  debts: [
    {
      loan_id: 1,
      activity_id: 1,
      activity_name: "Mactan beach day",
      description: "Beach-day cash advance ? snacks & drinks",
      from_user_id: 2,
      to_user_id: 1,
      currency: "PHP",
      amount_minor: "35000",
    },
  ],
  settlements: [
    {
      ...base,
      id: 1,
      loan_id: 1,
      from_user_id: 2,
      to_user_id: 1,
      currency: "PHP",
      amount_minor: "15000",
      paid_on: "2026-11-08",
    },
  ],
};
export default function Preview() {
  const [client] = useState(() => {
    const q = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    q.setQueryData(["trip", trip.id, "ledger", "activity"], ledger);
    q.setQueryData(["expense-currencies"], [{ code: "PHP", decimals: 2 }]);
    q.setQueryData(allActivitiesKey(trip.id), activities);
    return q;
  });
  return (
    <QueryClientProvider client={client}>
      <div className="app-shell flex min-h-dvh flex-col bg-background text-foreground [&]:[--app-top:calc(56px_+_env(safe-area-inset-top,_0px))] [&]:[--app-bottom:calc(6rem_+_env(safe-area-inset-bottom,_0px))] [&:has(.trip-detail)_>_main#trips-main]:[padding-top:1rem] max-md:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:max(1.25rem,_env(safe-area-inset-left,_0px))_max(1.25rem,_env(safe-area-inset-right,_0px))] max-md:[&:has(.mobile-trip-header)_>_.app-topbar]:[visibility:hidden] max-md:[&:has(.mobile-bottom-nav)_>_footer]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_24px)] max-md:[&:has(.mobile-add-activity)_>_main#trips-main]:[padding-bottom:calc(var(--app-bottom)_+_72px)] max-md:[&_.form-actions]:[bottom:var(--app-bottom)] max-md:[&_.form-surface]:[border:0] max-md:[&_.form-surface]:[border-radius:0] max-md:[&_.form-surface]:[background:transparent] max-md:[&_.form-surface]:[padding:0] max-md:[&_.form-surface]:[--form-surface:var(--background)] md:[&:has(.trip-detail)_>_main#trips-main]:[padding-top:0.5rem] lg:[&[data-authenticated='true']]:[padding-left:236px] lg:[&[data-authenticated='true']_>_.app-topbar]:[display:none] lg:[&[data-authenticated='true']_>_.content-shell]:[padding:2rem_2.5rem] max-[360px]:[&:has(.trips-overview)_>_.content-shell]:[padding-inline:1rem] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-inline:max(12px,_env(safe-area-inset-left,_0px))_max(12px,_env(safe-area-inset-right,_0px))] max-md:[&:has(.trip-expenses-page)_>_main#trips-main]:[padding-top:12px]">
        <header className="app-topbar bg-background max-md:pt-[env(safe-area-inset-top,0px)]">
          <nav
            className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] flex min-h-14 items-center md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]"
            aria-label="Main navigation"
          >
            Travel Planner
          </nav>
        </header>
        <main
          id="trips-main"
          className="content-shell w-full max-w-[90rem] mx-auto px-[max(1.5rem,env(safe-area-inset-left,0px))] [padding-right:max(1.5rem,env(safe-area-inset-right,0px))] min-w-0 flex-1 space-y-5 pt-6 pb-6 md:space-y-6 md:py-8 md:[&]:[padding-left:max(2rem,_env(safe-area-inset-left,_0px))] md:[&]:[padding-right:max(2rem,_env(safe-area-inset-right,_0px))] xl:[&]:[padding-left:max(4rem,_env(safe-area-inset-left,_0px))] xl:[&]:[padding-right:max(4rem,_env(safe-area-inset-right,_0px))]"
          tabIndex={-1}
        >
          <div className="trip-detail mx-auto flex w-full max-w-6xl flex-col gap-3">
            <div className="mobile-trip-header fixed inset-x-0 top-0 z-40 flex min-h-[var(--app-top)] items-center gap-2 border-b bg-background pt-[env(safe-area-inset-top,0px)] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] md:hidden">
              <Button
                className="size-12 shrink-0"
                variant="ghost"
                aria-label="Back to itinerary"
              >
                <ArrowLeft />
              </Button>
              <p className="min-w-0 flex-1 text-sm font-medium">
                Trip expenses
              </p>
              <Button
                className="size-12"
                variant="ghost"
                aria-label="Trip options"
              >
                <Ellipsis />
              </Button>
            </div>
            <header className="planning-header [display:flex] [flex-direction:column] [gap:0.75rem] [&>nav]:[order:-1] [&>nav]:[width:100%] [&>nav]:[align-items:center] md:[&]:[margin-bottom:0.75rem]">
              <div className="trip-summary-compact [display:flex] [flex-wrap:wrap] [align-items:baseline] [gap:0.25rem_0.75rem] [&_h1]:[font-size:1.25rem] [&_h1]:[line-height:1.25] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.025em] [&_p]:[font-size:0.8125rem] [&_p]:[color:var(--muted-foreground)]">
                <h1>{trip.name}</h1>
                <p>Nov 2 ? 8, 2026</p>
              </div>
            </header>
            <Expenses
              active
              trip={trip}
              participants={people}
              current={people[0]}
              onFailure={() => {}}
            />
          </div>
        </main>
        <MobileBottomNav
          pathname="/trips/999999/expenses"
          accountContent={<p>Preview account</p>}
        />
      </div>
    </QueryClientProvider>
  );
}
