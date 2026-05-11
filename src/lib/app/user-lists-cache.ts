import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  loadAppointmentsList,
  loadNotificationsPayload,
  loadVitalsList,
  type AppointmentListItem,
  type NotificationsPayload,
  type VitalListItem,
} from "./user-lists-data";

export const getVitalsListCached = cache(async (userId: string, limit: number): Promise<VitalListItem[]> => {
  const supabase = await createSupabaseServerClient();
  return loadVitalsList(supabase, userId, limit);
});

export const getAppointmentsListCached = cache(
  async (userId: string, status: string | null, limit: number): Promise<AppointmentListItem[]> => {
    const supabase = await createSupabaseServerClient();
    return loadAppointmentsList(supabase, userId, { status, limit });
  },
);

export const getNotificationsPayloadCached = cache(
  async (userId: string, limit: number): Promise<NotificationsPayload> => {
    const supabase = await createSupabaseServerClient();
    return loadNotificationsPayload(supabase, userId, limit);
  },
);

export type { AppointmentListItem, NotificationsPayload, VitalListItem };
