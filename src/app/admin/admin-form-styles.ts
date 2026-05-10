import { cn } from "@/lib/utils";

/**
 * Admin-only form controls: slightly taller, wider padding, subtler corners.
 * Use on {@link AdminShell} content and on portaled dialogs (e.g. Knowledge import).
 */
export const adminFormFieldClasses = cn(
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])]:h-10",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])]:rounded-sm",
  "[&_input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])]:px-3.5",
  "[&_input[type=file]]:rounded-sm [&_input[type=file]]:py-2 [&_input[type=file]]:text-sm",
  "[&_textarea]:rounded-sm [&_textarea]:min-h-[88px] [&_textarea]:px-3.5 [&_textarea]:py-2.5",
  "[&_button.flex.h-9.w-full.items-center.justify-between.rounded-md.border]:h-10",
  "[&_button.flex.h-9.w-full.items-center.justify-between.rounded-md.border]:rounded-sm",
  "[&_button.flex.h-9.w-full.items-center.justify-between.rounded-md.border]:px-3.5",
);
