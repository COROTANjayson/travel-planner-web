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
        <div className="activity-card-body pointer-events-none relative">
          <div className="activity-card-meta">
            <CategoryBadge category={activity.category} />
            <span className="activity-card-actions">
              <span className="activity-duration">
                {formatActivityDuration(activity.starts_at, activity.ends_at)}
              </span>
              <ChevronRight aria-hidden="true" className="activity-open-cue" />
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
