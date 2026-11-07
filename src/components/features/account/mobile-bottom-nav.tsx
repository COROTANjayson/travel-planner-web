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
      className="mobile-bottom-nav fixed z-40 grid grid-cols-3 md:hidden"
    >
      <Link
        href="/trips"
        aria-current={pathname.startsWith("/trips") ? "page" : undefined}
        className="mobile-nav-item"
      >
        <span className="mobile-nav-icon">
          <Briefcase aria-hidden="true" className="size-5" />
        </span>
        <span>Trips</span>
      </Link>
      <Link
        href="/invitations"
        aria-current={pathname.startsWith("/invitations") ? "page" : undefined}
        className="mobile-nav-item"
      >
        <span className="mobile-nav-icon">
          <Mail aria-hidden="true" className="size-5" />
        </span>
        <span>Invitations</span>
      </Link>
      <AccountSheet accountContent={accountContent} />
    </nav>
  );
}
