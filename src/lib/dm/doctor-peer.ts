import type { SupabaseClient } from "@supabase/supabase-js";

export function isVerifiedDoctorProfile(
  profile: { verified_professional?: boolean | null } | null | undefined,
): boolean {
  return profile?.verified_professional === true;
}

export function peerIdFromConversation(
  conv: { user_low: string; user_high: string },
  viewerId: string,
): string {
  return conv.user_low === viewerId ? conv.user_high : conv.user_low;
}

export async function isVerifiedDoctorPeer(
  supabase: SupabaseClient,
  peerUserId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("verified_professional")
    .eq("id", peerUserId)
    .maybeSingle();
  return isVerifiedDoctorProfile(data);
}
