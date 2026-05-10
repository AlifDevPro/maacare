"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ProfileBundle } from "@/app/profile/profile-types";
import {
  BLOOD_TYPES,
  PREGNANCY_STATUS_OPTIONS,
  SEX_OPTIONS,
} from "@/app/profile/profile-field-options";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { refreshSession, useSession } from "@/lib/auth-client";

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

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<string>("");
  const [pregnancyStatus, setPregnancyStatus] = useState<string>("pregnant");
  const [lmpDate, setLmpDate] = useState("");
  const [eddDate, setEddDate] = useState("");
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState("");
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

  const fetchBundle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (res.status === 401) {
        setBundle(null);
        return;
      }
      if (!res.ok) throw new Error("Could not load profile");
      const data = (await res.json()) as ProfileBundle;
      setBundle(data);
    } catch {
      toast.error("Could not load your profile");
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchBundle();
  }, [user, fetchBundle]);

  useEffect(() => {
    if (!bundle) {
      setDisplayName(user?.name ?? "");
      return;
    }
    const p = bundle.profile;
    const h = bundle.health;
    const pr = bundle.pregnancy;
    setDisplayName(p?.display_name ?? user?.name ?? "");
    setPhone(p?.phone ?? "");
    setDateOfBirth(p?.date_of_birth ? p.date_of_birth.slice(0, 10) : "");
    setSex(p?.sex ?? "");
    setPregnancyStatus(pr?.pregnancy_status ?? "pregnant");
    setLmpDate(pr?.lmp_date ? pr.lmp_date.slice(0, 10) : "");
    setEddDate(pr?.edd_date ? pr.edd_date.slice(0, 10) : "");
    setGestationalAgeWeeks(pr?.gestational_age_weeks != null ? String(pr.gestational_age_weeks) : "");
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
  }, [bundle, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/profile/edit");
    }
  }, [authLoading, user, router]);

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

      let gv: number | null = null;
      if (gravida !== "") {
        const n = Number.parseInt(gravida, 10);
        if (Number.isNaN(n)) {
          toast.error("Gravida must be a whole number.");
          setSaving(false);
          return;
        }
        gv = n;
      }
      let pv: number | null = null;
      if (para !== "") {
        const n = Number.parseInt(para, 10);
        if (Number.isNaN(n)) {
          toast.error("Para must be a whole number.");
          setSaving(false);
          return;
        }
        pv = n;
      }

      const payload: Record<string, unknown> = {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth || null,
        sex: sex || null,
        pregnancyStatus,
        lmpDate: lmpDate || null,
        eddDate: eddDate || null,
        gravida: gv,
        para: pv,
        allergies,
        conditions,
      };

      if (gestationalAgeWeeks !== "") {
        const g = Number.parseInt(gestationalAgeWeeks, 10);
        if (!Number.isNaN(g)) payload.gestationalAgeWeeks = g;
      }

      if (bloodType) payload.bloodType = bloodType === "unknown" ? "unknown" : bloodType;
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

  if (authLoading || !user) {
    return (
      <AppShell hideNav>
        <AppHeader title="Edit profile" showBack backHref="/profile" />
        <div className="space-y-4 px-4 pt-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <AppHeader title="Edit profile" showBack backHref="/profile" />

      <div className="space-y-4 px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">
          Keep your details up to date so reminders, guidance, and emergency information stay
          accurate. Nothing here replaces medical advice from your clinician.
        </p>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : (
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-muted/70 p-1.5 sm:grid-cols-4">
              <TabsTrigger value="personal" className="rounded-xl text-xs sm:text-sm">
                Personal
              </TabsTrigger>
              <TabsTrigger value="pregnancy" className="rounded-xl text-xs sm:text-sm">
                Pregnancy
              </TabsTrigger>
              <TabsTrigger value="health" className="rounded-xl text-xs sm:text-sm">
                Health
              </TabsTrigger>
              <TabsTrigger value="care" className="rounded-xl text-xs sm:text-sm">
                Care & safety
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">About you</CardTitle>
                  <CardDescription>Basic identity used across MaaCare.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="dn">Full name</FieldLabel>
                    <Input
                      id="dn"
                      className="rounded-xl"
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
                      className="rounded-xl"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
                    <Input
                      id="dob"
                      type="date"
                      className="rounded-xl"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel>Sex</FieldLabel>
                    <Select value={sex || "__"} onValueChange={(v) => setSex(v === "__" ? "" : v)}>
                      <SelectTrigger className="rounded-xl">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pregnancy" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Pregnancy journey</CardTitle>
                  <CardDescription>
                    Week counts and due dates help personalize tips; leave blank if not applicable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2">
                    <FieldLabel>Current journey</FieldLabel>
                    <Select value={pregnancyStatus} onValueChange={setPregnancyStatus}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PREGNANCY_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="lmp">Last menstrual period (LMP)</FieldLabel>
                      <Input
                        id="lmp"
                        type="date"
                        className="rounded-xl"
                        value={lmpDate}
                        onChange={(e) => setLmpDate(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="edd">Estimated due date (EDD)</FieldLabel>
                      <Input
                        id="edd"
                        type="date"
                        className="rounded-xl"
                        value={eddDate}
                        onChange={(e) => setEddDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="gw">Gestational age (weeks)</FieldLabel>
                    <Input
                      id="gw"
                      inputMode="numeric"
                      placeholder="Optional — we can derive from LMP when set"
                      className="rounded-xl"
                      value={gestationalAgeWeeks}
                      onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Override only if your clinician gave a different week than LMP suggests.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="g">Gravida</FieldLabel>
                      <Input
                        id="g"
                        inputMode="numeric"
                        placeholder="Pregnancies"
                        className="rounded-xl"
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
                        className="rounded-xl"
                        value={para}
                        onChange={(e) => setPara(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
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
                      <SelectTrigger className="rounded-xl">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="h">Height (cm)</FieldLabel>
                      <Input
                        id="h"
                        inputMode="decimal"
                        className="rounded-xl"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="w">Weight (kg)</FieldLabel>
                      <Input
                        id="w"
                        inputMode="decimal"
                        className="rounded-xl"
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
                      className="min-h-[88px] rounded-xl"
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
                      className="min-h-[88px] rounded-xl"
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
                      className="min-h-[100px] rounded-xl"
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="care" className="mt-4 space-y-4 focus-visible:outline-none">
              <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
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
                      className="rounded-xl"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="ep">Emergency contact phone</FieldLabel>
                    <Input
                      id="ep"
                      type="tel"
                      className="rounded-xl"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="er">Relationship to you</FieldLabel>
                    <Input
                      id="er"
                      className="rounded-xl"
                      placeholder="e.g. partner, parent"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="pc">Primary care provider / midwife</FieldLabel>
                    <Input
                      id="pc"
                      className="rounded-xl"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="ins">Insurance plan</FieldLabel>
                    <Input
                      id="ins"
                      className="rounded-xl"
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel htmlFor="mid">Member / policy ID</FieldLabel>
                    <Input
                      id="mid"
                      className="rounded-xl"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md gap-2">
          <Button variant="outline" className="flex-1 rounded-2xl" asChild>
            <Link href="/profile">Cancel</Link>
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-2xl"
            onClick={() => void save()}
            disabled={saving || loading}
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
