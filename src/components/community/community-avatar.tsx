"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function letter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export function CommunityAvatar({
  url,
  name,
  className,
  fallbackClassName,
}: {
  url?: string | null;
  name: string;
  className?: string;
  /** Applied to the root Avatar (size, shape). */
  fallbackClassName?: string;
}) {
  const initial = letter(name);
  return (
    <Avatar className={cn("shrink-0", className)}>
      {url ? <AvatarImage src={url} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn("font-display text-primary", fallbackClassName)}>{initial}</AvatarFallback>
    </Avatar>
  );
}
