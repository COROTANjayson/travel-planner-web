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
    <div className="divide-y">
      {people.map((person) => (
        <label
          key={person.user_id}
          className="flex min-h-16 items-center gap-3 py-3"
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
