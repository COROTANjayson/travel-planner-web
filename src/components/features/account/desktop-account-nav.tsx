"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DesktopAccountNav({
  pathname,
  accountContent,
}: {
  pathname: string;
  accountContent: ReactNode;
}) {
  return (
    <div className="hidden flex-wrap items-center gap-1 md:flex">
      <Button
        variant="ghost"
        className="min-h-11"
        aria-current={pathname.startsWith("/trips") ? "page" : undefined}
        render={<Link href="/trips" />}
        nativeButton={false}
      >
        Trips
      </Button>
      <Button
        variant="ghost"
        className="min-h-11"
        aria-current={pathname.startsWith("/invitations") ? "page" : undefined}
        render={<Link href="/invitations" />}
        nativeButton={false}
      >
        Invitations
      </Button>
      <Popover>
        <PopoverTrigger
          render={<Button variant="ghost" className="min-h-11" />}
        >
          <UserRound aria-hidden="true" className="size-4" />
          My account
          <ChevronDown aria-hidden="true" className="size-4" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-72 max-w-[calc(100vw-3rem)] gap-4 border p-5"
        >
          <PopoverTitle className="sr-only">My account</PopoverTitle>
          {accountContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}
