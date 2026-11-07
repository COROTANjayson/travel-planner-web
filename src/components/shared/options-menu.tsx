"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function OptionsMenu({
  name,
  disabled,
  items,
}: {
  name: string;
  disabled?: boolean;
  items: { label: string; onClick: () => void; destructive?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            className="size-11 min-h-11 shrink-0"
            aria-label={`More options for ${name}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 max-w-[calc(100vw-3rem)] gap-0 p-1"
      >
        <PopoverTitle className="sr-only">Options for {name}</PopoverTitle>
        {items.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={`min-h-11 w-full justify-start${item.destructive ? " text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}`}
            onClick={() => {
              setOpen(false);
              item.onClick();
            }}
          >
            {item.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
