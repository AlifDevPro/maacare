"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useAppShellColumnRect } from "@/components/app/app-shell-column";
import { cn } from "@/lib/utils";

type AppShellInsetSheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>;

/** Clip overlay/panel to the column band visible in the viewport. */
function columnBoundsStyle(rect: DOMRect): React.CSSProperties {
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  return {
    top,
    left: rect.left,
    width: rect.width,
    height: Math.max(0, bottom - top),
  };
}

export const AppShellInsetSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  AppShellInsetSheetContentProps
>(({ className, children, ...props }, ref) => {
  const columnRect = useAppShellColumnRect();
  const inset = columnRect != null;

  return (
    <SheetPrimitive.Portal>
      <div
        className={cn(
          "z-50 overflow-hidden",
          inset ? "fixed" : "fixed inset-0",
        )}
        style={inset ? columnBoundsStyle(columnRect) : undefined}
      >
        <SheetPrimitive.Overlay className="app-shell-sheet-overlay absolute inset-0 bg-black/80" />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(
            "app-shell-sheet-panel absolute inset-y-0 right-0 z-50 flex h-full w-full max-w-full flex-col gap-0 border-l bg-background shadow-lg",
            !inset && "left-auto w-3/4 sm:max-w-sm",
            className,
          )}
          {...props}
        >
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          {children}
        </SheetPrimitive.Content>
      </div>
    </SheetPrimitive.Portal>
  );
});
AppShellInsetSheetContent.displayName = "AppShellInsetSheetContent";
