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
import type { Activity, useItineraryApi } from "@/lib/itinerary";

export function DeleteActivityDialog({
  deleting,
  setDeleting,
  canEdit,
  api,
  finalFocus,
}: {
  deleting: Activity;
  setDeleting: (activity: Activity | null) => void;
  canEdit: boolean;
  api: Pick<
    ReturnType<typeof useItineraryApi>,
    "pending" | "error" | "reset" | "remove"
  >;
  finalFocus: ComponentProps<typeof AlertDialogContent>["finalFocus"];
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !api.pending) {
          api.reset();
          setDeleting(null);
        }
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%-2rem)]"
        finalFocus={finalFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete activity?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            Permanently delete “{deleting.title}”? This cannot be undone.
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
              if (!canEdit || api.pending) return;
              try {
                if (await api.remove(deleting.id)) setDeleting(null);
              } catch {
                /* Keep the confirmation open and show the error. */
              }
            }}
          >
            {api.pending ? "Deleting…" : "Delete activity"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
