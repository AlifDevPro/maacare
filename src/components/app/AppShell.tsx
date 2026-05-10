"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}

export function AppShell({ children, hideNav, className }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn("flex-1 pb-24", hideNav && "pb-6", className)}
        >
          {children}
        </motion.main>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
