import { TagIcon } from "@phosphor-icons/react";
import { activityCategoryColors, activityCategoryIcons } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

export function CategoryBadge({
  category,
  iconOnly,
  className,
}: {
  category: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const Icon = Object.hasOwn(activityCategoryIcons, category)
    ? activityCategoryIcons[category]
    : TagIcon;
  return (
    <span
      className={cn(
        "activity-category inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs leading-5 font-medium text-muted-foreground [&[data-icon-only]]:size-11 [&[data-icon-only]]:shrink-0 [&[data-icon-only]]:justify-center [&[data-icon-only]]:rounded-xl [&[data-icon-only]]:p-0 [&[data-icon-only]_svg]:size-5",
        activityCategoryColors[category],
        className,
      )}
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
