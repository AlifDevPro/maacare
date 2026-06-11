import { isVerifiedDoctorPeer, peerIdFromConversation } from "@/lib/dm/doctor-peer";
import { enforceSubscriptionFeature } from "@/lib/subscription/enforce";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function enforceDoctorMessagingToPeer(
  userId: string,
  peerUserId: string,
  supabase: Supabase,
) {
  const isDoctor = await isVerifiedDoctorPeer(supabase, peerUserId);
  if (!isDoctor) return { ok: true as const };
  return enforceSubscriptionFeature(userId, "doctor_messaging");
}

export async function enforceDoctorMessagingInConversation(
  userId: string,
  conv: { user_low: string; user_high: string },
  supabase: Supabase,
) {
  const peerId = peerIdFromConversation(conv, userId);
  return enforceDoctorMessagingToPeer(userId, peerId, supabase);
}
