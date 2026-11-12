"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChecklistItem } from "@/lib/itinerary";

export type ChecklistDraft = ChecklistItem & { key: number };

export function ChecklistSection({
  prefix,
  section,
  checklist,
  setChecklist,
  checklistAddButtonRef,
  addButton,
}: {
  prefix: string;
  section?: "details" | "place" | "notes" | "checklist";
  checklist: ChecklistDraft[];
  setChecklist: (checklist: ChecklistDraft[]) => void;
  checklistAddButtonRef: RefObject<HTMLButtonElement | null>;
  addButton: ReactNode;
}) {
  return (
    <section
      className={cn(section ? "space-y-2" : "border-t border-border py-2")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`${prefix}-checklist-label`}
          className="text-[18px] leading-7 font-bold text-foreground"
        >
          To do
        </h3>
      </div>
      <div
        className={cn("space-y-3", section ? "pt-4" : "pt-1 pb-4")}
        role="group"
        aria-labelledby={`${prefix}-checklist-label`}
      >
        {section && (
          <p className="text-sm leading-6 text-muted-foreground lg:max-w-[70ch]">
            A simple list of things to do during this activity.
          </p>
        )}
        <ol className="space-y-3">
          {checklist.map((item, index) => (
            <li
              key={item.key}
              className="flex flex-wrap items-center gap-2 text-sm leading-6"
            >
              <Input
                className="min-h-11 min-w-0 flex-1 basis-32"
                aria-label={`To-do item ${index + 1}`}
                autoFocus={!section || (section === "checklist" && index === 0)}
                required
                value={item.text}
                placeholder="e.g. Buy tickets"
                onChange={(event) =>
                  setChecklist(
                    checklist.map((current) =>
                      current.key === item.key
                        ? { ...current, text: event.target.value }
                        : current,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                aria-label={`Remove to-do item ${index + 1}`}
                onClick={() => {
                  setChecklist(
                    checklist.filter((current) => current.key !== item.key),
                  );
                  requestAnimationFrame(() =>
                    checklistAddButtonRef.current?.focus(),
                  );
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
        {addButton}
        <p className="text-sm leading-6 text-muted-foreground lg:max-w-[70ch]">
          {checklist.length}/50 items
        </p>
      </div>
    </section>
  );
}
