"use client";

import { Button } from "@/components/ui/button";

export function SignedOutActions({
  authError,
  actionError,
  signIn,
}: {
  authError?: Error;
  actionError?: string;
  signIn: (signUp?: boolean) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {(authError || actionError) && (
        <p role="alert" className="max-w-60 text-sm text-destructive">
          {actionError || "Authentication is unavailable. Please try again."}
        </p>
      )}
      <Button
        variant="ghost"
        className="h-10 px-4"
        onClick={() => void signIn()}
      >
        Log in
      </Button>
      <Button className="h-10 px-4" onClick={() => void signIn(true)}>
        Sign up
      </Button>
    </div>
  );
}
