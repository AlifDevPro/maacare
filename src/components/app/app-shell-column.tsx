"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { APP_SHELL_COLUMN_MAX } from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";

type AppShellColumnContextValue = {
  column: HTMLElement | null;
  setColumn: (node: HTMLElement | null) => void;
};

const AppShellColumnContext = createContext<AppShellColumnContextValue | null>(null);

export function AppShellColumnProvider({ children }: { children: ReactNode }) {
  const [column, setColumn] = useState<HTMLElement | null>(null);
  return (
    <AppShellColumnContext.Provider value={{ column, setColumn }}>
      {children}
    </AppShellColumnContext.Provider>
  );
}

export function useAppShellColumn() {
  return useContext(AppShellColumnContext)?.column ?? null;
}

/** Viewport-aligned bounds of the centered app column (updates on resize/scroll). */
export function useAppShellColumnRect() {
  const column = useAppShellColumn();
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!column) {
      setRect(null);
      return;
    }

    const update = () => setRect(column.getBoundingClientRect());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(column);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [column]);

  return rect;
}

export function AppShellColumn({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ctx = useContext(AppShellColumnContext);
  if (!ctx) {
    throw new Error("AppShellColumn must be used within AppShellColumnProvider");
  }

  return (
    <div
      ref={ctx.setColumn}
      className={cn(
        "relative flex min-h-screen w-full flex-col overflow-x-hidden",
        wide ? "max-w-none" : APP_SHELL_COLUMN_MAX,
        className,
      )}
    >
      {children}
    </div>
  );
}
