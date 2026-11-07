"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { TripError } from "@/components/shared/trip-states";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OverlapNotice({
  overlaps,
}: {
  overlaps: UseQueryResult<
    | Array<{ id: number; title: string; starts_at: string; ends_at: string }>
    | undefined
  >;
}) {
  return overlaps.isPending ? (
    <p role="status" className="text-sm">
      Checking other activities…
    </p>
  ) : overlaps.isError ? (
    <TripError error={overlaps.error} retry={() => void overlaps.refetch()} />
  ) : overlaps.data && overlaps.data.length > 0 ? (
    <Alert>
      <AlertDescription>
        Overlaps {overlaps.data.map((item) => item.title).join(", ")}. Parallel
        activities are allowed.
      </AlertDescription>
    </Alert>
  ) : null;
}
