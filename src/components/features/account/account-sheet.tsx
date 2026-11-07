"use client";

import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { TripDialog } from "@/components/shared/trip-dialog";

export function AccountSheet({
  accountContent,
}: {
  accountContent: ReactNode;
}) {
  return (
    <TripDialog
      title="My account"
      description="Your traveler profile and session."
      mobilePresentation="sheet"
      trigger={
        <button type="button" className="mobile-nav-item">
          <span className="mobile-nav-icon">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <span>Account</span>
        </button>
      }
    >
      <div className="space-y-5">{accountContent}</div>
    </TripDialog>
  );
}
