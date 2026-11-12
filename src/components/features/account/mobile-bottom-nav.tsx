"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Briefcase, Mail } from "lucide-react";
import { AccountSheet } from "@/components/features/account/account-sheet";

export function MobileBottomNav({
  pathname,
  accountContent,
}: {
  pathname: string;
  accountContent: ReactNode;
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-bottom-nav left-[max(1rem,env(safe-area-inset-left,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] mx-auto max-w-[26.25rem] gap-1 rounded-full border-0 bg-[var(--ocean)] p-1.5 shadow-[0_5px_18px_#123c401a] fixed z-40 grid grid-cols-3 md:hidden"
    >
      <Link
        href="/trips"
        aria-current={pathname.startsWith("/trips") ? "page" : undefined}
        className="mobile-nav-item group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-[0.1875rem] text-center text-[0.625rem] leading-[1.3] font-medium text-[var(--ocean-text)] [overflow-wrap:anywhere] select-none [-webkit-touch-callout:none] aria-[current=page]:bg-[var(--aqua)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ocean)] aria-expanded:bg-[var(--aqua)] aria-expanded:font-semibold aria-expanded:text-[var(--ocean)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)] not-aria-[current=page]:not-aria-expanded:hover:bg-[#28585d] active:bg-[#28585d] active:transition-none aria-[current=page]:active:bg-[#d5efe8] aria-expanded:active:bg-[#d5efe8]"
      >
        <span className="mobile-nav-icon inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out">
          <Briefcase
            aria-hidden="true"
            className="size-[1.125rem] group-aria-[current=page]:[stroke-width:2.5] group-aria-expanded:[stroke-width:2.5]"
          />
        </span>
        <span>Trips</span>
      </Link>
      <Link
        href="/invitations"
        aria-current={pathname.startsWith("/invitations") ? "page" : undefined}
        className="mobile-nav-item group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-[0.1875rem] text-center text-[0.625rem] leading-[1.3] font-medium text-[var(--ocean-text)] [overflow-wrap:anywhere] select-none [-webkit-touch-callout:none] aria-[current=page]:bg-[var(--aqua)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ocean)] aria-expanded:bg-[var(--aqua)] aria-expanded:font-semibold aria-expanded:text-[var(--ocean)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)] not-aria-[current=page]:not-aria-expanded:hover:bg-[#28585d] active:bg-[#28585d] active:transition-none aria-[current=page]:active:bg-[#d5efe8] aria-expanded:active:bg-[#d5efe8]"
      >
        <span className="mobile-nav-icon inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out">
          <Mail
            aria-hidden="true"
            className="size-[1.125rem] group-aria-[current=page]:[stroke-width:2.5] group-aria-expanded:[stroke-width:2.5]"
          />
        </span>
        <span>Invitations</span>
      </Link>
      <AccountSheet accountContent={accountContent} />
    </nav>
  );
}
