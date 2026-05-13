import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePrimaryUseCase } from "@/lib/profile/primary-use-case";

export type CarePermissions = {
  read_pregnancy?: boolean;
  read_vitals?: boolean;
  read_symptoms?: boolean;
};

export type ActiveCareAsViewer = {
  id: string;
  subjectUserId: string;
  subjectDisplayName: string | null;
  permissions: CarePermissions;
};

function permTrue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

export async function fetchActiveCareAsViewer(
  supabase: SupabaseClient,
  viewerId: string,
): Promise<ActiveCareAsViewer | null> {
  const { data: row, error } = await supabase
    .from("care_relationships")
    .select("id, subject_user_id, permissions")
    .eq("viewer_user_id", viewerId)
    .eq("status", "active")
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !row?.subject_user_id) return null;

  const { data: subProf } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", row.subject_user_id as string)
    .maybeSingle();

  const rawPerm = row.permissions as Record<string, unknown> | null;
  const permissions: CarePermissions = {
    read_pregnancy: permTrue(rawPerm?.read_pregnancy),
    read_vitals: permTrue(rawPerm?.read_vitals),
    read_symptoms: permTrue(rawPerm?.read_symptoms),
  };

  return {
    id: row.id as string,
    subjectUserId: row.subject_user_id as string,
    subjectDisplayName: (subProf?.display_name as string | null) ?? null,
    permissions,
  };
}

/** Pregnancy row user id for home/chat when partner has an active care link. */
export async function resolvePregnancyUserIdForRequester(
  supabase: SupabaseClient,
  requesterId: string,
  primaryUseCase: string | null | undefined,
): Promise<{ pregnancyUserId: string; activeCare: ActiveCareAsViewer | null }> {
  const use = normalizePrimaryUseCase(primaryUseCase);
  if (use !== "partner_support") {
    return { pregnancyUserId: requesterId, activeCare: null };
  }
  const care = await fetchActiveCareAsViewer(supabase, requesterId);
  if (care && care.permissions.read_pregnancy !== false) {
    return { pregnancyUserId: care.subjectUserId, activeCare: care };
  }
  return { pregnancyUserId: requesterId, activeCare: care };
}

/** Vitals/symptoms row user id (subject when permitted, else self). */
export function resolveHealthDataUserId(
  requesterId: string,
  primaryUseCase: string | null | undefined,
  activeCare: ActiveCareAsViewer | null,
  kind: "vitals" | "symptoms",
): string {
  const use = normalizePrimaryUseCase(primaryUseCase);
  if (use !== "partner_support" || !activeCare) return requesterId;
  const ok =
    kind === "vitals"
      ? activeCare.permissions.read_vitals !== false
      : activeCare.permissions.read_symptoms !== false;
  return ok ? activeCare.subjectUserId : requesterId;
}
