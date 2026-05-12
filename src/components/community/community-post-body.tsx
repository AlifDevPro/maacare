"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { communityPostImagePublicPrefix, sanitizeCommunityPostHtml } from "@/lib/community/sanitize-post-html";
import { cn } from "@/lib/utils";

type CommunityPostBodyProps = {
  body: string;
  bodyFormat?: "plain" | "html" | null;
  className?: string;
  /** When set (e.g. 4), long bodies show See more / See less in feeds and previews. */
  collapseLines?: number;
};

function stripHtmlApprox(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function needsExpand(body: string, bodyFormat: "plain" | "html", lines: number): boolean {
  if (!body.trim()) return false;
  const text = bodyFormat === "html" ? stripHtmlApprox(body) : body;
  return text.length > lines * 48 || body.split(/\r?\n/).length > lines;
}

export function CommunityPostBody({ body, bodyFormat, className, collapseLines }: CommunityPostBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const fmt = bodyFormat === "html" ? "html" : "plain";
  const lines = collapseLines && collapseLines > 0 ? Math.min(collapseLines, 6) : 0;
  const showToggle = lines > 0 && needsExpand(body, fmt, lines);

  if (fmt === "html") {
    const prefix = communityPostImagePublicPrefix() ?? "";
    const html = sanitizeCommunityPostHtml(body, prefix);
    return (
      <div className={cn("space-y-1", className)}>
        <div
          className={cn(
            "prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90 dark:prose-invert [&_a]:text-primary [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:object-contain",
            lines > 0 && !expanded && showToggle && "max-h-[6.75rem] overflow-hidden",
          )}
        >
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        {showToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-xs font-semibold text-primary"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "See less" : "See more"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed text-foreground/90",
          lines > 0 && !expanded && showToggle && "line-clamp-4",
        )}
      >
        {body}
      </p>
      {showToggle ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-0 text-xs font-semibold text-primary"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "See less" : "See more"}
        </Button>
      ) : null}
    </div>
  );
}
