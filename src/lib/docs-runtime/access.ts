import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

import { docsPublicationSchema, type DocsWindowState } from "./types";

function parseIso(date: string | null): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : null;
}

export function evaluateDocsWindow(input: {
  enabled: boolean;
  start_at: string | null;
  end_at: string | null;
  override_public_window: boolean;
  nowIso?: string;
}): DocsWindowState {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseIso(nowIso) ?? Date.now();
  const startMs = parseIso(input.start_at);
  const endMs = parseIso(input.end_at);
  const insideWindow = (startMs === null || nowMs >= startMs) && (endMs === null || nowMs <= endMs);
  const publicVisible = Boolean(input.enabled && (input.override_public_window || insideWindow));
  return {
    enabled: input.enabled,
    nowIso,
    startAt: input.start_at,
    endAt: input.end_at,
    override: Boolean(input.override_public_window),
    insideWindow,
    publicVisible,
  };
}

export async function getDocsPublicationSettings() {
  const service = tryCreateSupabaseServiceClient();
  const supabase = service ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("docs_publication_settings")
    .select("*")
    .eq("key", "primary")
    .maybeSingle();
  if (error) throw new Error(error.message || "Could not load docs publication settings.");
  if (!data) {
    return {
      key: "primary" as const,
      enabled: false,
      start_at: null,
      end_at: null,
      duration_minutes: null,
      override_public_window: false,
      published_snapshot_id: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return docsPublicationSchema.parse(data);
}

export async function resolveDocsPublicAccess() {
  const publication = await getDocsPublicationSettings();
  const windowState = evaluateDocsWindow(publication);
  return { publication, windowState };
}

