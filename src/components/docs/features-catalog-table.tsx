import Link from "next/link";

import { FEATURE_CATALOG } from "@/lib/docs/feature-catalog";

export function FeaturesCatalogTable() {
  return (
    <div className="mt-10 space-y-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">Feature directory</h2>
      <p className="text-sm text-muted-foreground">
        In-app surfaces and where to open them. Most routes require sign-in (see{" "}
        <Link href="/docs/getting-started" className="text-primary underline-offset-4 hover:underline">
          Getting started
        </Link>
        ).
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/30 shadow-sm">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Feature</th>
              <th className="px-4 py-3 font-semibold">Route</th>
              <th className="px-4 py-3 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_CATALOG.map((f) => (
              <tr key={f.href + f.title} className="border-b border-border/50 align-top last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{f.title}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={f.href} className="text-primary underline-offset-4 hover:underline">
                    {f.href}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
