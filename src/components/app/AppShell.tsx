"use client";

import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { ShellPrefetch } from "./shell-prefetch";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}

export function AppShell({ children, hideNav, className }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md min-w-0 flex-col">
        <main className={cn("min-w-0 flex-1 pb-24", hideNav && "pb-6", className)}>
          {children}
        </main>
        {!hideNav ? (
          <>
            <ShellPrefetch />
            <BottomNav />
          </>
        ) : null}
      </div>
    </div>
  );
}
