"use client";

import { cn } from "@/lib/utils";
import { fieldRequired } from "@/components/shared/field-required";
import { PlusIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activityCategories,
  activityCategoryColors,
  activityCategoryIcons,
} from "@/lib/itinerary";

export function CategoryField({
  prefix,
  categoryChoice,
  setCategoryChoice,
  customCategory,
  setCustomCategory,
}: {
  prefix: string;
  categoryChoice: string;
  setCategoryChoice: (choice: string) => void;
  customCategory: string;
  setCustomCategory: (category: string) => void;
}) {
  return (
    <div className="space-y-2">
      <fieldset className="activity-category-chips flex min-w-0 flex-wrap gap-x-2 gap-y-2 max-md:gap-x-1.5">
        <legend className="mb-2 text-sm leading-5 font-medium">
          What kind of plan?
        </legend>
        {[...activityCategories, "Custom"].map((category) => {
          const value = category === "Custom" ? "custom" : category;
          const selected = categoryChoice === value;
          const Icon = Object.hasOwn(activityCategoryIcons, category)
            ? activityCategoryIcons[category]
            : PlusIcon;
          return (
            <label
              key={category}
              data-category={category}
              className={cn(
                "activity-category activity-category-chip inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 whitespace-nowrap text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-default has-disabled:opacity-50 max-md:h-10 max-md:gap-1 max-md:px-2.5",
                selected
                  ? cn(
                      // Selected chips take their itinerary badge colours.
                      "border-current text-xs leading-5 font-semibold",
                      activityCategoryColors[category] ??
                        "bg-secondary text-secondary-foreground",
                    )
                  : cn(
                      "text-sm leading-5 max-md:text-xs max-md:leading-4 max-md:font-medium",
                      category === "Custom"
                        ? "border-dashed border-input"
                        : "border-transparent bg-muted",
                    ),
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${prefix}-category`}
                value={value}
                checked={selected}
                onChange={() => {
                  setCategoryChoice(value);
                }}
              />
              <Icon
                aria-hidden="true"
                weight={selected && category !== "Custom" ? "fill" : "regular"}
                className={cn(
                  "size-4 shrink-0 max-md:size-3.5",
                  !selected && "text-muted-foreground",
                )}
              />
              {category}
            </label>
          );
        })}
      </fieldset>
      {categoryChoice === "custom" && (
        <div className="space-y-2">
          <Label
            htmlFor={`${prefix}-custom-category`}
            className={fieldRequired}
          >
            Custom category
          </Label>
          <Input
            id={`${prefix}-custom-category`}
            required
            className="md:min-h-12"
            value={customCategory}
            placeholder="e.g. Shopping"
            onChange={(event) => setCustomCategory(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This label belongs to this activity.
          </p>
        </div>
      )}
    </div>
  );
}
