"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Mail, Lock, User, ChevronRight } from "lucide-react";
import {
  JourneyStatusPicker,
  ProfessionPicker,
  type ProfessionValue,
} from "@/components/profile/journey-profession-pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PopoverDateInput } from "@/components/ui/popover-date-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { checkEmailRegistered, registerAccount } from "@/lib/auth-client";
import { buildSignupProfilePayload } from "@/lib/signup/build-profile-payload";
import type { SignupProfileDraft } from "@/lib/signup/signup-draft";
import { resolveProfileFieldVisibility } from "@/lib/profile/journey-fields";
import type { PrimaryUseCaseValue } from "@/lib/profile/primary-use-case";
import { PRIMARY_USE_CASE_VALUES, PRIMARY_USE_LABEL } from "@/lib/profile/primary-use-case";
import {
  validateAccountCredentials,
  validateProfession,
  validateTermsAccepted,
} from "@/lib/signup/validators";
import { isValidEmailFormat } from "@/lib/validation/email";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { SexIconCards } from "@/components/profile/sex-icon-cards";

type StepId = "account" | "about" | "journey" | "pregnancy" | "health" | "preferences" | "consent";

const STEP_DEFS: { id: StepId; title: string; optional?: boolean }[] = [
  { id: "account", title: "Account" },
  { id: "about", title: "About you" },
  { id: "journey", title: "Your journey" },
  { id: "pregnancy", title: "Pregnancy details", optional: true },
  { id: "health", title: "Health", optional: true },
  { id: "preferences", title: "Preferences", optional: true },
  { id: "consent", title: "Finish" },
];

const fieldBase =
  "rounded-sm shadow-none focus-visible:ring-1 h-10 w-full min-w-0";

export function ManualSignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<SignupProfileDraft["sex"]>("");
  const [primaryUseCase, setPrimaryUseCase] = useState<PrimaryUseCaseValue | "">("self_maternal");

  const steps = useMemo(() => {
    if (primaryUseCase === "partner_support") {
      return STEP_DEFS.filter((s) => s.id !== "journey" && s.id !== "pregnancy");
    }
    return STEP_DEFS;
  }, [primaryUseCase]);

  useEffect(() => {
    setStep((s) => Math.min(s, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailRegistered, setEmailRegistered] = useState<boolean | null>(null);
  const [emailLookupPending, setEmailLookupPending] = useState(false);
  const [password, setPassword] = useState("");

  const [pregnancyStatus, setPregnancyStatus] = useState<
    "planning" | "pregnant" | "postpartum" | "not_applicable"
  >("pregnant");
  const [profession, setProfession] = useState<ProfessionValue | "">("");
  const [lmpDate, setLmpDate] = useState("");
  const [eddDate, setEddDate] = useState("");
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState("");
  const [babyBirthDate, setBabyBirthDate] = useState("");
  const [gravida, setGravida] = useState("");
  const [para, setPara] = useState("");

  const [bloodType, setBloodType] = useState("unknown");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [conditionsText, setConditionsText] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [notifyCommunityActivity, setNotifyCommunityActivity] = useState(true);
  const [notifyDailyReminders, setNotifyDailyReminders] = useState(true);

  const [terms, setTerms] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = steps[step] ?? steps[0]!;
  const isLast = step === steps.length - 1;

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step, steps.length]);
  const pregVis = useMemo(
    () => resolveProfileFieldVisibility(pregnancyStatus, primaryUseCase || "self_maternal"),
    [pregnancyStatus, primaryUseCase],
  );

  useEffect(() => {
    if (primaryUseCase === "partner_support") {
      setPregnancyStatus("not_applicable");
    }
  }, [primaryUseCase]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed)) {
      queueMicrotask(() => {
        setEmailRegistered(null);
        setEmailLookupPending(false);
      });
      return;
    }
    queueMicrotask(() => setEmailLookupPending(true));
    const id = setTimeout(() => {
      void checkEmailRegistered(trimmed).then((r) => {
        if (cancelled) return;
        setEmailLookupPending(false);
        if (r.ok && "unavailable" in r && r.unavailable) {
          setEmailRegistered(null);
        } else if (r.ok && "registered" in r) {
          setEmailRegistered(r.registered);
        } else {
          setEmailRegistered(null);
        }
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [email]);

  async function nextStep() {
    if (current.id === "account") {
      const err = validateAccountCredentials({ name, email, password });
      if (err) {
        toast.error(err);
        return;
      }
      const dupCheck = await checkEmailRegistered(email.trim());
      if (!dupCheck.ok) {
        toast.error(dupCheck.error);
        return;
      }
      if (!("unavailable" in dupCheck) && dupCheck.registered) {
        toast.error("This email is already registered. Try signing in instead.");
        setEmailRegistered(true);
        return;
      }
    }
    if (current.id === "about") {
      const perr = validateProfession(profession);
      if (perr) {
        toast.error(perr);
        return;
      }
    }
    if (current.id === "journey") {
      // Journey status is optional; user can refine later in Profile.
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function skipStep() {
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const accErr = validateAccountCredentials({ name, email, password });
    if (accErr) return toast.error(accErr);
    const termsErr = validateTermsAccepted(terms);
    if (termsErr) return toast.error(termsErr);
    const perr = validateProfession(profession);
    if (perr) return toast.error(perr);

    const dupCheck = await checkEmailRegistered(email.trim());
    if (!dupCheck.ok) {
      toast.error(dupCheck.error);
      return;
    }
    if (!("unavailable" in dupCheck) && dupCheck.registered) {
      toast.error("This email is already registered. Try signing in instead.");
      setEmailRegistered(true);
      return;
    }

    setSaving(true);
    const result = await registerAccount(name, email, password);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    const draft: SignupProfileDraft = {
      displayName: name.trim(),
      sex,
      primaryUseCase,
      profession,
      pregnancyStatus,
      lmpDate,
      eddDate,
      gestationalAgeWeeks,
      babyBirthDate,
      gravida,
      para,
      bloodType,
      heightCm,
      weightKg,
      conditionsText,
      healthNotes,
      phone,
      timezone,
      notifyCommunityActivity,
      notifyDailyReminders,
    };
    const profilePayload = buildSignupProfilePayload(draft);

    if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      toast.info(result.message);
      router.push("/login");
      setSaving(false);
      return;
    }

    const hasExtra = Object.values(profilePayload).some((v) => v !== undefined && v !== "unknown");
    if (hasExtra) {
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profilePayload),
        });
      } catch {
        // Non-blocking: account creation already succeeded.
      }
    }

    toast.success("Welcome to MaaCare");
    router.push("/app");
  }

  return (
      <form onSubmit={submit} className="min-w-0 space-y-4 overflow-x-hidden">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 max-sm:truncate text-xs font-medium text-muted-foreground sm:whitespace-normal">
              {current.title}
              {current.optional ? " (optional)" : ""}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full min-w-0 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {current.id === "account" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Full name</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Aisha Rahman"
                  className={`${fieldBase} pl-9`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={`${fieldBase} pl-9`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {emailLookupPending && isValidEmailFormat(email.trim()) ? (
                <p className="mt-1.5 text-xs text-muted-foreground">Checking if this email is already in use…</p>
              ) : null}
              {emailRegistered === true ? (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                  This email is already registered.{" "}
                  <Link href="/login" className="underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  instead.
                </p>
              ) : null}
              {email.trim() && !isValidEmailFormat(email.trim()) ? (
                <p className="mt-1.5 text-xs text-destructive">
                  Enter a valid email address (include @ and a domain).
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  className={`${fieldBase} pl-9`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {current.id === "about" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Sex (optional)</Label>
              <SexIconCards
                value={sex}
                onChange={(v) => setSex(v as SignupProfileDraft["sex"])}
                className="mt-1.5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Why are you using MaaCare?</Label>
              <Select
                value={primaryUseCase || "self_maternal"}
                onValueChange={(v) => setPrimaryUseCase(v as PrimaryUseCaseValue)}
              >
                <SelectTrigger className={cn("mt-1.5", fieldBase)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_USE_CASE_VALUES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRIMARY_USE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">How do you use MaaCare professionally?</Label>
              <p className="text-xs text-muted-foreground">Care teams vs families — you can change this later.</p>
              <ProfessionPicker value={profession} onChange={setProfession} />
            </div>
          </div>
        )}

        {current.id === "journey" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Where are you in your journey?</Label>
              <p className="text-xs text-muted-foreground">You can add dates later in Profile.</p>
              <JourneyStatusPicker value={pregnancyStatus} onChange={setPregnancyStatus} />
            </div>
          </div>
        )}

        {current.id === "pregnancy" && (
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              Journey: <span className="font-medium text-foreground">{pregnancyStatus.replace("_", " ")}</span>
              {pregnancyStatus === "not_applicable"
                ? " — no pregnancy details needed."
                : " — add what you know; you can skip and fill in later."}
            </p>

            {pregVis.showLmpEdd && (
              <div className="flex w-full min-w-0 max-w-full flex-col gap-4">
                <div className="w-full min-w-0 max-w-full">
                  <Label htmlFor="lmp">Last menstrual period (LMP)</Label>
                  <div className="mt-1.5 min-w-0">
                    <PopoverDateInput
                      id="lmp"
                      value={lmpDate}
                      onChange={setLmpDate}
                      className={fieldBase}
                      placeholder="Select LMP"
                    />
                  </div>
                </div>
                <div className="w-full min-w-0 max-w-full">
                  <Label htmlFor="edd">Estimated due date (EDD)</Label>
                  <div className="mt-1.5 min-w-0">
                    <PopoverDateInput
                      id="edd"
                      value={eddDate}
                      onChange={setEddDate}
                      className={fieldBase}
                      placeholder="Select due date"
                    />
                  </div>
                </div>
              </div>
            )}

            {pregVis.showGestationalWeek && (
              <div>
                <Label htmlFor="ga">Gestational age (weeks)</Label>
                <Input
                  id="ga"
                  type="number"
                  min={0}
                  max={45}
                  className={cn("mt-1.5", fieldBase)}
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                />
              </div>
            )}

            {pregVis.showBabyBirth && (
              <div className="w-full min-w-0 max-w-full">
                <Label htmlFor="birth">Baby&apos;s birth date</Label>
                <div className="mt-1.5 min-w-0">
                  <PopoverDateInput
                    id="birth"
                    value={babyBirthDate}
                    onChange={setBabyBirthDate}
                    className={fieldBase}
                    placeholder="Select birth date"
                  />
                </div>
              </div>
            )}

            {pregVis.showGravidaPara && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="gravida">Gravida (pregnancies)</Label>
                  <Input
                    id="gravida"
                    type="number"
                    min={0}
                    max={30}
                    className={cn("mt-1.5", fieldBase)}
                    value={gravida}
                    onChange={(e) => setGravida(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="para">Para (births)</Label>
                  <Input
                    id="para"
                    type="number"
                    min={0}
                    max={30}
                    className={cn("mt-1.5", fieldBase)}
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {current.id === "health" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-0">
                <Label>Blood type</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger className={cn("mt-1.5", fieldBase)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"].map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="h">Height (cm)</Label>
                <Input
                  id="h"
                  type="number"
                  className={cn("mt-1.5", fieldBase)}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="w">Weight (kg)</Label>
                <Input
                  id="w"
                  type="number"
                  className={cn("mt-1.5", fieldBase)}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="conditions">Medical conditions (comma separated)</Label>
              <Input
                id="conditions"
                className={cn("mt-1.5", fieldBase)}
                placeholder="e.g. anemia, hypertension"
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Health notes</Label>
              <Textarea
                id="notes"
                className="mt-1.5 min-h-[90px] w-full min-w-0 rounded-sm shadow-none focus-visible:ring-1"
                placeholder="Anything important your care team should know..."
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {current.id === "preferences" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                className={cn("mt-1.5", fieldBase)}
                placeholder="+880..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Time zone (optional)</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">e.g. Asia/Dhaka — used for reminder timing.</p>
              <Input
                id="timezone"
                className={cn("mt-1.5", fieldBase)}
                placeholder="Asia/Dhaka"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={notifyCommunityActivity}
                onCheckedChange={(v) => setNotifyCommunityActivity(!!v)}
                className="mt-0.5 rounded-sm"
              />
              <span className="text-muted-foreground">Notify me about community replies and likes.</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={notifyDailyReminders}
                onCheckedChange={(v) => setNotifyDailyReminders(!!v)}
                className="mt-0.5 rounded-sm"
              />
              <span className="text-muted-foreground">Notify me about daily health reminders.</span>
            </label>
          </div>
        )}

        {current.id === "consent" && (
          <div className="space-y-3">
            <div className="break-words rounded-sm border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Account: <span className="font-medium text-foreground">{name || "—"}</span> · {email || "—"}
              <br />
              Primary focus:{" "}
              <span className="font-medium text-foreground">
                {PRIMARY_USE_LABEL[primaryUseCase || "self_maternal"]}
              </span>
              <br />
              Journey: <span className="font-medium text-foreground">{pregnancyStatus.replace("_", " ")}</span>
              <br />
              Role:{" "}
              <span className="font-medium text-foreground">
                {profession === "clinician"
                  ? "Clinician"
                  : profession === "parent_caregiver"
                    ? "Parent / caregiver"
                    : profession === "other"
                      ? "Other"
                      : "—"}
              </span>
              <br />
              You can edit any skipped details later from Profile.
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5 rounded-sm" />
              <span className="text-muted-foreground">
                I agree to the <a href="#" className="font-medium text-primary">Terms</a> and{" "}
                <a href="#" className="font-medium text-primary">Privacy Policy</a>.
              </span>
            </label>
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            Back
          </Button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {current.optional && !isLast ? (
              <Button type="button" variant="ghost" className="rounded-sm" onClick={skipStep} disabled={saving}>
                Skip for now
              </Button>
            ) : null}

            {!isLast ? (
              <Button
                type="button"
                className="rounded-sm"
                onClick={() => void nextStep()}
                disabled={
                  saving ||
                  (current.id === "account" &&
                    (!isValidEmailFormat(email.trim()) || emailRegistered === true))
                }
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="rounded-sm" disabled={saving}>
                {saving ? "Creating account..." : "Create account"}
              </Button>
            )}
          </div>
        </div>
      </form>
  );
}
