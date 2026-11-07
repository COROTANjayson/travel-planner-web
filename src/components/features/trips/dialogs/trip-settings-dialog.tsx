"use client";

import { Settings } from "lucide-react";
import { DeleteTripDialog } from "@/components/features/trips/dialogs/delete-trip-dialog";
import { TripForm } from "@/components/features/trips/trip-form";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import type { Trip, TripInput } from "@/lib/trips";

export function TripSettingsDialog({
  trip,
  canManage,
  editing,
  setEditing,
  confirming,
  setConfirming,
  update,
  remove,
}: {
  trip: Trip;
  canManage: boolean;
  editing: boolean;
  setEditing: (open: boolean) => void;
  confirming: boolean;
  setConfirming: (open: boolean) => void;
  update: {
    isPending: boolean;
    error: Error | null;
    mutate: (input: TripInput) => void;
    reset: () => void;
  };
  remove: {
    isPending: boolean;
    error: Error | null;
    mutate: () => void;
    reset: () => void;
  };
}) {
  return (
    <TripDialog
      title="Trip settings"
      description="Update your destination, dates, and time zone."
      open={editing}
      onOpenChange={(open) => {
        if (!update.isPending && !remove.isPending) {
          update.reset();
          setEditing(open);
        }
      }}
      trigger={
        <Button
          variant="ghost"
          className="trip-settings size-11 min-h-11"
          aria-label="Trip settings"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Button>
      }
    >
      <TripForm
        initialValue={trip}
        onSubmit={(input) => update.mutate(input)}
        pending={update.isPending}
        error={update.error}
        submitLabel="Save changes"
        cancel={
          <Button
            type="button"
            className="min-h-11"
            variant="outline"
            disabled={update.isPending}
            onClick={() => {
              update.reset();
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        }
      />
      {canManage && (
        <div className="mt-6 border-t pt-5">
          <DeleteTripDialog
            confirming={confirming}
            setConfirming={setConfirming}
            remove={remove}
          />
        </div>
      )}
    </TripDialog>
  );
}
