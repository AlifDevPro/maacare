"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORM_CONTROL_FOCUS } from "@/lib/form-control-focus";
import { cn } from "@/lib/utils";

export const appSelectTriggerClass = cn(
  "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-none ring-offset-background transition-colors hover:bg-muted/40 data-[placeholder]:text-muted-foreground",
  FORM_CONTROL_FOCUS,
);

export const appSelectContentClass =
  "rounded-md border border-border/80 bg-popover p-1 shadow-md";

/** Overrides base SelectItem accent hover (white text on pale bg). */
export const appSelectItemClass =
  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-9 text-sm text-foreground outline-none focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[state=checked]:bg-primary/10 data-[state=checked]:font-medium data-[state=checked]:text-foreground";

export type AppSelectOption = { value: string; label: string };

type AppSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  triggerClassName,
  contentClassName,
}: AppSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn(appSelectTriggerClass, className, triggerClassName)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className={cn(appSelectContentClass, contentClassName)}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className={appSelectItemClass}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
