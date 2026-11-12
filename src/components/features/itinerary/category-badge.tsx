import { Tag } from "lucide-react";
import { activityCategoryIcons } from "@/lib/itinerary";
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
    : Tag;
  return (
    <span
      className={cn(
        "activity-category inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs leading-5 font-medium text-muted-foreground [&[data-icon-only]]:size-11 [&[data-icon-only]]:shrink-0 [&[data-icon-only]]:justify-center [&[data-icon-only]]:rounded-xl [&[data-icon-only]]:p-0 [&[data-icon-only]_svg]:size-5 [&[data-category='Rest']]:bg-[#f0ebfa] [&[data-category='Rest']]:text-[#65438b] [&[data-category='Eating']]:bg-[#fff0e2] [&[data-category='Eating']]:text-[#945020] [&[data-category='Travel']]:bg-[#e8f0ff] [&[data-category='Travel']]:text-[#315da3] [&[data-category='Activity']]:bg-[#e6f4ec] [&[data-category='Activity']]:text-[#316747]",
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
