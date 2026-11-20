"use client";

import type { ReactNode } from "react";
import { UserIcon } from "@phosphor-icons/react";
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
      className="max-md:inset-x-[max(1rem,env(safe-area-inset-left,0px))] max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-md:w-auto max-md:rounded-2xl max-md:p-0"
      headerClassName="max-md:px-5 max-md:py-4"
      bodyClassName="max-md:px-5 max-md:py-4"
      trigger={
        <button
          type="button"
          className="mobile-nav-item group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-[0.1875rem] text-center text-[0.625rem] leading-[1.3] font-medium text-[var(--ocean-text)] [overflow-wrap:anywhere] select-none [-webkit-touch-callout:none] aria-[current=page]:bg-[var(--aqua)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ocean)] aria-expanded:bg-[var(--aqua)] aria-expanded:font-semibold aria-expanded:text-[var(--ocean)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)] not-aria-[current=page]:not-aria-expanded:hover:bg-[#28585d] active:bg-[#28585d] active:transition-none aria-[current=page]:active:bg-[#d5efe8] aria-expanded:active:bg-[#d5efe8]"
        >
          <span className="mobile-nav-icon inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out">
            <UserIcon
              aria-hidden="true"
              className="size-[1.125rem] group-aria-expanded:hidden"
            />
            <UserIcon
              aria-hidden="true"
              className="hidden size-[1.125rem] group-aria-expanded:block"
              weight="bold"
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
