"use client";

import type { ReactNode } from "react";
import type { Activity } from "@/lib/itinerary";

export type EditSection = "details" | "place" | "notes" | "checklist";
export type SectionButton = (section: EditSection, label: string) => ReactNode;

export function ActivityDetailSections({
  detailActivity,
  editedActivity,
  editSection,
  canEdit,
  activityForm,
  sectionEditButton,
  sectionAddButton,
}: {
  detailActivity: Activity;
  editedActivity: Activity | null;
  editSection: EditSection;
  canEdit: boolean;
  activityForm: ReactNode;
  sectionEditButton: SectionButton;
  sectionAddButton: SectionButton;
}) {
  return (
    <div className="activity-detail-notes lg:min-w-0">
      {(detailActivity.place ||
        canEdit ||
        (editedActivity && editSection === "place")) && (
        <section className="space-y-1 border-t border-border pt-6 pb-7 first:border-t-0">
          {editedActivity && editSection === "place" ? (
            activityForm
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] leading-7 font-bold text-foreground">
                  Place
                </h3>
                {detailActivity.place &&
                  sectionEditButton("place", "Edit place")}
              </div>
              {detailActivity.place ? (
                <>
                  <p className="break-words font-medium lg:max-w-[70ch]">
                    {detailActivity.place.name}
                  </p>
                  {detailActivity.place.address && (
                    <p className="break-words text-muted-foreground lg:max-w-[70ch]">
                      {detailActivity.place.address}
                    </p>
                  )}
                </>
              ) : (
                sectionAddButton("place", "Add place")
              )}
            </>
          )}
        </section>
      )}
      {(detailActivity.notes ||
        canEdit ||
        (editedActivity && editSection === "notes")) && (
        <section className="space-y-1 border-t border-border pt-6 pb-7 first:border-t-0">
          {editedActivity && editSection === "notes" ? (
            activityForm
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] leading-7 font-bold text-foreground">
                  Notes
                </h3>
                {detailActivity.notes &&
                  sectionEditButton("notes", "Edit notes")}
              </div>
              {detailActivity.notes ? (
                <p className="whitespace-pre-wrap break-words lg:max-w-[70ch]">
                  {detailActivity.notes}
                </p>
              ) : (
                sectionAddButton("notes", "Add notes")
              )}
            </>
          )}
        </section>
      )}
      {(detailActivity.checklist.length > 0 ||
        canEdit ||
        (editedActivity && editSection === "checklist")) && (
        <section className="space-y-1 border-t border-border pt-6 pb-7 first:border-t-0">
          {editedActivity && editSection === "checklist" ? (
            activityForm
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] leading-7 font-bold text-foreground">
                  To do
                </h3>
                {detailActivity.checklist.length > 0 &&
                  sectionEditButton("checklist", "Edit to do")}
              </div>
              {detailActivity.checklist.length > 0 ? (
                <ul className="space-y-1 lg:max-w-[70ch]">
                  {detailActivity.checklist.map((item, index) => (
                    <li key={index} className="whitespace-pre-wrap break-words">
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : (
                sectionAddButton("checklist", "Add to-do")
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
