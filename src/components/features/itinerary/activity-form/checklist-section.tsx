"use client";

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
  markDirty,
  checklistAddButtonRef,
  addButton,
}: {
  prefix: string;
  section?: "details" | "place" | "notes" | "checklist";
  checklist: ChecklistDraft[];
  setChecklist: (checklist: ChecklistDraft[]) => void;
  markDirty: () => void;
  checklistAddButtonRef: RefObject<HTMLButtonElement | null>;
  addButton: ReactNode;
}) {
  return (
    <section className={section ? "space-y-2" : undefined}>
      <div className="activity-section-heading">
        <h3 id={`${prefix}-checklist-label`}>To do</h3>
      </div>
      <div
        className="space-y-3 pt-4"
        role="group"
        aria-labelledby={`${prefix}-checklist-label`}
      >
        {section && (
          <p className="text-sm text-muted-foreground">
            A simple list of things to do during this activity.
          </p>
        )}
        <ol className="space-y-3">
          {checklist.map((item, index) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2">
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
                  markDirty();
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
        <p className="text-xs text-muted-foreground">
          {checklist.length}/50 items
        </p>
      </div>
    </section>
  );
}
