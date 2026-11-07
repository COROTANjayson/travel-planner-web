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

export function PersonOptions({
  name,
  disabled,
  onTransfer,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onTransfer: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            className="size-11 min-h-11"
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
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            setOpen(false);
            onTransfer();
          }}
        >
          Transfer ownership
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setOpen(false);
            onRemove();
          }}
        >
          Remove
        </Button>
      </PopoverContent>
    </Popover>
  );
}
