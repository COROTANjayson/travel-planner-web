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
    <div className="activity-detail-notes">
      {(detailActivity.place ||
        canEdit ||
        (editedActivity && editSection === "place")) && (
        <section className="space-y-1">
          {editedActivity && editSection === "place" ? (
            activityForm
          ) : (
            <>
              <div className="activity-section-heading">
                <h3>Place</h3>
                {detailActivity.place &&
                  sectionEditButton("place", "Edit place")}
              </div>
              {detailActivity.place ? (
                <>
                  <p className="break-words font-medium">
                    {detailActivity.place.name}
                  </p>
                  {detailActivity.place.address && (
                    <p className="break-words text-muted-foreground">
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
        <section className="space-y-1">
          {editedActivity && editSection === "notes" ? (
            activityForm
          ) : (
            <>
              <div className="activity-section-heading">
                <h3>Notes</h3>
                {detailActivity.notes &&
                  sectionEditButton("notes", "Edit notes")}
              </div>
              {detailActivity.notes ? (
                <p className="whitespace-pre-wrap break-words">
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
        <section className="space-y-1">
          {editedActivity && editSection === "checklist" ? (
            activityForm
          ) : (
            <>
              <div className="activity-section-heading">
                <h3>To do</h3>
                {detailActivity.checklist.length > 0 &&
                  sectionEditButton("checklist", "Edit to do")}
              </div>
              {detailActivity.checklist.length > 0 ? (
                <ul className="space-y-1">
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
