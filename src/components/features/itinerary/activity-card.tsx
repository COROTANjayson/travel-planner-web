"use client";

import type { RefObject } from "react";
import {
  CaretRightIcon,
  ListChecksIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatActivityDuration } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";
import { isTaskDone, type PrepTask } from "@/lib/prep";

export function ActivityCard({
  activity,
  prepTasks,
  currentUserID,
  viewing,
  setViewing,
  detailTriggerRef,
}: {
  activity: Activity;
  prepTasks?: PrepTask[];
  currentUserID?: number;
  viewing: number | null;
  setViewing: (id: number | null) => void;
  detailTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const prepDone = prepTasks?.filter(isTaskDone).length ?? 0;
  const prepForYou =
    currentUserID === undefined
      ? 0
      : (prepTasks?.filter((task) =>
          task.kind === "everyone"
            ? task.waiting_user_ids.includes(currentUserID)
            : !isTaskDone(task) && task.assignee?.user_id === currentUserID,
        ).length ?? 0);
  return (
    <Card className="relative min-w-0 gap-0 ring-0">
      <CardContent className="rounded-[inherit] px-3">
        <button
          type="button"
          className="absolute inset-0 cursor-pointer rounded-[inherit] outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          aria-label={`View details for ${activity.title}`}
          aria-haspopup="dialog"
          data-selected={viewing === activity.id || undefined}
          onClick={(event) => {
            detailTriggerRef.current = event.currentTarget;
            setViewing(activity.id);
          }}
        />
        <div className="activity-card-body pointer-events-none relative [&>h4]:[margin-top:0.5rem] [&>p]:[margin-top:1rem]">
          <div className="activity-card-meta [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:0.75rem]">
            <CategoryBadge category={activity.category} />
            <span className="activity-card-actions [display:flex] [align-items:center] [gap:1.5rem] [flex-shrink:0] [padding-top:0.25rem]">
              <span className="activity-duration [font-size:0.75rem] [line-height:1rem] [color:var(--muted-foreground)] [white-space:nowrap]">
                {formatActivityDuration(activity.starts_at, activity.ends_at)}
              </span>
              <CaretRightIcon
                aria-hidden="true"
                className="activity-open-cue [width:1rem] [height:1rem] [color:var(--primary)] [flex-shrink:0]"
              />
            </span>
          </div>
          <h4 className="break-words text-lg leading-[1.625rem] font-semibold md:text-xl md:leading-7">
            {activity.title}
          </h4>
          {activity.place && (
            <p className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
              <MapPinIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="min-w-0 break-words">{activity.place.name}</span>
            </p>
          )}
          {!!prepTasks?.length && (
            <p
              className={`flex items-center gap-2 text-sm leading-5 ${prepForYou ? "text-primary" : "text-muted-foreground"}`}
            >
              <ListChecksIcon aria-hidden="true" className="size-4 shrink-0" />
              {prepForYou
                ? `${prepForYou} prep ${prepForYou === 1 ? "task" : "tasks"} for you`
                : `${prepDone} of ${prepTasks.length} prep done`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
