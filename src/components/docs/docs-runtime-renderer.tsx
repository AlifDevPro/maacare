"use client";

import { useMemo, useState } from "react";
import { Copy, Download, FileText, Search } from "lucide-react";
import { toast } from "sonner";

import { MarkdownDoc } from "@/components/docs/markdown-doc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocsLiveMetric } from "@/lib/docs-runtime/live-matrix";
import { resolveSectionRenderer } from "@/lib/docs-runtime/section-registry";
import type { DocsRuntimeSnapshot } from "@/lib/docs-runtime/types";

type SearchHit = {
  slug: string;
  title: string;
  summary: string;
  bodyText: string;
};

export function DocsRuntimeRenderer({
  snapshot,
  metrics,
}: {
  snapshot: DocsRuntimeSnapshot;
  metrics: DocsLiveMetric[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const anchors = useMemo(
    () => snapshot.sections.map((s) => ({ slug: s.slug, title: s.title })),
    [snapshot.sections],
  );

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/docs/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = (await res.json()) as { results?: SearchHit[] };
      setHits(json.results ?? []);
    } catch {
      setHits([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function copyShareLink() {
    try {
      const res = await fetch("/api/docs/share", { cache: "no-store" });
      const json = (await res.json()) as { shareUrl?: string };
      const url = json.shareUrl ?? window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success("Shareable link copied.");
    } catch {
      toast.error("Could not copy share link.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Live docs</Badge>
          <Badge variant="outline">
            Window: {snapshot.publication.publicVisible ? "Public" : "Unavailable"}
          </Badge>
          <Badge variant="outline">Generated {new Date(snapshot.generatedAt).toLocaleString()}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => void runSearch(e.target.value)}
              className="pl-9"
              placeholder="Search all docs sections"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/api/docs/export/markdown" target="_blank" rel="noreferrer">
                <FileText className="mr-2 h-4 w-4" /> Markdown
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/docs/export/pdf" target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> PDF
              </a>
            </Button>
            <Button variant="outline" onClick={() => void copyShareLink()}>
              <Copy className="mr-2 h-4 w-4" /> Share
            </Button>
          </div>
        </div>
        {query.trim() ? (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">
              Search results {loadingSearch ? "(loading...)" : `(${hits.length})`}
            </p>
            <div className="space-y-1">
              {hits.map((hit) => (
                <a
                  key={hit.slug}
                  href={`#${hit.slug}`}
                  className="block rounded-lg border border-border/60 p-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium">{hit.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{hit.summary || hit.bodyText}</p>
                </a>
              ))}
              {!loadingSearch && hits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching sections found.</p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-2">
        {anchors.map((anchor) => (
          <a
            key={anchor.slug}
            href={`#${anchor.slug}`}
            className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-medium hover:bg-muted/40"
          >
            {anchor.title}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        {snapshot.sections.map((section) => {
          const renderer = resolveSectionRenderer(section);
          return (
            <section key={section.id} id={section.slug} className="scroll-mt-24 space-y-3">
              <div className="space-y-1 border-b border-border/50 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{renderer.title}</p>
                <h2 className="font-display text-2xl font-semibold tracking-tight">{section.title}</h2>
                {section.summary ? <p className="text-sm text-muted-foreground">{section.summary}</p> : null}
              </div>

              {section.section_type === "live_matrix" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {metrics.map((metric) => (
                    <Card key={metric.key} className="p-4">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="mt-1 text-2xl font-semibold">{metric.value.toLocaleString()}</p>
                      <p
                        className={cn(
                          "mt-2 text-xs font-medium",
                          metric.status === "healthy" ? "text-emerald-600" : "text-amber-600",
                        )}
                      >
                        {metric.status === "healthy" ? "Healthy" : "Needs attention"}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : null}

              {section.section_type !== "team" && section.section_type !== "live_matrix" ? (
                section.body_md?.trim() ? (
                  <MarkdownDoc content={section.body_md} />
                ) : section.body_html?.trim() ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: section.body_html }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No content yet.</p>
                )
              ) : null}

              {section.section_type === "team" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {snapshot.team.map((member) => (
                    <Card key={member.id} className="overflow-hidden p-0">
                      <div className="aspect-[3/4] bg-muted/30">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.avatar_url}
                            alt={member.full_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl font-semibold text-muted-foreground">
                            {member.full_name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-4">
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

