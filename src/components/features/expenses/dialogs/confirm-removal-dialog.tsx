"use client";

import { useRef, useState, type ComponentProps } from "react";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Confirms removing one of your own records: a personal expense or money lent. */
export function ConfirmRemovalDialog({
  title,
  description,
  summary,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
  finalFocus,
}: {
  title: string;
  description: string;
  summary: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  finalFocus: ComponentProps<typeof AlertDialogContent>["finalFocus"];
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !busy.current) onClose();
      }}
    >
      <AlertDialogContent
        tripSheet
        className="p-0! pb-[env(safe-area-inset-bottom)]!"
        initialFocus={cancel}
        finalFocus={finalFocus}
        aria-busy={pending}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-6 pb-5 [overflow-wrap:anywhere]">
          <p className="font-semibold">{summary}</p>
          {error && <TripError error={error} />}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            ref={cancel}
            disabled={pending}
            className="min-h-11"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            className="min-h-11"
            onClick={async () => {
              if (pending || busy.current) return;
              busy.current = true;
              setError(null);
              try {
                await onConfirm();
              } catch (cause) {
                setError(cause as Error);
              } finally {
                busy.current = false;
              }
            }}
          >
            {pending ? "Deleting…" : error ? "Try again" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
