"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { tripPageSize } from "@/lib/trips";

export function TripPagination({
  offset,
  setOffset,
  isFetching,
  isError,
  filteredCount,
}: {
  offset: number;
  setOffset: Dispatch<SetStateAction<number>>;
  isFetching: boolean;
  isError: boolean;
  filteredCount: number;
}) {
  return (
    <nav
      aria-label="Trip pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        className="min-h-11"
        disabled={offset === 0 || isFetching}
        onClick={() =>
          setOffset((current) => Math.max(0, current - tripPageSize))
        }
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {offset / tripPageSize + 1}
      </span>
      <Button
        variant="outline"
        className="min-h-11"
        disabled={
          isFetching || isError || offset + tripPageSize >= filteredCount
        }
        onClick={() => setOffset((current) => current + tripPageSize)}
      >
        Next
      </Button>
    </nav>
  );
}
