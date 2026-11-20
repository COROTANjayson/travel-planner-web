import type { ComponentProps } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function SearchField({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { "aria-label": string }) {
  return (
    <div className={cn("relative flex min-w-0 items-center", className)}>
      <MagnifyingGlassIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-4 size-4 text-muted-foreground"
      />
      <Input
        {...props}
        type="search"
        className="rounded-full bg-background pl-11 [&::-webkit-search-cancel-button]:cursor-pointer"
      />
    </div>
  );
}
