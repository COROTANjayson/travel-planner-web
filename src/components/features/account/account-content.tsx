"use client";

import type { useAuth0 } from "@auth0/auth0-react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, type ApiUser } from "@/lib/api";

export function AccountContent({
  user,
  name,
  actionError,
  setActionError,
  queryClient,
  logout,
}: {
  user: UseQueryResult<ApiUser | undefined>;
  name: string;
  actionError?: string;
  setActionError: (error: string | undefined) => void;
  queryClient: QueryClient;
  logout: ReturnType<typeof useAuth0>["logout"];
}) {
  return (
    <>
      {user.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your profile…
        </p>
      ) : user.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {user.error instanceof ApiError
              ? user.error.message
              : "Could not load your profile. Please try again."}
          </p>
          <Button
            variant="outline"
            disabled={user.isFetching}
            onClick={() => void user.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-2 break-words">
          <span className="participant-avatar" aria-hidden="true">
            <UserRound className="size-5" />
          </span>
          <p className="font-semibold">Welcome back, {name}</p>
          <p className="text-sm text-muted-foreground">
            {user.data?.email || "No email provided"}
          </p>
        </div>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <Button
        variant="outline"
        className="h-10 w-full"
        onClick={async () => {
          setActionError(undefined);
          try {
            queryClient.clear();
            await logout({
              logoutParams: { returnTo: window.location.origin },
            });
          } catch {
            setActionError("Unable to log out. Please try again.");
          }
        }}
      >
        Log out
      </Button>
    </>
  );
}
