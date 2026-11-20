"use client";

import Link from "next/link";
import {
  ListChecksIcon,
  DotsThreeIcon,
  ReceiptIcon,
  GearIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";

export function TripOptionsDialog({
  tripID,
  tripName,
  itineraryStyle = false,
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
  itineraryStyle?: boolean;
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
      itineraryStyle={itineraryStyle}
      headerClassName={
        itineraryStyle
          ? "[&_[data-slot=trip-dialog-description]]:sr-only"
          : undefined
      }
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
          <DotsThreeIcon
            aria-hidden="true"
            className={itineraryStyle ? "size-5" : undefined}
          />
        </Button>
      }
    >
      <div
        className={
          itineraryStyle
            ? "grid gap-1 [&_[data-slot=button]]:gap-3 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:text-base [&_[data-slot=button]]:font-normal [&_svg]:size-5"
            : "space-y-2"
        }
      >
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            setMenuOpen(false);
            setPeopleOpen(true);
          }}
        >
          <UsersIcon aria-hidden="true" />
          People {memberCount ?? ""}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          render={<Link href={`/trips/${tripID}/expenses`} />}
          nativeButton={false}
        >
          <ReceiptIcon aria-hidden="true" />
          Expenses
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          render={<Link href={`/trips/${tripID}/prep`} />}
          nativeButton={false}
        >
          <ListChecksIcon aria-hidden="true" />
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
            <GearIcon aria-hidden="true" />
            Settings
          </Button>
        )}
      </div>
    </TripDialog>
  );
}
