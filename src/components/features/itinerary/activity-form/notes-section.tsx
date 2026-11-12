"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function NotesSection({
  prefix,
  section,
  notes,
  setNotes,
}: {
  prefix: string;
  section?: "details" | "place" | "notes" | "checklist";
  notes: string;
  setNotes: (notes: string) => void;
}) {
  return (
    <section
      className={cn(section ? "space-y-2" : "border-t border-border py-2")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] leading-7 font-bold text-foreground">
          Notes
        </h3>
      </div>
      <div className={cn("space-y-4", section ? "pt-4" : "pt-1 pb-4")}>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-notes`}>Activity notes</Label>
          <textarea
            id={`${prefix}-notes`}
            autoFocus={!section || section === "notes"}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 disabled:opacity-50"
          />
        </div>
      </div>
    </section>
  );
}
