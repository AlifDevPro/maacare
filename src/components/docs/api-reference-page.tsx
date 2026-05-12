import Link from "next/link";

import type { ApiAccess, ApiDocGroup } from "@/lib/docs/types";
import { getApiCatalogForGroup } from "@/lib/docs/api-catalog";
import { cn } from "@/lib/utils";

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

function accessBadge(access: ApiAccess) {
  const label = access === "public" ? "Public" : access === "session" ? "Signed in" : "Admin";
  const styles =
    access === "public"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
      : access === "session"
        ? "border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100"
        : "border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", styles)}>
      {label}
    </span>
  );
}

export function ApiReferencePage({ group }: { group: "all" | ApiDocGroup }) {
  const rows = getApiCatalogForGroup(group);
  const title = group === "all" ? "API reference" : `API — ${GROUP_LABEL[group]}`;

  return (
    <div className="space-y-8">
      <header className="space-y-4 border-b border-border/60 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">HTTP reference</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Route Handlers under <code className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-xs">src/app/api</code>. Non-public routes expect a Supabase session cookie. Admin routes also require{" "}
          <code className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-xs">profiles.role = admin</code>.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            {accessBadge("public")}
            Callable without a session where the handler allows it.
          </span>
          <span className="inline-flex items-center gap-2">
            {accessBadge("session")}
            Requires a signed-in user.
          </span>
          <span className="inline-flex items-center gap-2">
            {accessBadge("admin")}
            Admin role on your profile.
          </span>
        </div>
        {group === "all" ? (
          <nav className="flex flex-wrap gap-2 pt-1">
            {(["auth", "core", "ai", "community", "notifications", "admin", "misc"] as const).map((g) => (
              <Link
                key={g}
                href={`/docs/api/${g}`}
                className="rounded-full border border-border/80 bg-gradient-to-b from-card to-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/45 hover:text-primary"
              >
                {GROUP_LABEL[g]}
              </Link>
            ))}
          </nav>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/docs/api" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to API overview
            </Link>
          </p>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/80 to-muted/10 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3.5 font-semibold">Methods</th>
                <th className="px-4 py-3.5 font-semibold">Path</th>
                <th className="px-4 py-3.5 font-semibold">Access</th>
                <th className="px-4 py-3.5 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.path}-${row.methods}`}
                  className={cn(
                    "border-b border-border/40 align-top transition-colors last:border-0 hover:bg-muted/25",
                    i % 2 === 1 ? "bg-muted/10" : "bg-transparent",
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-medium text-foreground/90">{row.methods}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-primary">{row.path}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-middle">{accessBadge(row.access)}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    <span className="text-foreground/90">{row.summary}</span>
                    {row.notes ? <span className="mt-1.5 block text-xs italic text-muted-foreground">{row.notes}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
