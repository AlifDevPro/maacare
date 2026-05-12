import Link from "next/link";
import ReactMarkdown from "react-markdown";

type MarkdownDocProps = {
  content: string;
};

export function MarkdownDoc({ content }: MarkdownDocProps) {
  return (
    <article
      className={[
        "prose prose-sm max-w-none text-foreground/90 dark:prose-invert",
        "prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-xl prose-h3:text-lg",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded-md prose-code:bg-muted/80 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:rounded-2xl prose-pre:border prose-pre:border-border/80 prose-pre:bg-muted/30",
        "prose-li:marker:text-muted-foreground",
        "prose-hr:border-border/60",
      ].join(" ")}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("/")) {
              return (
                <Link href={href} className="text-primary underline-offset-4 hover:underline">
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                className="text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
