import type { ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function SearchField({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { "aria-label": string }) {
  return (
    <div className={cn("relative flex min-w-0 items-center", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 256 256"
        fill="currentColor"
        className="pointer-events-none absolute left-4 size-4 text-muted-foreground"
      >
        <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
      </svg>
      <Input
        {...props}
        type="search"
        className="rounded-full bg-background pl-11 [&::-webkit-search-cancel-button]:cursor-pointer"
      />
    </div>
  );
}
