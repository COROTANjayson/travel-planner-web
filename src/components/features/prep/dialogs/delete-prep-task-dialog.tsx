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

export function DeletePrepTaskDialog({
  api,
  task,
  expenses = 0,
  finalFocus,
  onClose,
}: {
  api: Pick<ReturnType<typeof usePrepApi>, "pending" | "error" | "remove">;
  task: PrepTask;
  /** Linked expenses; they stay in the trip's expenses after the task goes. */
  expenses?: number;
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
            Delete “{task.title}”?
          </AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            This removes it for everyone on the trip and cannot be undone.
            {expenses > 0 &&
              ` Its ${expenses === 1 ? "expense" : `${expenses} expenses`} and their payments stay in the trip's expenses${task.activity ? ` and on ${task.activity.title}` : ""}.`}
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
                if (await api.remove(task.id)) onClose();
              } catch {
                /* Keep the confirmation open and show the error. */
              }
            }}
          >
            {api.pending ? "Deleting…" : "Delete task"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
