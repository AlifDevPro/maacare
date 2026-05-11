import { NextRequest } from "next/server";
import { z } from "zod";

import { failJson, validationJsonResponse, serverErrorJson } from "@/lib/api/error-response";
import { loadAppointmentsList } from "@/lib/app/user-lists-data";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  scheduledAt: z.string().datetime(),
  providerName: z.string().max(200).optional(),
  location: z.string().max(300).optional(),
  appointmentType: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    const supabase = await createSupabaseServerClient();
    const status = req.nextUrl.searchParams.get("status");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30") || 30, 100);

    try {
      const appointments = await loadAppointmentsList(supabase, session.id, { status, limit });
      return Response.json({ appointments });
    } catch (error: unknown) {
      console.error("[appointments] GET:", error);
      const err = error as { code?: string; message?: string };
      const hint =
        err.code === "42P01"
          ? "Appointments table is missing. Run latest Supabase migrations."
          : err.code === "42501"
            ? "Appointment permission policy is missing. Run latest Supabase migrations."
            : process.env.NODE_ENV === "development"
              ? (err.message ?? "Could not load appointments.")
              : "Could not load appointments.";
      return failJson(500, hint);
    }
  } catch (e) {
    return serverErrorJson("appointments GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON.");
    }

    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const body = parsed.data;
    const { error: ensureErr } = await supabase.rpc("ensure_profile_for_current_user");
    if (ensureErr) {
      console.warn("[appointments] ensure_profile:", ensureErr.message);
    }

    let { data, error } = await supabase
      .from("appointments")
      .insert({
        user_id: session.id,
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
            user_id: session.id,
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
      console.error("[appointments] POST:", error);
      const hint =
        error?.code === "42P01"
          ? "Appointments table is missing. Run latest Supabase migrations."
          : error?.code === "23503"
            ? "Profile record missing for your account. Please sign out and sign in again, then retry."
            : error?.code === "42501"
              ? "Appointment permission policy is missing. Run latest Supabase migrations."
          : process.env.NODE_ENV === "development"
            ? error?.message ?? "Could not create appointment."
            : "Could not create appointment.";
      return failJson(500, hint);
    }

    return Response.json({
      appointment: {
        id: data.id as string,
        title: data.title as string,
        scheduledAt: data.scheduled_at as string,
        providerName: (data.provider_name as string | null) ?? null,
        location: (data.location as string | null) ?? null,
        appointmentType: (data.appointment_type as string | null) ?? null,
        status: data.status as string,
        notes: (data.notes as string | null) ?? null,
      },
    });
  } catch (e) {
    return serverErrorJson("appointments POST", e);
  }
}

