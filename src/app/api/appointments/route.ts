import { NextRequest } from "next/server";

import { failJson, validationJsonResponse, serverErrorJson } from "@/lib/api/error-response";
import { loadAppointmentsList } from "@/lib/app/user-lists-data";
import { createAppointmentForUser, createAppointmentInputSchema } from "@/lib/appointments/create-appointment";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    const parsed = createAppointmentInputSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const supabase = await createSupabaseServerClient();
    const result = await createAppointmentForUser(supabase, session.id, parsed.data);

    if (!result.ok) {
      return failJson(500, result.error);
    }

    return Response.json({
      appointment: {
        id: result.appointment.id,
        title: result.appointment.title,
        scheduledAt: result.appointment.scheduledAt,
        providerName: result.appointment.providerName,
        location: result.appointment.location,
        appointmentType: result.appointment.appointmentType,
        status: result.appointment.status,
        notes: result.appointment.notes,
      },
    });
  } catch (e) {
    return serverErrorJson("appointments POST", e);
  }
}

