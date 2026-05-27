import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export type DocsLiveMetric = {
  key: string;
  label: string;
  value: number;
  status: "healthy" | "warning";
};

async function countRows(table: string) {
  const service = tryCreateSupabaseServiceClient();
  const supabase = service ?? (await createSupabaseServerClient());
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export async function getDocsLiveMetrics(): Promise<DocsLiveMetric[]> {
  const [features, users, apiKnowledge, events] = await Promise.all([
    countRows("admin_feature_flags"),
    countRows("profiles"),
    countRows("knowledge_documents"),
    countRows("notifications"),
  ]);

  return [
    { key: "features", label: "Feature controls", value: features, status: features > 0 ? "healthy" : "warning" },
    { key: "users", label: "User profiles", value: users, status: users > 0 ? "healthy" : "warning" },
    { key: "knowledge", label: "Knowledge docs", value: apiKnowledge, status: apiKnowledge > 0 ? "healthy" : "warning" },
    { key: "events", label: "Operational events", value: events, status: events > 0 ? "healthy" : "warning" },
  ];
}

