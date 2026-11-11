"use client";

import Link from "next/link";
import {
  ListChecks,
  MoreHorizontal,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";

export function TripOptionsDialog({
  tripID,
  tripName,
  memberCount,
  canEdit,
  menuOpen,
  setMenuOpen,
  peopleOpen,
  setPeopleOpen,
  editing,
  setEditing,
}: {
  tripID: number;
  tripName: string;
  memberCount?: number;
  canEdit: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  peopleOpen: boolean;
  setPeopleOpen: (open: boolean) => void;
  editing: boolean;
  setEditing: (open: boolean) => void;
}) {
  return (
    <TripDialog
      title="Trip options"
      description={tripName}
      mobilePresentation="sheet"
      open={menuOpen}
      onOpenChange={setMenuOpen}
      finalFocus={() =>
        peopleOpen || editing
          ? false
          : document.querySelector<HTMLButtonElement>(
              '[aria-label="Trip options"]',
            )
      }
      trigger={
        <Button
          variant="ghost"
          className="size-12 shrink-0"
          aria-label="Trip options"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      }
    >
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            setMenuOpen(false);
            setPeopleOpen(true);
          }}
        >
          <Users aria-hidden="true" />
          People {memberCount ?? ""}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          render={<Link href={`/trips/${tripID}/expenses`} />}
          nativeButton={false}
        >
          <Receipt aria-hidden="true" />
          Expenses
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          render={<Link href={`/trips/${tripID}/prep`} />}
          nativeButton={false}
        >
          <ListChecks aria-hidden="true" />
          Prep
        </Button>
        {canEdit && (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false);
              setEditing(true);
            }}
          >
            <Settings aria-hidden="true" />
            Settings
          </Button>
        )}
      </div>
    </TripDialog>
  );
}
