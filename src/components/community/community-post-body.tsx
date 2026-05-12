"use client";

import { communityPostImagePublicPrefix, sanitizeCommunityPostHtml } from "@/lib/community/sanitize-post-html";
import { cn } from "@/lib/utils";

export function CommunityPostBody({
  body,
  bodyFormat,
  className,
}: {
  body: string;
  bodyFormat?: "plain" | "html" | null;
  className?: string;
}) {
  if (bodyFormat === "html") {
    const prefix = communityPostImagePublicPrefix() ?? "";
    const html = sanitizeCommunityPostHtml(body, prefix);
    return (
      <div
        className={cn(
          "prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90 dark:prose-invert [&_a]:text-primary [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:object-contain",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-foreground/90", className)}>{body}</p>;
}
