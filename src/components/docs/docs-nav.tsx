"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DOCS_NAV } from "@/lib/docs/nav";

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 pb-8">
      {DOCS_NAV.map((item) => (
        <div key={item.href} className="space-y-0.5">
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              item.href === "/docs"
                ? pathname === "/docs"
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                : pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {item.title}
          </Link>
          {item.children && item.href === "/docs/api" ? (
            <div className="ml-2 space-y-0.5 border-l border-border/60 pl-2">
              {item.children.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                    pathname === c.href ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-5rem)] rounded-2xl border border-border/70 bg-card/50 p-3 shadow-sm">
        <ScrollArea className="h-[calc(100vh-6rem)] pr-3">
          <NavLinks pathname={pathname} />
        </ScrollArea>
      </div>
    </aside>
  );
}

export function DocsMobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl lg:hidden" aria-label="Open documentation menu">
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="font-display text-base">Documentation</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)] px-3 py-3">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
