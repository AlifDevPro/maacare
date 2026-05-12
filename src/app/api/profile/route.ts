import { NextResponse } from "next/server";
import { z } from "zod";

import { validationJsonResponse, failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { loadProfileBundle } from "@/lib/app/profile-bundle-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bloodEnum = z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).nullable().optional();
const sexEnum = z.enum(["female", "male", "other", "unknown"]).nullable().optional();
const pregStatusEnum = z.enum(["planning", "pregnant", "postpartum", "not_applicable"]).optional();

const patchSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).nullable().optional(),
  dateOfBirth: z.string().max(32).nullable().optional(),
  sex: sexEnum,
  timezone: z.string().max(64).optional(),
  pregnancyStatus: pregStatusEnum,
  lmpDate: z.string().max(32).nullable().optional(),
  eddDate: z.string().max(32).nullable().optional(),
  gestationalAgeWeeks: z.number().int().min(0).max(45).nullable().optional(),
  babyBirthDate: z.string().max(32).nullable().optional(),
  gravida: z.number().int().min(0).max(30).nullable().optional(),
  para: z.number().int().min(0).max(30).nullable().optional(),
  bloodType: bloodEnum,
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(400).nullable().optional(),
  emergencyContactName: z.string().max(200).nullable().optional(),
  emergencyContactPhone: z.string().max(40).nullable().optional(),
  emergencyContactRelation: z.string().max(120).nullable().optional(),
  primaryCareProvider: z.string().max(200).nullable().optional(),
  insuranceProvider: z.string().max(200).nullable().optional(),
  insuranceMemberId: z.string().max(120).nullable().optional(),
  healthNotes: z.string().max(5000).nullable().optional(),
  allergies: z.array(z.string().max(200)).max(50).optional(),
  conditions: z.array(z.string().max(200)).max(50).optional(),
  notifyCommunityActivity: z.boolean().optional(),
  notifyDailyReminders: z.boolean().optional(),
  profession: z.string().max(64).nullable().optional(),
  communityShowExtendedProfile: z.boolean().optional(),
  avatarUrl: z.union([z.string().url().max(2048), z.literal(""), z.null()]).optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return failJson(401, "Sign in to view your profile.");
    }

    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    try {
      const bundle = await loadProfileBundle(supabase, uid);
      return NextResponse.json(bundle);
    } catch {
      return failJson(500, "Could not load profile.");
    }
  } catch (err) {
    return serverErrorJson("profile/get", err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return failJson(401, "Sign in to update your profile.");
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const body = parsed.data;
    const supabase = await createSupabaseServerClient();
    const uid = session.id;

    const profileUpdates: Record<string, unknown> = {};
    if (body.displayName !== undefined) profileUpdates.display_name = body.displayName;
    if (body.phone !== undefined) profileUpdates.phone = body.phone;
    if (body.dateOfBirth !== undefined) profileUpdates.date_of_birth = body.dateOfBirth || null;
    if (body.sex !== undefined) profileUpdates.sex = body.sex;
    if (body.timezone !== undefined) profileUpdates.timezone = body.timezone;
    if (body.notifyCommunityActivity !== undefined) {
      profileUpdates.notify_community_activity = body.notifyCommunityActivity;
    }
    if (body.notifyDailyReminders !== undefined) {
      profileUpdates.notify_daily_reminders = body.notifyDailyReminders;
    }
    if (body.profession !== undefined) {
      profileUpdates.profession = body.profession?.trim() || null;
    }
    if (body.communityShowExtendedProfile !== undefined) {
      profileUpdates.community_show_extended_profile = body.communityShowExtendedProfile;
    }
    if (body.avatarUrl !== undefined) {
      const v = body.avatarUrl;
      profileUpdates.avatar_url = v === "" || v === null ? null : v;
    }
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", uid);
      if (error) return failJson(500, "Could not update profile.");
    }

    const healthPayload: Record<string, unknown> = { user_id: uid };
    let hasHealth = false;
    const healthFields = [
      "bloodType",
      "heightCm",
      "weightKg",
      "emergencyContactName",
      "emergencyContactPhone",
      "emergencyContactRelation",
      "primaryCareProvider",
      "insuranceProvider",
      "insuranceMemberId",
      "healthNotes",
    ] as const;
    for (const k of healthFields) {
      if (body[k] !== undefined) {
        hasHealth = true;
        const db =
          k === "bloodType"
            ? "blood_type"
            : k === "heightCm"
              ? "height_cm"
              : k === "weightKg"
                ? "weight_kg"
                : k === "emergencyContactName"
                  ? "emergency_contact_name"
                  : k === "emergencyContactPhone"
                    ? "emergency_contact_phone"
                    : k === "emergencyContactRelation"
                      ? "emergency_contact_relation"
                      : k === "primaryCareProvider"
                        ? "primary_care_provider"
                        : k === "insuranceProvider"
                          ? "insurance_provider"
                          : k === "insuranceMemberId"
                            ? "insurance_member_id"
                            : "notes";
        healthPayload[db] = body[k];
      }
    }
    if (hasHealth) {
      const { error } = await supabase.from("user_health_profiles").upsert(healthPayload, {
        onConflict: "user_id",
      });
      if (error) return failJson(500, "Could not save health information.");
    }

    const pregPayload: Record<string, unknown> = { user_id: uid };
    let hasPreg = false;
    if (body.pregnancyStatus !== undefined) {
      pregPayload.pregnancy_status = body.pregnancyStatus;
      hasPreg = true;
    }
    if (body.lmpDate !== undefined) {
      pregPayload.lmp_date = body.lmpDate || null;
      hasPreg = true;
    }
    if (body.eddDate !== undefined) {
      pregPayload.edd_date = body.eddDate || null;
      hasPreg = true;
    }
    if (body.gestationalAgeWeeks !== undefined) {
      pregPayload.gestational_age_weeks = body.gestationalAgeWeeks;
      hasPreg = true;
    }
    if (body.babyBirthDate !== undefined) {
      pregPayload.baby_birth_date = body.babyBirthDate || null;
      hasPreg = true;
    }
    if (body.gravida !== undefined) {
      pregPayload.gravida = body.gravida;
      hasPreg = true;
    }
    if (body.para !== undefined) {
      pregPayload.para = body.para;
      hasPreg = true;
    }
    if (hasPreg) {
      const { error } = await supabase.from("pregnancy_profiles").upsert(pregPayload, {
        onConflict: "user_id",
      });
      if (error) return failJson(500, "Could not save pregnancy details.");
    }

    if (body.allergies !== undefined) {
      await supabase.from("allergies").delete().eq("user_id", uid);
      if (body.allergies.length > 0) {
        const rows = body.allergies
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({
            user_id: uid,
            allergen_type: "other" as const,
            name,
          }));
        if (rows.length > 0) {
          const { error } = await supabase.from("allergies").insert(rows);
          if (error) return failJson(500, "Could not save allergies.");
        }
      }
    }

    if (body.conditions !== undefined) {
      await supabase.from("medical_conditions").delete().eq("user_id", uid);
      if (body.conditions.length > 0) {
        const rows = body.conditions
          .map((condition_name) => condition_name.trim())
          .filter(Boolean)
          .map((condition_name) => ({
            user_id: uid,
            condition_name,
            status: "active" as const,
          }));
        if (rows.length > 0) {
          const { error } = await supabase.from("medical_conditions").insert(rows);
          if (error) return failJson(500, "Could not save conditions.");
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Invalid JSON.");
    }
    return serverErrorJson("profile/patch", err);
  }
}
