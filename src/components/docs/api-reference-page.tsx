import Link from "next/link";

import type { ApiDocGroup } from "@/lib/docs/types";
import { getApiCatalogForGroup } from "@/lib/docs/api-catalog";

const GROUP_LABEL: Record<ApiDocGroup | "all", string> = {
  all: "All endpoints",
  auth: "Authentication & session helpers",
  core: "Profile, home, vitals, symptoms, planner, appointments",
  ai: "Chat, RAG, and medical report helpers",
  community: "Posts, comments, likes, members, moderation",
  notifications: "In-app notifications",
  admin: "Administration (requires admin role)",
  misc: "Feedback, facilities, emergency utilities",
};

function accessLabel(access: string) {
  if (access === "public") return "Public";
  if (access === "session") return "Signed in";
  return "Admin";
}

export function ApiReferencePage({ group }: { group: "all" | ApiDocGroup }) {
  const rows = getApiCatalogForGroup(group);
  const title = group === "all" ? "API reference" : `API — ${GROUP_LABEL[group]}`;

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-border/60 pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Route Handlers under <code className="rounded bg-muted/80 px-1 py-0.5 text-xs">src/app/api</code>. All non-auth
          APIs require a valid Supabase session cookie unless marked Public. Admin routes additionally require{" "}
          <code className="rounded bg-muted/80 px-1 py-0.5 text-xs">profiles.role = admin</code>.
        </p>
        {group === "all" ? (
          <nav className="flex flex-wrap gap-2 pt-2 text-sm">
            {(["auth", "core", "ai", "community", "notifications", "admin", "misc"] as const).map((g) => (
              <Link
                key={g}
                href={`/docs/api/${g}`}
                className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {GROUP_LABEL[g]}
              </Link>
            ))}
          </nav>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link href="/docs/api" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to API overview
            </Link>
          </p>
        )}
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/30 shadow-sm">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Methods</th>
              <th className="px-4 py-3 font-semibold">Path</th>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.path}-${row.methods}`} className="border-b border-border/50 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground/90">{row.methods}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{row.path}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{accessLabel(row.access)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="text-foreground/90">{row.summary}</span>
                  {row.notes ? <span className="mt-1 block text-xs italic text-muted-foreground">{row.notes}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
