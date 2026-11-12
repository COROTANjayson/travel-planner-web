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
        <button
          type="button"
          className="mobile-nav-item group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-[0.1875rem] text-center text-[0.625rem] leading-[1.3] font-medium text-[var(--ocean-text)] [overflow-wrap:anywhere] select-none [-webkit-touch-callout:none] aria-[current=page]:bg-[var(--aqua)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ocean)] aria-expanded:bg-[var(--aqua)] aria-expanded:font-semibold aria-expanded:text-[var(--ocean)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)] not-aria-[current=page]:not-aria-expanded:hover:bg-[#28585d] active:bg-[#28585d] active:transition-none aria-[current=page]:active:bg-[#d5efe8] aria-expanded:active:bg-[#d5efe8]"
        >
          <span className="mobile-nav-icon inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out">
            <UserRound
              aria-hidden="true"
              className="size-[1.125rem] group-aria-[current=page]:[stroke-width:2.5] group-aria-expanded:[stroke-width:2.5]"
            />
          </span>
          <span>Account</span>
        </button>
      }
    >
      <div className="space-y-5">{accountContent}</div>
    </TripDialog>
  );
}
