import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export const createAppointmentInputSchema = z.object({
  title: z.string().min(1).max(200),
  scheduledAt: z.string().datetime(),
  providerName: z.string().max(200).optional(),
  location: z.string().max(300).optional(),
  appointmentType: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;

export type CreatedAppointment = {
  id: string;
  title: string;
  scheduledAt: string;
  providerName: string | null;
  location: string | null;
  appointmentType: string | null;
  status: string;
  notes: string | null;
};

export async function createAppointmentForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAppointmentInput,
): Promise<{ ok: true; appointment: CreatedAppointment } | { ok: false; error: string }> {
  const parsed = createAppointmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid appointment details." };
  }

  const body = parsed.data;

  const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
  if (ensureErr) {
    console.warn("[appointments] ensure_profile:", ensureErr.message);
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("user_id", userId)
    .eq("title", body.title.trim())
    .eq("scheduled_at", body.scheduledAt)
    .maybeSingle();

  if (existing?.id) {
    const { data: row } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, provider_name, location, appointment_type, status, notes")
      .eq("id", existing.id)
      .maybeSingle();
    if (row) {
      return {
        ok: true,
        appointment: mapAppointmentRow(row),
      };
    }
  }

  let { data, error } = await supabase
    .from("appointments")
    .insert({
      user_id: userId,
      title: body.title.trim(),
      scheduled_at: body.scheduledAt,
      provider_name: body.providerName?.trim() || null,
      location: body.location?.trim() || null,
      appointment_type: body.appointmentType?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select("id, title, scheduled_at, provider_name, location, appointment_type, status, notes")
    .single();

  if ((error || !data) && (error?.code === "42501" || error?.code === "23503")) {
    const svc = tryCreateSupabaseServiceClient();
    if (svc) {
      const retry = await svc
        .from("appointments")
        .insert({
          user_id: userId,
          title: body.title.trim(),
          scheduled_at: body.scheduledAt,
          provider_name: body.providerName?.trim() || null,
          location: body.location?.trim() || null,
          appointment_type: body.appointmentType?.trim() || null,
          notes: body.notes?.trim() || null,
        })
        .select("id, title, scheduled_at, provider_name, location, appointment_type, status, notes")
        .single();
      data = retry.data ?? null;
      error = retry.error ?? null;
    }
  }

  if (error || !data) {
    console.error("[appointments] create:", error);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "development"
          ? (error?.message ?? "Could not create appointment.")
          : "Could not create appointment.",
    };
  }

  return { ok: true, appointment: mapAppointmentRow(data) };
}

function mapAppointmentRow(row: Record<string, unknown>): CreatedAppointment {
  return {
    id: row.id as string,
    title: row.title as string,
    scheduledAt: row.scheduled_at as string,
    providerName: (row.provider_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    appointmentType: (row.appointment_type as string | null) ?? null,
    status: row.status as string,
    notes: (row.notes as string | null) ?? null,
  };
}
