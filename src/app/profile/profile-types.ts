import type { UserAppContext } from "@/lib/app/user-app-context";

/** GET /api/profile response shape */
export type ProfileBundle = {
  profile: {
    id: string;
    email: string | null;
    display_name: string;
    phone: string | null;
    avatar_url: string | null;
    language: string;
    date_of_birth: string | null;
    sex: string | null;
    timezone: string | null;
    notify_community_activity?: boolean | null;
    notify_daily_reminders?: boolean | null;
    /** Self-reported: parent_caregiver | clinician | other — not the auth `role`. */
    profession?: string | null;
    primary_use_case?: string | null;
    student_context?: Record<string, unknown> | null;
    clinician_context?: Record<string, unknown> | null;
    partner_support_context?: Record<string, unknown> | null;
    /** When true, community member page shows week/EDD summary to other signed-in users. */
    community_show_extended_profile?: boolean | null;
    /** Admin-set: verified clinician badge in community (with profession clinician). */
    verified_professional?: boolean | null;
  } | null;
  health: {
    blood_type: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relation: string | null;
    primary_care_provider: string | null;
    insurance_provider: string | null;
    insurance_member_id: string | null;
    notes: string | null;
  } | null;
  pregnancy: {
    pregnancy_status: string;
    lmp_date: string | null;
    edd_date: string | null;
    gestational_age_weeks: number | null;
    gravida: number | null;
    para: number | null;
    baby_birth_date?: string | null;
  } | null;
  allergies: string[];
  conditions: string[];
  computed: {
    gestationalWeek: number | null;
    displayEdd: string | null;
    appContext: UserAppContext;
  };
};
