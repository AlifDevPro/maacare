import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationDTO } from "@/lib/notifications/types";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export type VitalListItem = {
  id: string;
  recordedAt: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRateBpm: number | null;
  weightKg: number | null;
  temperatureC: number | null;
  glucoseMgDl: number | null;
  spo2Pct: number | null;
  notes: string | null;
};

export async function loadVitalsList(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<VitalListItem[]> {
  const { data, error } = await supabase
    .from("vital_signs")
    .select(
      "id, recorded_at, systolic_bp, diastolic_bp, heart_rate_bpm, weight_kg, temperature_c, glucose_mg_dl, spo2_pct, notes",
    )
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    recordedAt: r.recorded_at as string,
    systolicBp: (r.systolic_bp as number | null) ?? null,
    diastolicBp: (r.diastolic_bp as number | null) ?? null,
    heartRateBpm: (r.heart_rate_bpm as number | null) ?? null,
    weightKg: (r.weight_kg as number | null) ?? null,
    temperatureC: (r.temperature_c as number | null) ?? null,
    glucoseMgDl: (r.glucose_mg_dl as number | null) ?? null,
    spo2Pct: (r.spo2_pct as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  }));
}

export type AppointmentListItem = {
  id: string;
  title: string;
  scheduledAt: string;
  providerName: string | null;
  location: string | null;
  appointmentType: string | null;
  status: string;
  notes: string | null;
};

export async function loadAppointmentsList(
  supabase: SupabaseClient,
  userId: string,
  opts: { status: string | null; limit: number },
): Promise<AppointmentListItem[]> {
  const { status, limit } = opts;
  let query = supabase
    .from("appointments")
    .select("id, title, scheduled_at, provider_name, location, appointment_type, status, notes")
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (status === "scheduled" || status === "completed" || status === "cancelled" || status === "no_show") {
    query = query.eq("status", status);
  }

  let { data, error } = await query;
  if (error && (error.code === "42501" || error.code === "23503")) {
    const svc = tryCreateSupabaseServiceClient();
    if (svc) {
      let q = svc
        .from("appointments")
        .select("id, title, scheduled_at, provider_name, location, appointment_type, status, notes")
        .eq("user_id", userId)
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (status === "scheduled" || status === "completed" || status === "cancelled" || status === "no_show") {
        q = q.eq("status", status);
      }
      const retry = await q;
      data = retry.data ?? null;
      error = retry.error ?? null;
    }
  }
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    scheduledAt: r.scheduled_at as string,
    providerName: (r.provider_name as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    appointmentType: (r.appointment_type as string | null) ?? null,
    status: r.status as string,
    notes: (r.notes as string | null) ?? null,
  }));
}

export type NotificationsPayload = {
  notifications: NotificationDTO[];
  unreadCount: number;
};

export async function loadNotificationsPayload(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<NotificationsPayload> {
  const [{ data: rows, error }, { count: unreadCount, error: countErr }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, link_path, read_at, created_at, actor_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  if (error) {
    throw new Error(error.message);
  }
  if (countErr) {
    console.warn("notifications unread count", countErr.message);
  }

  const list = rows ?? [];
  const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];

  const actorNames: Record<string, string> = {};
  const actorAvatars: Record<string, string | null> = {};
  if (actorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", actorIds);

    for (const p of profs ?? []) {
      const id = p.id as string;
      actorNames[id] = p.display_name as string;
      actorAvatars[id] = (p.avatar_url as string | null) ?? null;
    }
  }

  const notifications: NotificationDTO[] = list.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    linkPath: (r.link_path as string | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
    actorId: (r.actor_id as string | null) ?? null,
    actorDisplayName: r.actor_id ? actorNames[r.actor_id as string] ?? null : null,
    actorAvatarUrl: r.actor_id ? actorAvatars[r.actor_id as string] ?? null : null,
  }));

  return {
    notifications,
    unreadCount: unreadCount ?? 0,
  };
}

export async function loadUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}
