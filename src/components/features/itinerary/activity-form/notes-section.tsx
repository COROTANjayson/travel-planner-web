"use client";

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
    <section className={section ? "space-y-2" : undefined}>
      <div className="activity-section-heading">
        <h3>Notes</h3>
      </div>
      <div className="pt-4 space-y-4">
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
