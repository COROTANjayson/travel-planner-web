"use client";

import { Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activityCategories, activityCategoryIcons } from "@/lib/itinerary";

export function CategoryField({
  prefix,
  categoryChoice,
  setCategoryChoice,
  customCategory,
  setCustomCategory,
  markDirty,
}: {
  prefix: string;
  categoryChoice: string;
  setCategoryChoice: (choice: string) => void;
  customCategory: string;
  setCustomCategory: (category: string) => void;
  markDirty: () => void;
}) {
  return (
    <div className="space-y-2">
      <fieldset className="activity-category-chips">
        <legend className="mb-2 text-sm leading-none font-medium">
          Category
        </legend>
        {[...activityCategories, "Custom"].map((category) => {
          const value = category === "Custom" ? "custom" : category;
          const Icon = Object.hasOwn(activityCategoryIcons, category)
            ? activityCategoryIcons[category]
            : Tag;
          return (
            <label
              key={category}
              className="activity-category activity-category-chip"
              data-category={category}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${prefix}-category`}
                value={value}
                checked={categoryChoice === value}
                onChange={() => {
                  setCategoryChoice(value);
                  markDirty();
                }}
              />
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {category}
            </label>
          );
        })}
      </fieldset>
      {categoryChoice === "custom" && (
        <div className="space-y-2">
          <Label
            htmlFor={`${prefix}-custom-category`}
            className="field-required"
          >
            Custom category
          </Label>
          <Input
            id={`${prefix}-custom-category`}
            required
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
