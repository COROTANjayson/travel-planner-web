"use client";

import type { ComponentProps, ReactNode } from "react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { fullDateLabel } from "@/lib/activity-time";

export function AddActivityDrawer({
  open,
  date,
  busy,
  titleInput,
  finalFocus,
  closeEditor,
  children,
}: {
  open: boolean;
  date: string;
  busy: boolean;
  titleInput: ComponentProps<typeof TripDialog>["initialFocus"];
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  closeEditor: () => boolean;
  children: ReactNode;
}) {
  return (
    <TripDialog
      open={open}
      presentation="detail"
      className="activity-details-dialog reference-activity-dialog activity-planning-dialog"
      backLabel="Back to itinerary"
      title="Add activity"
      headerContent={<h2>{fullDateLabel(date)}</h2>}
      busy={busy}
      disablePointerDismissal
      initialFocus={titleInput}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      {children}
    </TripDialog>
  );
}
