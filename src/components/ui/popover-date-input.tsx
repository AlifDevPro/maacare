"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse `yyyy-MM-dd` as local calendar date (avoids UTC shift from parseISO). */
function parseIsoDateLocal(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isValid(dt) ? dt : undefined;
}

export function PopoverDateInput({
  id,
  value,
  onChange,
  className,
  placeholder = "Pick a date",
}: {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDateLocal(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full min-w-0 justify-start gap-2 rounded-sm border border-input bg-transparent px-3 text-left text-base font-normal shadow-none md:text-sm",
            "hover:bg-muted/30",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[min(100vw-1.5rem,24rem)] p-0"
        align="start"
        sideOffset={4}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={selected ?? new Date()}
          captionLayout="dropdown"
          startMonth={new Date(1960, 0)}
          endMonth={new Date(new Date().getFullYear() + 2, 11)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
