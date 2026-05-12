"use client";

import { isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/docs/mermaid-diagram";
import { cn } from "@/lib/utils";

type MarkdownDocProps = {
  content: string;
  className?: string;
};

function extractMermaidFromPre(children: ReactNode): string | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement(child)) return null;
  const props = (child as ReactElement<{ className?: string; children?: ReactNode }>).props;
  const cls = props.className ?? "";
  if (!cls.includes("language-mermaid")) return null;
  const inner = props.children;
  const text =
    typeof inner === "string" ? inner : Array.isArray(inner) ? inner.map((c) => String(c)).join("") : String(inner ?? "");
  return text.replace(/\n$/, "");
}

export function MarkdownDoc({ content, className }: MarkdownDocProps) {
  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith("/")) {
        return (
          <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          className="font-medium text-primary underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    h1: ({ children }) => (
      <h1 className="mb-4 scroll-mt-24 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-12 scroll-mt-24 border-b border-border/50 pb-2 font-display text-xl font-semibold tracking-tight text-foreground first:mt-0 md:text-2xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-8 scroll-mt-24 font-display text-lg font-semibold tracking-tight text-foreground">{children}</h3>
    ),
    p: ({ children }) => <p className="mb-4 text-base leading-relaxed text-foreground/90 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="mb-6 ml-1 list-disc space-y-2 pl-5 marker:text-primary/70">{children}</ul>,
    ol: ({ children }) => <ol className="mb-6 ml-1 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-primary">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed text-foreground/90 [&>p]:mb-2">{children}</li>,
    hr: () => <hr className="my-10 border-0 border-t border-border/60" />,
    blockquote: ({ children }) => (
      <blockquote className="mb-6 rounded-r-2xl border-l-4 border-primary/40 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-foreground/90 dark:bg-primary/10">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="not-prose my-6 overflow-x-auto rounded-2xl border border-border/70 bg-card/30 shadow-sm">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">{children}</thead>,
    th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-t border-border/50 px-4 py-3 text-muted-foreground">{children}</td>,
    tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
    pre: ({ children }) => {
      const mermaid = extractMermaidFromPre(children);
      if (mermaid !== null) return <MermaidDiagram chart={mermaid} />;
      return (
        <pre className="not-prose mb-6 overflow-x-auto rounded-2xl border border-border/80 bg-muted/40 p-4 text-sm shadow-inner">
          {children}
        </pre>
      );
    },
    code: ({ className, children }) => {
      const isBlock = Boolean(className?.includes("language-"));
      if (isBlock) {
        return (
          <code className={cn("font-mono text-[0.8125rem] leading-relaxed text-foreground/95", className)}>{children}</code>
        );
      }
      return (
        <code className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {children}
        </code>
      );
    },
  };

  return (
    <article
      className={cn(
        [
          "prose prose-sm max-w-none text-foreground/90 dark:prose-invert",
          "prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-strong:text-foreground prose-strong:font-semibold",
        ].join(" "),
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
