"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  ChevronDown,
  Compass,
  Mail,
  Plus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function WorkspaceSidebar({
  pathname,
  accountContent,
}: {
  pathname: string;
  accountContent: ReactNode;
}) {
  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <Link
        href="/trips"
        className="sidebar-brand"
        aria-label="Travel Planner home"
      >
        <span className="brand-mark">
          <Compass aria-hidden="true" />
        </span>
        <span>
          Travel
          <br />
          Planner
        </span>
      </Link>
      <Button
        className="sidebar-create"
        render={<Link href="/trips/new" />}
        nativeButton={false}
      >
        <Plus aria-hidden="true" />
        Create a trip
      </Button>
      <nav className="sidebar-links" aria-label="Main navigation">
        <Link
          href="/trips"
          aria-current={pathname.startsWith("/trips") ? "page" : undefined}
        >
          <Briefcase aria-hidden="true" />
          My trips
        </Link>
        <Link
          href="/invitations"
          aria-current={
            pathname.startsWith("/invitations") ? "page" : undefined
          }
        >
          <Mail aria-hidden="true" />
          Invitations
        </Link>
      </nav>
      <div className="sidebar-foot">
        <div className="sidebar-journey" aria-hidden="true" />
        <p>
          A little planning.
          <br />A lot to look forward to.
        </p>
        <Popover>
          <PopoverTrigger
            render={<button type="button" className="sidebar-account" />}
          >
            <span className="sidebar-avatar">
              <UserRound aria-hidden="true" />
            </span>
            <span>
              <strong>Your account</strong>
              <small>Make yourself at home</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={16}
            className="w-72 max-w-[calc(100vw-3rem)] gap-4 border p-5"
          >
            <PopoverTitle className="sr-only">My account</PopoverTitle>
            {accountContent}
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
