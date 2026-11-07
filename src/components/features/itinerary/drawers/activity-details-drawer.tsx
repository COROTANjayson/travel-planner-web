"use client";

import type { ComponentProps, ReactNode, RefObject } from "react";
import { Trash2 } from "lucide-react";
import {
  ActivityExpenses,
  type ActivityExpenseView,
} from "@/components/features/expenses/expenses";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import {
  ActivityDetailSections,
  type EditSection,
  type SectionButton,
} from "@/components/features/itinerary/drawers/activity-detail-sections";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import { timeLabel } from "@/lib/activity-time";
import type { Activity, useItineraryApi } from "@/lib/itinerary";
import { participantName, type Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";

export function ActivityDetailsDrawer({
  trip,
  participants,
  current,
  canEdit,
  onFailure,
  api,
  open,
  onOpenChange,
  finalFocus,
  expenseView,
  navigateExpenses,
  detailActivity,
  editedActivity,
  editSection,
  activityForm,
  sectionEditButton,
  sectionAddButton,
  detailContent,
  viewedCreator,
  isEditing,
  setDeleting,
  setViewing,
}: {
  trip: Trip;
  participants?: Participant[];
  current?: Participant;
  canEdit: boolean;
  onFailure: (error: Error) => void | Promise<void>;
  api: Pick<ReturnType<typeof useItineraryApi>, "pending" | "reset">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  expenseView: ActivityExpenseView;
  navigateExpenses: (next: ActivityExpenseView) => void;
  detailActivity?: Activity | null;
  editedActivity: Activity | null;
  editSection: EditSection;
  activityForm: ReactNode;
  sectionEditButton: SectionButton;
  sectionAddButton: SectionButton;
  detailContent: RefObject<HTMLDivElement | null>;
  viewedCreator?: Participant;
  isEditing: boolean;
  setDeleting: (activity: Activity | null) => void;
  setViewing: (id: number | null) => void;
}) {
  return (
    <TripDialog
      title={
        expenseView === "overview"
          ? (detailActivity?.title ?? "Activity details")
          : expenseView === "details" || expenseView === "personal"
            ? "Expenses"
            : "Borrow list"
      }
      focusTitleOnChange
      backLabel={
        expenseView === "overview"
          ? "Back to itinerary"
          : expenseView === "loans"
            ? "Back to expenses"
            : "Back to activity"
      }
      onBack={
        expenseView === "overview"
          ? undefined
          : () =>
              navigateExpenses(expenseView === "loans" ? "details" : "overview")
      }
      titleAccessory={
        detailActivity &&
        expenseView === "overview" && (
          <CategoryBadge category={detailActivity.category} />
        )
      }
      className="activity-details-dialog reference-activity-dialog"
      busy={api.pending}
      disablePointerDismissal={!!editedActivity}
      presentation="detail"
      mobilePresentation="fullscreen"
      headerContent={
        editedActivity && editSection === "details" ? activityForm : undefined
      }
      titleAction={
        expenseView === "overview" &&
        editSection === "details" &&
        editedActivity
          ? undefined
          : expenseView === "overview" &&
            sectionEditButton("details", "Edit activity details")
      }
      description={
        detailActivity && expenseView === "overview" ? (
          <span className="activity-detail-schedule">
            <span>
              <span className="activity-detail-date">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: trip.time_zone,
                }).formatRange(
                  new Date(detailActivity.starts_at),
                  new Date(detailActivity.ends_at),
                )}
              </span>
              <span className="activity-detail-time">
                {timeLabel(detailActivity.starts_at, trip.time_zone)} –{" "}
                {timeLabel(detailActivity.ends_at, trip.time_zone)}
                {" · "}
                {trip.time_zone}
              </span>
            </span>
          </span>
        ) : (
          (detailActivity?.title ?? "Activity details")
        )
      }
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={finalFocus}
      footer={
        detailActivity &&
        expenseView === "overview" && (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
              {participants
                ? `Created by ${viewedCreator ? participantName(viewedCreator) : "Former participant"}`
                : "Creator unavailable"}
            </p>
            {canEdit && (
              <Button
                className="activity-delete shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                variant="ghost"
                disabled={api.pending || isEditing}
                aria-label={`Delete ${detailActivity.title}`}
                onClick={() => {
                  api.reset();
                  setDeleting(detailActivity);
                  setViewing(null);
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            )}
          </div>
        )
      }
    >
      {detailActivity && (
        <div
          ref={detailContent}
          className="activity-detail-sections text-sm leading-6"
        >
          {editedActivity && !canEdit && (
            <p role="alert" className="text-sm text-destructive">
              Your edit permission has changed. Cancel to return to reading.
            </p>
          )}
          <ActivityExpenses
            key={detailActivity.id}
            trip={trip}
            participants={participants}
            current={current}
            activityID={String(detailActivity.id)}
            activityTitle={detailActivity.title}
            onFailure={onFailure}
            compact
            view={expenseView}
            onViewChange={navigateExpenses}
          />
          {expenseView === "overview" && (
            <ActivityDetailSections
              detailActivity={detailActivity}
              editedActivity={editedActivity}
              editSection={editSection}
              canEdit={canEdit}
              activityForm={activityForm}
              sectionEditButton={sectionEditButton}
              sectionAddButton={sectionAddButton}
            />
          )}
        </div>
      )}
    </TripDialog>
  );
}
