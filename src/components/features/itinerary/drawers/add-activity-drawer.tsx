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
      className="activity-details-dialog reference-activity-dialog activity-planning-dialog [&_[data-slot='input']]:min-h-12 [&_[data-slot='input']]:rounded-[0.875rem] [&_[data-slot='select-trigger']]:min-h-12 [&_[data-slot='select-trigger']]:rounded-[0.875rem]"
      variant="planning"
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
