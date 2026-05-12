"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { BLOOD_TYPES, SEX_OPTIONS } from "@/app/profile/profile-field-options";
import {
  JourneyStatusPicker,
  ProfessionPicker,
  type ProfessionValue,
} from "@/components/profile/journey-profession-pickers";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PublicUser } from "@/lib/auth/types";
import { refreshSession, useSession } from "@/lib/auth-client";
import { pregnancyFieldVisibility } from "@/lib/profile/journey-fields";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const tabListClass =
  "mt-1 flex h-auto w-full gap-0 overflow-x-auto rounded-none border-0 border-t border-border/40 bg-transparent p-0 pt-2";

const tabTriggerClass =
  "min-h-10 flex-1 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 py-2 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-2 sm:text-sm";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </Label>
  );
}

const SECTION_ORDER = ["personal", "pregnancy", "health", "care"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

const SECTION_META: Record<SectionKey, { title: string; subtitle: string }> = {
  personal: {
    title: "Personal",
    subtitle: "Identity and contact basics",
  },
  pregnancy: {
    title: "Pregnancy",
    subtitle: "Journey status and due-date context",
  },
  health: {
    title: "Health",
    subtitle: "Medical snapshot and notes",
  },
  care: {
    title: "Care & safety",
    subtitle: "Emergency + care team details",
  },
};

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

export function ProfileEditClient({
  initialBundle,
  session,
}: {
  initialBundle: ProfileBundle;
  session: PublicUser;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [bundle, setBundle] = useState(initialBundle);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<string>("");
  const [pregnancyStatus, setPregnancyStatus] = useState<string>("pregnant");
  const [lmpDate, setLmpDate] = useState("");
  const [eddDate, setEddDate] = useState("");
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState("");
  const [babyBirthDate, setBabyBirthDate] = useState("");
  const [gravida, setGravida] = useState("");
  const [para, setPara] = useState("");
  const [bloodType, setBloodType] = useState<string>("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [provider, setProvider] = useState("");
  const [insurance, setInsurance] = useState("");
  const [memberId, setMemberId] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [allergiesText, setAllergiesText] = useState("");
  const [conditionsText, setConditionsText] = useState("");
  const [activeSection, setActiveSection] = useState<SectionKey>("personal");
  const [timezone, setTimezone] = useState("");
  const [profession, setProfession] = useState<ProfessionValue | "">("");

  const fieldClass = "rounded-sm shadow-none";
  const dateFieldClass = cn(fieldClass, "date-input-icon-end");

  useEffect(() => {
    setBundle(initialBundle);
  }, [initialBundle]);

  useEffect(() => {
    const p = bundle.profile;
    if (!p) {
      setDisplayName(user?.name ?? session.name ?? "");
      return;
    }
    const h = bundle.health;
    const pr = bundle.pregnancy;
    setDisplayName(p.display_name ?? user?.name ?? session.name ?? "");
    setPhone(p?.phone ?? "");
    setDateOfBirth(p?.date_of_birth ? p.date_of_birth.slice(0, 10) : "");
    setSex(p?.sex ?? "");
    setPregnancyStatus(pr?.pregnancy_status ?? "pregnant");
    setLmpDate(pr?.lmp_date ? pr.lmp_date.slice(0, 10) : "");
    setEddDate(pr?.edd_date ? pr.edd_date.slice(0, 10) : "");
    setGestationalAgeWeeks(pr?.gestational_age_weeks != null ? String(pr.gestational_age_weeks) : "");
    setBabyBirthDate(pr?.baby_birth_date ? pr.baby_birth_date.slice(0, 10) : "");
    setGravida(pr?.gravida != null ? String(pr.gravida) : "");
    setPara(pr?.para != null ? String(pr.para) : "");
    setBloodType(h?.blood_type ?? "");
    setHeightCm(h?.height_cm != null ? String(h.height_cm) : "");
    setWeightKg(h?.weight_kg != null ? String(h.weight_kg) : "");
    setEmergencyName(h?.emergency_contact_name ?? "");
    setEmergencyPhone(h?.emergency_contact_phone ?? "");
    setEmergencyRelation(h?.emergency_contact_relation ?? "");
    setProvider(h?.primary_care_provider ?? "");
    setInsurance(h?.insurance_provider ?? "");
    setMemberId(h?.insurance_member_id ?? "");
    setHealthNotes(h?.notes ?? "");
    setAllergiesText(bundle.allergies.join(", "));
    setConditionsText(bundle.conditions.join(", "));
    setTimezone(p?.timezone ?? "");
    const prof = p?.profession;
    setProfession(
      prof === "parent_caregiver" || prof === "clinician" || prof === "other" ? prof : "",
    );
  }, [bundle, user, session.name]);

  const activeIdx = SECTION_ORDER.indexOf(activeSection);
  const progress = ((activeIdx + 1) / SECTION_ORDER.length) * 100;
  const pregDetailVis = pregnancyFieldVisibility(pregnancyStatus);

  function goSection(step: number) {
    const idx = Math.max(0, Math.min(SECTION_ORDER.length - 1, step));
    setActiveSection(SECTION_ORDER[idx]!);
  }

  async function onAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const uid = user?.id;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uid) return;

    const ext = extFromMime(file.type);
    if (!ext) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${uid}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        console.error(upErr);
        toast.error(upErr.message || "Could not upload photo.");
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(j.message ?? "Could not save profile photo.");
        return;
      }
      setBundle((prev) => {
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, avatar_url: publicUrl } };
      });
      toast.success("Profile photo updated");
      await refreshSession();
    } catch (err) {
      console.error(err);
      toast.error("Could not upload photo.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    if (!bundle.profile) return;
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(j.message ?? "Could not remove photo.");
        return;
      }
      setBundle((prev) => {
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, avatar_url: null } };
      });
      toast.success("Profile photo removed");
      await refreshSession();
    } catch (err) {
      console.error(err);
      toast.error("Could not remove photo.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function save() {
    if (!displayName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const allergies = allergiesText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const conditions = conditionsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const vis = pregnancyFieldVisibility(pregnancyStatus);
      let gv: number | null = null;
      let pv: number | null = null;
      if (vis.showGravidaPara) {
        if (gravida !== "") {
          const n = Number.parseInt(gravida, 10);
          if (Number.isNaN(n)) {
            toast.error("Gravida must be a whole number.");
            setSaving(false);
            return;
          }
          gv = n;
        }
        if (para !== "") {
          const n = Number.parseInt(para, 10);
          if (Number.isNaN(n)) {
            toast.error("Para must be a whole number.");
            setSaving(false);
            return;
          }
          pv = n;
        }
      }

      const payload: Record<string, unknown> = {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth || null,
        sex: sex || null,
        timezone: timezone.trim() || null,
        profession: profession || null,
        pregnancyStatus,
        lmpDate: vis.showLmpEdd ? lmpDate || null : null,
        eddDate: vis.showLmpEdd ? eddDate || null : null,
        gravida: vis.showGravidaPara ? gv : null,
        para: vis.showGravidaPara ? pv : null,
        allergies,
        conditions,
      };

      if (vis.showGestationalWeek) {
        if (gestationalAgeWeeks !== "") {
          const g = Number.parseInt(gestationalAgeWeeks, 10);
          if (!Number.isNaN(g)) payload.gestationalAgeWeeks = g;
        } else {
          payload.gestationalAgeWeeks = null;
        }
      } else {
        payload.gestationalAgeWeeks = null;
      }

      payload.babyBirthDate = vis.showBabyBirth ? (babyBirthDate.trim() ? babyBirthDate.trim() : null) : null;

      if (bloodType === "" || !bloodType) {
        payload.bloodType = null;
      } else {
        payload.bloodType = bloodType === "unknown" ? "unknown" : bloodType;
      }
      if (heightCm !== "") {
        const h = Number.parseFloat(heightCm);
        if (!Number.isNaN(h)) payload.heightCm = h;
      }
      if (weightKg !== "") {
        const w = Number.parseFloat(weightKg);
        if (!Number.isNaN(w)) payload.weightKg = w;
      }
      payload.emergencyContactName = emergencyName.trim() || null;
      payload.emergencyContactPhone = emergencyPhone.trim() || null;
      payload.emergencyContactRelation = emergencyRelation.trim() || null;
      payload.primaryCareProvider = provider.trim() || null;
      payload.insuranceProvider = insurance.trim() || null;
      payload.insuranceMemberId = memberId.trim() || null;
      payload.healthNotes = healthNotes.trim() || null;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(json.message ?? "Could not save");
      }

      toast.success("Profile saved");
      await refreshSession();
      router.push("/profile");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const profileEmail = bundle.profile?.email ?? session.email;

  return (
    <AppShell hideNav>
      <AppHeader title="Edit profile" showBack backHref="/profile" />

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">
          Keep your details up to date so reminders, guidance, and emergency information stay
          accurate. Nothing here replaces medical advice from your clinician.
        </p>

        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionKey)} className="w-full min-w-0">
          <Card className="rounded-sm border-border/80 shadow-none">
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Guided setup • Step {activeIdx + 1} of {SECTION_ORDER.length}
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {SECTION_META[activeSection].title}
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <TabsList className={tabListClass}>
                <TabsTrigger value="personal" className={tabTriggerClass}>
                  Personal
                </TabsTrigger>
                <TabsTrigger value="pregnancy" className={tabTriggerClass}>
                  Pregnancy
                </TabsTrigger>
                <TabsTrigger value="health" className={tabTriggerClass}>
                  Health
                </TabsTrigger>
                <TabsTrigger value="care" className={tabTriggerClass}>
                  Care & safety
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

            <TabsContent value="personal" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-sm border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">About you</CardTitle>
                  <CardDescription>Basic identity used across MaaCare.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center">
                    <Avatar className="h-16 w-16 shrink-0 rounded-2xl border border-border/50">
                      {bundle.profile?.avatar_url ? (
                        <AvatarImage src={bundle.profile.avatar_url} alt="" className="rounded-2xl object-cover" />
                      ) : null}
                      <AvatarFallback className="rounded-2xl text-lg font-semibold">
                        {(displayName.trim().slice(0, 1) || user?.name?.slice(0, 1) || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">Profile photo</p>
                      <p className="text-xs text-muted-foreground">
                        Shown on your profile and in the community when you post or comment.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 rounded-md"
                          disabled={avatarUploading || !user?.id}
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          {avatarUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Working…
                            </>
                          ) : (
                            <>
                              <Camera className="mr-2 h-4 w-4" />
                              Upload photo
                            </>
                          )}
                        </Button>
                        {bundle.profile?.avatar_url ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-9 rounded-md text-muted-foreground"
                            disabled={avatarUploading}
                            onClick={() => void removeAvatar()}
                          >
                            Remove photo
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => void onAvatarFileChange(e)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="dn">Full name</FieldLabel>
                    <Input
                      id="dn"
                      className={fieldClass}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="ph">Phone</FieldLabel>
                    <Input
                      id="ph"
                      type="tel"
                      className={fieldClass}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="em-ro">Email</FieldLabel>
                    <Input
                      id="em-ro"
                      readOnly
                      className={cn(fieldClass, "cursor-not-allowed bg-muted/30")}
                      value={profileEmail}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="tz">Location / time zone</FieldLabel>
                    <Input
                      id="tz"
                      className={fieldClass}
                      placeholder="e.g. Asia/Dhaka"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">Used for reminders and local timing.</p>
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
                    <Input
                      id="dob"
                      type="date"
                      className={dateFieldClass}
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel>Sex</FieldLabel>
                    <Select value={sex || "__"} onValueChange={(v) => setSex(v === "__" ? "" : v)}>
                      <SelectTrigger className={fieldClass}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__">Not specified</SelectItem>
                        {SEX_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel>Your role</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Helps tailor the app and identify clinicians for future features — not account permissions.
                    </p>
                    <ProfessionPicker value={profession} onChange={(v) => setProfession(v)} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pregnancy" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-sm border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Pregnancy journey</CardTitle>
                  <CardDescription>
                    Choose your journey — we only ask for details that matter for your situation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-2">
                    <FieldLabel>Current journey</FieldLabel>
                    <JourneyStatusPicker value={pregnancyStatus} onChange={(v) => setPregnancyStatus(v)} />
                  </div>

                  {pregDetailVis.showLmpEdd && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid min-w-0 gap-2">
                        <FieldLabel htmlFor="lmp">Last menstrual period (LMP)</FieldLabel>
                        <Input
                          id="lmp"
                          type="date"
                          className={dateFieldClass}
                          value={lmpDate}
                          onChange={(e) => setLmpDate(e.target.value)}
                        />
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <FieldLabel htmlFor="edd">Estimated due date (EDD)</FieldLabel>
                        <Input
                          id="edd"
                          type="date"
                          className={dateFieldClass}
                          value={eddDate}
                          onChange={(e) => setEddDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {pregDetailVis.showGestationalWeek && (
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="gw">Gestational age (weeks)</FieldLabel>
                      <Input
                        id="gw"
                        inputMode="numeric"
                        placeholder="Optional — we can derive from LMP when set"
                        className={fieldClass}
                        value={gestationalAgeWeeks}
                        onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                      />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Override only if your clinician gave a different week than LMP suggests.
                      </p>
                    </div>
                  )}

                  {pregDetailVis.showBabyBirth && (
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="bbd">Baby&apos;s birth date</FieldLabel>
                      <Input
                        id="bbd"
                        type="date"
                        className={dateFieldClass}
                        value={babyBirthDate}
                        onChange={(e) => setBabyBirthDate(e.target.value)}
                      />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Used for your postpartum week on Home and in the postpartum hub. Leave blank if
                        not applicable.
                      </p>
                    </div>
                  )}

                  {pregDetailVis.showGravidaPara && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <FieldLabel htmlFor="g">Gravida</FieldLabel>
                        <Input
                          id="g"
                          inputMode="numeric"
                          placeholder="Pregnancies"
                          className={fieldClass}
                          value={gravida}
                          onChange={(e) => setGravida(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <FieldLabel htmlFor="pa">Para</FieldLabel>
                        <Input
                          id="pa"
                          inputMode="numeric"
                          placeholder="Births ≥20 wk"
                          className={fieldClass}
                          value={para}
                          onChange={(e) => setPara(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {pregnancyStatus === "not_applicable" && (
                    <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      Pregnancy tracking is hidden. You can change your journey anytime if this updates.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-sm border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Health snapshot</CardTitle>
                  <CardDescription>
                    Share what your care team should know at a glance. Use commas between multiple
                    items.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <FieldLabel>Blood group</FieldLabel>
                    <Select value={bloodType || "__"} onValueChange={(v) => setBloodType(v === "__" ? "" : v)}>
                      <SelectTrigger className={fieldClass}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__">Not specified</SelectItem>
                        {BLOOD_TYPES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b === "unknown" ? "Unknown" : b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="h">Height (cm)</FieldLabel>
                      <Input
                        id="h"
                        inputMode="decimal"
                        className={fieldClass}
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="w">Weight (kg)</FieldLabel>
                      <Input
                        id="w"
                        inputMode="decimal"
                        className={fieldClass}
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="al">Allergies</FieldLabel>
                    <Textarea
                      id="al"
                      rows={3}
                      placeholder="e.g. penicillin, latex"
                      className="min-h-[88px] rounded-sm shadow-none"
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="co">Medical conditions</FieldLabel>
                    <Textarea
                      id="co"
                      rows={3}
                      placeholder="e.g. gestational diabetes, hypertension"
                      className="min-h-[88px] rounded-sm shadow-none"
                      value={conditionsText}
                      onChange={(e) => setConditionsText(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="hn">Additional health notes</FieldLabel>
                    <Textarea
                      id="hn"
                      rows={4}
                      placeholder="Medications, supplements, or anything else your clinician should know."
                      className="min-h-[100px] rounded-sm shadow-none"
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="care" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-sm border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Emergency & care team</CardTitle>
                  <CardDescription>
                    Used if you need help quickly or when coordinating appointments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="en">Emergency contact name</FieldLabel>
                    <Input
                      id="en"
                      className={fieldClass}
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="ep">Emergency contact phone</FieldLabel>
                    <Input
                      id="ep"
                      type="tel"
                      className={fieldClass}
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="er">Relationship to you</FieldLabel>
                    <Input
                      id="er"
                      className={fieldClass}
                      placeholder="e.g. partner, parent"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="pc">Primary care provider / midwife</FieldLabel>
                    <Input
                      id="pc"
                      className={fieldClass}
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="ins">Insurance plan</FieldLabel>
                    <Input
                      id="ins"
                      className={fieldClass}
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="mid">Member / policy ID</FieldLabel>
                    <Input
                      id="mid"
                      className={fieldClass}
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-md px-3"
            onClick={() => goSection(activeIdx - 1)}
            disabled={activeIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="min-h-11 flex-1 rounded-md" asChild>
            <Link href="/profile">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-md px-3"
            onClick={() => goSection(activeIdx + 1)}
            disabled={activeIdx === SECTION_ORDER.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1 rounded-md"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
