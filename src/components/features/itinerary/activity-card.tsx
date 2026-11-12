"use client";

import type { RefObject } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatActivityDuration } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";

export function ActivityCard({
  activity,
  viewing,
  setViewing,
  detailTriggerRef,
}: {
  activity: Activity;
  viewing: number | null;
  setViewing: (id: number | null) => void;
  detailTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Card className="relative min-w-0 gap-0 ring-0">
      <CardContent className="px-3">
        <button
          type="button"
          className="absolute inset-0 cursor-pointer rounded-2xl outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          aria-label={`View details for ${activity.title}`}
          aria-haspopup="dialog"
          data-selected={viewing === activity.id || undefined}
          onClick={(event) => {
            detailTriggerRef.current = event.currentTarget;
            setViewing(activity.id);
          }}
        />
        <div className="activity-card-body pointer-events-none relative [&>h4]:[margin-top:0.5rem] [&>p]:[margin-top:1rem] md:[&_>_p]:[font-size:0.75rem] md:[&_>_p]:[line-height:1.25rem]">
          <div className="activity-card-meta [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:0.75rem]">
            <CategoryBadge category={activity.category} />
            <span className="activity-card-actions [display:flex] [align-items:center] [gap:1.5rem] [flex-shrink:0] [padding-top:0.25rem] md:[&]:[padding-top:0]">
              <span className="activity-duration [font-size:0.75rem] [line-height:1.25rem] [color:var(--muted-foreground)] [white-space:nowrap]">
                {formatActivityDuration(activity.starts_at, activity.ends_at)}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="activity-open-cue [width:1rem] [height:1rem] [color:var(--primary)] [flex-shrink:0]"
              />
            </span>
          </div>
          <h4 className="break-words text-lg leading-7 font-semibold md:text-xl">
            {activity.title}
          </h4>
          {activity.place && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{activity.place.name}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
