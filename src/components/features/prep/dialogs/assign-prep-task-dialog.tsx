"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import {
  assigneeOptions,
  PrepSelect,
} from "@/components/features/prep/prep-select";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import type { Participant } from "@/lib/memberships";
import type { PrepTask, usePrepApi } from "@/lib/prep";

export function AssignPrepTaskDialog({
  api,
  task,
  people,
  finalFocus,
  onClose,
}: {
  api: Pick<ReturnType<typeof usePrepApi>, "pending" | "error" | "assign">;
  task: PrepTask;
  people: Participant[];
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  onClose: () => void;
}) {
  const [assignee, setAssignee] = useState(task.assignee?.user_id ?? 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (api.pending) return;
    try {
      if (await api.assign(task.id, assignee || null)) onClose();
    } catch {
      /* Keep the dialog open and show the error. */
    }
  }

  return (
    <TripDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Assign task"
      description={task.title}
      mobilePresentation="sheet"
      busy={api.pending}
      finalFocus={finalFocus}
    >
      <form onSubmit={submit}>
        <fieldset disabled={api.pending} className="space-y-5">
          <PrepSelect
            id="prep-assign-assignee"
            label="Who's doing it?"
            options={assigneeOptions(people)}
            value={String(assignee)}
            onChange={(next) => setAssignee(Number(next))}
          />
          {api.error && <TripError error={api.error} />}
          <Button type="submit" className="min-h-12 w-full">
            {api.pending ? "Saving…" : "Save"}
          </Button>
        </fieldset>
      </form>
    </TripDialog>
  );
}
