"use client";

import type { ComponentProps } from "react";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PrepTask, usePrepApi } from "@/lib/prep";
import { plural } from "@/lib/utils";

/** Moves a task back to the whole trip; its expenses leave the activity with it. */
export function RemoveFromActivityDialog({
  api,
  task,
  activityTitle,
  expenses,
  finalFocus,
  onClose,
}: {
  api: Pick<ReturnType<typeof usePrepApi>, "pending" | "error" | "update">;
  task: PrepTask;
  activityTitle: string;
  /** Linked expenses, which move with the task. */
  expenses: number;
  finalFocus: ComponentProps<typeof AlertDialogContent>["finalFocus"];
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !api.pending) onClose();
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%-2rem)]"
        finalFocus={finalFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            Remove from {activityTitle}?
          </AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            “{task.title}” goes back to the whole trip.
            {expenses > 0 &&
              ` Its ${plural(expenses, "expense")} won’t be part of this activity anymore.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {api.error && <TripError error={api.error} />}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={api.pending}>
            Cancel
          </AlertDialogCancel>
          <Button
            className="min-h-11"
            variant="destructive"
            disabled={api.pending}
            onClick={async () => {
              if (api.pending) return;
              try {
                if (
                  await api.update(
                    task.id,
                    { title: task.title, activity_id: null, date: task.date },
                    "Task moved to the whole trip.",
                  )
                )
                  onClose();
              } catch {
                /* Keep the confirmation open and show the error. */
              }
            }}
          >
            {api.pending ? "Removing…" : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
