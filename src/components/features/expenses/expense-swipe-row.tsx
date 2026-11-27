"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

const REVEAL = 144;

export function ExpenseSwipeRow({
  id,
  name,
  enabled,
  disabled,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  children,
}: {
  id: number;
  name: string;
  enabled: boolean;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    start: number;
    offset: number;
    locked: boolean;
    vertical: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (content.current)
      content.current.style.transform = `translateX(${open && enabled ? -REVEAL : 0}px)`;
  }, [open, enabled]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  if (!enabled) return children;
  function finish(cancelled: boolean) {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.locked) return;
    suppressClick.current = true;
    const next = cancelled ? open : current.offset < -REVEAL / 2;
    setDragging(false);
    if (content.current)
      content.current.style.transform = `translateX(${next ? -REVEAL : 0}px)`;
    onOpenChange(next);
  }
  return (
    <div
      ref={root}
      data-expense-row={id}
      className="relative overflow-hidden"
      onPointerDownCapture={() => {
        suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        } else if (
          open &&
          !(event.target as HTMLElement).closest("[data-no-swipe]")
        ) {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <div
        ref={content}
        className={`relative z-10 flex items-center bg-card [touch-action:pan-y_pinch-zoom] ${dragging ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"}`}
        onPointerDown={(event) => {
          if (
            disabled ||
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest("[data-no-swipe]")
          )
            return;
          suppressClick.current = false;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            start: open ? -REVEAL : 0,
            offset: open ? -REVEAL : 0,
            locked: false,
            vertical: false,
          };
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || current.id !== event.pointerId || current.vertical)
            return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.locked) {
            if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
              current.vertical = true;
              return;
            }
            if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy) * 1.25)
              return;
            current.locked = true;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          current.offset = Math.max(-REVEAL, Math.min(0, current.start + dx));
          event.currentTarget.style.transform = `translateX(${current.offset}px)`;
        }}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={(event) => {
          // Touch transfers implicit capture from the button to this surface.
          if (event.target === event.currentTarget) finish(true);
        }}
      >
        <div className="min-w-0 flex-1">{children}</div>
        <div
          data-no-swipe
          className="sr-only shrink-0 focus-within:not-sr-only md:not-sr-only"
        >
          <Button
            variant="ghost"
            className="size-11 min-h-11 shrink-0"
            data-expense-actions={id}
            aria-label={`Actions for ${name}`}
            aria-expanded={open}
            aria-controls={`expense-actions-${id}`}
            disabled={disabled}
            onClick={() => onOpenChange(!open)}
          >
            <DotsThreeIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div
        id={`expense-actions-${id}`}
        className={`absolute inset-y-0 right-0 flex w-36 ${open ? "" : "pointer-events-none"}`}
      >
        <Button
          data-no-swipe
          aria-label={`Edit ${name}`}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          disabled={disabled}
          className="h-full w-18 flex-col gap-1 rounded-none border-0 px-1 text-xs focus-visible:ring-inset"
          onClick={onEdit}
        >
          <PencilSimpleIcon aria-hidden="true" />
          Edit
        </Button>
        <Button
          id={`expense-delete-${id}`}
          data-no-swipe
          aria-label={`Delete ${name}`}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          disabled={disabled}
          className="h-full w-18 flex-col gap-1 rounded-none border-0 bg-destructive px-1 text-xs text-white hover:bg-destructive focus-visible:ring-inset"
          onClick={onDelete}
        >
          <TrashIcon aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  );
}
