import { Tag } from "lucide-react";
import { activityCategoryIcons } from "@/lib/itinerary";

export function CategoryBadge({
  category,
  iconOnly,
}: {
  category: string;
  iconOnly?: boolean;
}) {
  const Icon = Object.hasOwn(activityCategoryIcons, category)
    ? activityCategoryIcons[category]
    : Tag;
  return (
    <span
      className="activity-category"
      data-category={category}
      data-icon-only={iconOnly || undefined}
      title={iconOnly ? category : undefined}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className={iconOnly ? "sr-only" : "min-w-0 break-words"}>
        {category}
      </span>
    </span>
  );
}
