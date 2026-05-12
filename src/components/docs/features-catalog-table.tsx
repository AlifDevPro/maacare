import Link from "next/link";

import { FEATURE_CATALOG } from "@/lib/docs/feature-catalog";
import { cn } from "@/lib/utils";

export function FeaturesCatalogTable() {
  return (
    <section className="space-y-5 border-t border-border/50 pt-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Directory</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight md:text-2xl">Feature map</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          In-app surfaces and where to open them. Most routes require sign-in (see{" "}
          <Link href="/docs/getting-started" className="font-medium text-primary underline-offset-4 hover:underline">
            Getting started
          </Link>
          ).
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/80 to-muted/10 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3.5 font-semibold">Feature</th>
                <th className="px-4 py-3.5 font-semibold">Route</th>
                <th className="px-4 py-3.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_CATALOG.map((f, i) => (
                <tr
                  key={f.href + f.title}
                  className={cn(
                    "border-b border-border/40 align-top transition-colors last:border-0 hover:bg-muted/25",
                    i % 2 === 1 ? "bg-muted/10" : "bg-transparent",
                  )}
                >
                  <td className="px-4 py-3.5 font-medium text-foreground">{f.title}</td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    <Link href={f.href} className="text-primary underline-offset-4 hover:underline">
                      {f.href}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 leading-relaxed text-muted-foreground">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
