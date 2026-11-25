"use client";

import type { Dispatch, SetStateAction } from "react";
import { expenseName, type ExpensePerson } from "@/lib/expenses";

export function MembersStep({
  people,
  selected,
  setSelected,
  change,
}: {
  people: ExpensePerson[];
  selected: number[];
  setSelected: Dispatch<SetStateAction<number[]>>;
  change: () => void;
}) {
  return (
    <div className="divide-y overflow-hidden rounded-[16px] border bg-card">
      {people.map((person) => (
        <label
          key={person.user_id}
          className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-3 sm:p-4"
        >
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={selected.includes(person.user_id)}
            onChange={(e) => {
              setSelected((ids) =>
                e.target.checked
                  ? [...ids, person.user_id]
                  : ids.filter((id) => id !== person.user_id),
              );
              change();
            }}
          />
          <span className="break-words">{expenseName(person)}</span>
        </label>
      ))}
    </div>
  );
}
