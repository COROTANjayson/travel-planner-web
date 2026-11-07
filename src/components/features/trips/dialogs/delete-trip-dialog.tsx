"use client";

import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteTripDialog({
  confirming,
  setConfirming,
  remove,
}: {
  confirming: boolean;
  setConfirming: (open: boolean) => void;
  remove: {
    isPending: boolean;
    error: Error | null;
    mutate: () => void;
    reset: () => void;
  };
}) {
  return (
    <AlertDialog
      open={confirming}
      onOpenChange={(open) => {
        if (!remove.isPending) {
          setConfirming(open);
          remove.reset();
        }
      }}
    >
      <AlertDialogTrigger
        render={<Button className="min-h-11" variant="destructive" />}
      >
        Delete trip
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the trip and all its activities, expenses,
            and recorded payments. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error && <TripError error={remove.error} />}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (!remove.isPending) remove.mutate();
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete trip"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
