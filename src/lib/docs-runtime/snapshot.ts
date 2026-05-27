import { revalidateTag, unstable_cache } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

import { resolveDocsPublicAccess } from "./access";
import { docsSectionSchema, docsTeamMemberSchema, type DocsRuntimeSnapshot } from "./types";

export const DOCS_SNAPSHOT_CACHE_TAG = "docs-runtime-snapshot";
export const DOCS_SEARCH_CACHE_TAG = "docs-search-index";

async function loadSections(params: { includeDrafts: boolean }) {
  const service = tryCreateSupabaseServiceClient();
  const supabase = service ?? (await createSupabaseServerClient());
  let query = supabase.from("docs_sections").select("*").order("sort_order", { ascending: true });
  if (!params.includeDrafts) {
    query = query.eq("status", "published").eq("is_visible", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load docs sections.");
  return (data ?? []).map((row) => docsSectionSchema.parse(row));
}

async function loadTeam(params: { includeDrafts: boolean }) {
  const service = tryCreateSupabaseServiceClient();
  const supabase = service ?? (await createSupabaseServerClient());
  let query = supabase.from("docs_team_members").select("*").order("display_order", { ascending: true });
  if (!params.includeDrafts) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load docs team members.");
  return (data ?? []).map((row) => docsTeamMemberSchema.parse(row));
}

async function loadRuntimeSnapshotFromDb(): Promise<DocsRuntimeSnapshot> {
  const { windowState } = await resolveDocsPublicAccess();
  const sections = await loadSections({ includeDrafts: false });
  const team = await loadTeam({ includeDrafts: false });
  return {
    publication: windowState,
    sections,
    team,
    generatedAt: new Date().toISOString(),
  };
}

const loadRuntimeSnapshotCached = unstable_cache(
  loadRuntimeSnapshotFromDb,
  ["docs-runtime-snapshot-v1"],
  {
    tags: [DOCS_SNAPSHOT_CACHE_TAG],
    revalidate: 120,
  },
);

export async function getDocsRuntimeSnapshot(params?: { bypassCache?: boolean }) {
  if (params?.bypassCache) return loadRuntimeSnapshotFromDb();
  return loadRuntimeSnapshotCached();
}

export async function getDocsAdminSnapshot() {
  const { windowState } = await resolveDocsPublicAccess();
  const [sections, team] = await Promise.all([
    loadSections({ includeDrafts: true }),
    loadTeam({ includeDrafts: true }),
  ]);
  return {
    publication: windowState,
    sections,
    team,
    generatedAt: new Date().toISOString(),
  };
}

export function revalidateDocsRuntimeCaches() {
  revalidateTag(DOCS_SNAPSHOT_CACHE_TAG, { expire: 0 });
  revalidateTag(DOCS_SEARCH_CACHE_TAG, { expire: 0 });
}

