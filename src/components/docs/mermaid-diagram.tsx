"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Theme } from "@/lib/theme";
import { getTheme } from "@/lib/theme";

function resolvedDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

type MermaidDiagramProps = {
  chart: string;
};

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId().replace(/:/g, "");
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTheme(getTheme());
    window.addEventListener("maacare:theme", sync);
    return () => window.removeEventListener("maacare:theme", sync);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart.trim()) return;

    let cancelled = false;
    setError(null);

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = resolvedDark(theme);
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "neutral",
          securityLevel: "strict",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });
        const unique = `mmd-${baseId}-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(unique, chart.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render diagram.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, theme, baseId]);

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-sm">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex min-h-[120px] justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
        />
      )}
      <figcaption className="sr-only">Mermaid diagram</figcaption>
    </figure>
  );
}
