import Link from "next/link";
import { ApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function TripLoading({ overview = false }: { overview?: boolean }) {
  return (
    <div
      role="status"
      className={
        overview
          ? "grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2"
          : "grid gap-5 lg:grid-cols-2"
      }
    >
      <span className="sr-only">Loading trips…</span>
      {[0, 1, ...(overview ? [2] : [])].map((index) => (
        <div
          key={index}
          className={
            overview
              ? "min-h-52 space-y-4 rounded-3xl bg-muted p-6 first:min-h-60 first:lg:col-span-full lg:px-7"
              : "surface border border-border rounded-2xl bg-card space-y-4 p-5"
          }
        >
          <Skeleton className="h-6 w-40 max-w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-5 h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TripError({
  error,
  retry,
  pending = false,
}: {
  error: unknown;
  retry?: () => void;
  pending?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again."}
      </AlertDescription>
      {retry && (
        <Button
          className="mt-3 min-h-11 w-fit"
          variant="outline"
          disabled={pending}
          onClick={retry}
        >
          Try again
        </Button>
      )}
    </Alert>
  );
}

export function TripNotFound() {
  return (
    <div className="surface border border-border rounded-2xl bg-card space-y-4 p-6">
      <h1 className="page-title text-3xl font-[650] leading-[1.2] tracking-[-0.03em] text-balance md:[&]:[font-size:2.25rem]">
        Trip not found
      </h1>
      <p className="text-muted-foreground">This trip is unavailable.</p>
      <Button
        className="min-h-11"
        variant="outline"
        render={<Link href="/trips" />}
        nativeButton={false}
      >
        Back to trips
      </Button>
    </div>
  );
}
