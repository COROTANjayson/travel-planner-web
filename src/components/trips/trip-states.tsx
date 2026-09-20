import Link from "next/link";
import { ApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function TripLoading() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading trips…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function TripError({ error, retry, pending = false }: {
  error: unknown;
  retry?: () => void;
  pending?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {error instanceof ApiError ? error.message : "Something went wrong. Please try again."}
      </AlertDescription>
      {retry && (
        <Button className="mt-3 min-h-11 w-fit" variant="outline" disabled={pending} onClick={retry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

export function TripNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trip not found</h1>
      <p className="text-muted-foreground">This trip is unavailable.</p>
      <Button className="min-h-11" variant="outline" render={<Link href="/trips" />} nativeButton={false}>
        Back to trips
      </Button>
    </div>
  );
}

