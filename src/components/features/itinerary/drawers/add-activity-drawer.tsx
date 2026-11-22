"use client";

import {
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { TripDialog } from "@/components/shared/trip-dialog";
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
import { fullDateLabel } from "@/lib/activity-time";

export function AddActivityDrawer({
  open,
  date,
  busy,
  titleInput,
  finalFocus,
  closeEditor,
  dirty,
  children,
}: {
  open: boolean;
  date: string;
  busy: boolean;
  titleInput: ComponentProps<typeof TripDialog>["initialFocus"];
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  closeEditor: () => boolean;
  /** True while the form holds anything typed. */
  dirty: RefObject<boolean>;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <TripDialog
      open={open}
      presentation="detail"
      className="activity-details-dialog reference-activity-dialog activity-planning-dialog md:rounded-none"
      variant="planning"
      mobilePresentation="tall-sheet"
      backLabel="Back to itinerary"
      title="Add activity"
      headerContent={<h2>{fullDateLabel(date)}</h2>}
      busy={busy}
      initialFocus={titleInput}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (open) return;
        if (dirty.current) setConfirming(true);
        else closeEditor();
      }}
    >
      {children}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent tripSheet>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              What you typed will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                closeEditor();
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TripDialog>
  );
}
