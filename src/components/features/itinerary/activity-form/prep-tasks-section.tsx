"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Add activity's title-only prep tasks (Figma "Add activity — prep tasks"). */
export function PrepTasksSection({
  prefix,
  tasks,
  setTasks,
}: {
  prefix: string;
  tasks: string[];
  setTasks: (tasks: string[]) => void;
}) {
  return (
    <div
      className="space-y-2"
      role="group"
      aria-labelledby={`${prefix}-prep-label`}
    >
      <p id={`${prefix}-prep-label`} className="text-sm leading-5 font-medium">
        Prep tasks
      </p>
      {tasks.map((task, index) => (
        <Input
          // Rows are only appended, so the index is stable.
          key={index}
          aria-label={`Prep task ${index + 1}`}
          autoFocus={index === tasks.length - 1}
          className="md:min-h-12"
          placeholder="e.g. Pack dry bags"
          value={task}
          onChange={(event) =>
            setTasks(
              tasks.map((current, i) =>
                i === index ? event.target.value : current,
              ),
            )
          }
        />
      ))}
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setTasks([...tasks, ""])}
      >
        <PlusIcon aria-hidden="true" />
        Add another
      </Button>
      <p className="text-[13px] leading-5 text-muted-foreground">
        Saved as up for grabs. Assign people from the activity later.
      </p>
    </div>
  );
}
