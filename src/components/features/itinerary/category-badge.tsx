import { Tag } from "lucide-react";
import { activityCategoryIcons } from "@/lib/itinerary";

export function CategoryBadge({ category }: { category: string }) {
  const Icon = Object.hasOwn(activityCategoryIcons, category)
    ? activityCategoryIcons[category]
    : Tag;
  return (
    <span className="activity-category" data-category={category}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{category}</span>
    </span>
  );
}
