"use client";

import { fieldRequired } from "@/components/shared/field-required";
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
}: {
  prefix: string;
  categoryChoice: string;
  setCategoryChoice: (choice: string) => void;
  customCategory: string;
  setCustomCategory: (category: string) => void;
}) {
  return (
    <div className="space-y-2">
      <fieldset className="activity-category-chips [display:flex] [flex-wrap:wrap] [gap:0.5rem] [min-width:0]">
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
              className="activity-category activity-category-chip inline-flex min-h-11 max-w-full flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-muted px-3 py-1 text-xs leading-5 font-medium text-muted-foreground [&[data-icon-only]]:[width:2.75rem] [&[data-icon-only]]:[height:2.75rem] [&[data-icon-only]]:[flex-shrink:0] [&[data-icon-only]]:[justify-content:center] [&[data-icon-only]]:[border-radius:0.75rem] [&[data-icon-only]]:[padding:0] [&[data-icon-only]_svg]:[width:1.25rem] [&[data-icon-only]_svg]:[height:1.25rem] [&[data-category='Rest']]:[background:#f0ebfa] [&[data-category='Rest']]:[color:#65438b] [&[data-category='Eating']]:[background:#fff0e2] [&[data-category='Eating']]:[color:#945020] [&[data-category='Travel']]:[background:#e8f0ff] [&[data-category='Travel']]:[color:#315da3] [&[data-category='Activity']]:[background:#e6f4ec] [&[data-category='Activity']]:[color:#316747] [&:not(:has(:checked))]:[background:var(--card)] [&:not(:has(:checked))]:[color:var(--foreground)] [&:not(:has(:checked))]:[box-shadow:inset_0_0_0_1px_var(--input)] [&:has(:checked)]:[box-shadow:inset_0_0_0_2px_currentColor] [&:has(:checked)]:[font-weight:600] [&:has(:focus-visible)]:[outline:2px_solid_var(--ring)] [&:has(:focus-visible)]:[outline-offset:2px] [&:has(:disabled)]:[cursor:default] [&:has(:disabled)]:[opacity:0.5]"
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
            className={fieldRequired}
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
