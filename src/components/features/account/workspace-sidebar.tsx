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
    <aside
      className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:h-dvh lg:w-[236px] lg:flex-col lg:overflow-y-auto lg:rounded-r-[28px] lg:bg-[var(--ocean)] lg:px-[1.375rem] lg:pt-8 lg:pb-5 lg:text-white [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-[var(--aqua)]"
      aria-label="Workspace navigation"
    >
      <Link
        href="/trips"
        className="sidebar-brand flex items-center gap-3 text-lg leading-[1.25] font-semibold"
        aria-label="Travel Planner home"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-[0.875rem] bg-[#28585d] text-[#f1faf6]">
          <Compass aria-hidden="true" className="size-[1.625rem]" />
        </span>
        <span>
          Travel
          <br />
          Planner
        </span>
      </Link>
      <Button
        className="sidebar-create mt-11 mb-8 min-h-12 w-full rounded-full bg-[var(--aqua)] text-[var(--ocean)] hover:bg-[#d5efe8]"
        render={<Link href="/trips/new" />}
        nativeButton={false}
      >
        <Plus aria-hidden="true" />
        Create a trip
      </Button>
      <nav className="sidebar-links grid gap-3" aria-label="Main navigation">
        <Link
          href="/trips"
          aria-current={pathname.startsWith("/trips") ? "page" : undefined}
          className="flex min-h-12 items-center gap-3 rounded-[0.875rem] px-4 py-3 text-sm text-[var(--ocean-text)] hover:bg-[#28585d] hover:text-white aria-[current=page]:bg-[#28585d] aria-[current=page]:text-white"
        >
          <Briefcase aria-hidden="true" className="size-5 shrink-0" />
          My trips
        </Link>
        <Link
          href="/invitations"
          aria-current={
            pathname.startsWith("/invitations") ? "page" : undefined
          }
          className="flex min-h-12 items-center gap-3 rounded-[0.875rem] px-4 py-3 text-sm text-[var(--ocean-text)] hover:bg-[#28585d] hover:text-white aria-[current=page]:bg-[#28585d] aria-[current=page]:text-white"
        >
          <Mail aria-hidden="true" className="size-5 shrink-0" />
          Invitations
        </Link>
      </nav>
      <div className="sidebar-foot mt-auto pt-8">
        <div
          className="sidebar-journey my-4 h-[7.5rem] bg-[url('/coastal/journey.svg')] bg-left bg-no-repeat bg-[length:180px_117px] opacity-50"
          aria-hidden="true"
        />
        <p className="mb-5 px-3 text-xs leading-[1.9] text-[var(--ocean-text)]">
          A little planning.
          <br />A lot to look forward to.
        </p>
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="sidebar-account flex min-h-16 w-full items-center gap-3 border-t border-[#3b6564] pt-4 text-left"
              />
            }
          >
            <span className="sidebar-avatar grid size-10 flex-none place-items-center rounded-full bg-[#28585d]">
              <UserRound
                aria-hidden="true"
                className="size-[1.125rem] shrink-0"
              />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[0.8125rem] font-medium">
                Your account
              </strong>
              <small className="mt-1 block text-[0.625rem] text-[var(--ocean-text)]">
                Make yourself at home
              </small>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-[1.125rem] shrink-0"
            />
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
