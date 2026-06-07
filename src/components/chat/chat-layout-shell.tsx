"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ChatLayoutShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  mobileSidebarOpen: boolean;
  onMobileSidebarOpenChange: (open: boolean) => void;
  sidebarTitle: string;
};

export function ChatLayoutShell({
  sidebar,
  children,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  sidebarTitle,
}: ChatLayoutShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {children}

      <Sheet open={mobileSidebarOpen} onOpenChange={onMobileSidebarOpenChange}>
        <SheetContent side="left" className="flex w-[min(100vw,20rem)] flex-col gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{sidebarTitle}</SheetTitle>
            <SheetDescription>{sidebarTitle}</SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
    </div>
  );
}
