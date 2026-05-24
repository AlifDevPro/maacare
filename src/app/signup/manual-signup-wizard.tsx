"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Mail, Lock, User } from "lucide-react";
import { JourneyStatusPicker, type ProfessionValue } from "@/components/profile/journey-profession-pickers";
import { SignupProfessionPicker } from "@/components/signup/signup-profession-picker";
import { StepProgressRail } from "@/components/onboarding/step-progress-rail";
import { SignupMorphContent } from "@/components/signup/signup-morph-content";
import type { SignupWizardNav } from "@/components/signup/signup-wizard-nav";
import { Input } from "@/components/ui/input";
import { PopoverDateInput } from "@/components/ui/popover-date-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BloodTypeCardPicker } from "@/components/profile/blood-type-card-picker";
import { Textarea } from "@/components/ui/textarea";
import { checkEmailRegistered, registerAccount } from "@/lib/auth-client";
import { buildSignupProfilePayload } from "@/lib/signup/build-profile-payload";
import type { SignupProfileDraft } from "@/lib/signup/signup-draft";
import {
  applySexAwareProfileDefaults,
  resolveProfileFieldVisibility,
  shouldCollectOwnPregnancyJourney,
} from "@/lib/profile/journey-fields";
import { defaultPrimaryUseForProfession } from "@/lib/profile/primary-use-case";
import type { PrimaryUseCaseValue } from "@/lib/profile/primary-use-case";
import {
  validateAccountCredentials,
  validateProfession,
  validateTermsAccepted,
} from "@/lib/signup/validators";
import { isValidEmailFormat } from "@/lib/validation/email";
import {
  AuthInlineAlert,
  AuthMailSuccessState,
  AuthSubmittingState,
} from "@/components/auth/auth-inline-feedback";
import { FORM_FOCUS_SAFE } from "@/lib/form-control-focus";
import { cn } from "@/lib/utils";

import { SexIconCards } from "@/components/profile/sex-icon-cards";

type StepId =
  | "persona"
  | "account"
  | "clinician_profile"
  | "student_profile"
  | "journey"
  | "pregnancy"
  | "health"
  | "preferences";

type StepDef = { id: StepId; titleKey: string; optional?: boolean };

const STEP_FALLBACK_ORDER: StepId[] = [
  "persona",
  "account",
  "clinician_profile",
  "student_profile",
  "journey",
  "pregnancy",
  "health",
  "preferences",
];

function buildStepDefs(
  profession: ProfessionValue | "",
  primaryUseCase: PrimaryUseCaseValue | "",
  sex: SignupProfileDraft["sex"],
): StepDef[] {
  const out: StepDef[] = [
    { id: "persona", titleKey: "signup_wizard_step_persona" },
    { id: "account", titleKey: "signup_wizard_step_account" },
  ];
  if (!profession) return out;

  if (profession === "parent_caregiver") {
    if (shouldCollectOwnPregnancyJourney(profession, primaryUseCase, sex)) {
      out.push({ id: "journey", titleKey: "signup_wizard_step_journey" });
      out.push({ id: "pregnancy", titleKey: "signup_wizard_step_pregnancy", optional: true });
    }
  } else if (profession === "clinician") {
    out.push({ id: "clinician_profile", titleKey: "signup_wizard_step_clinician" });
  } else if (profession === "student_researcher") {
    out.push({ id: "student_profile", titleKey: "signup_wizard_step_student" });
  }

  out.push(
    { id: "health", titleKey: "signup_wizard_step_health", optional: true },
    { id: "preferences", titleKey: "signup_wizard_step_finish" },
  );
  return out;
}

const fieldBase =
  "rounded-md border border-input bg-background shadow-none focus-visible:ring-1 h-11 w-full min-w-0 px-3";

export const MANUAL_SIGNUP_FORM_ID = "manual-signup-form";

type ManualSignupWizardProps = {
  onNavChange: (nav: SignupWizardNav | null) => void;
  onCompleteChange?: (complete: boolean) => void;
};

export function ManualSignupWizard({ onNavChange, onCompleteChange }: ManualSignupWizardProps) {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const [stepId, setStepId] = useState<StepId>("persona");

  const [sex, setSex] = useState<SignupProfileDraft["sex"]>("");
  const [primaryUseCase, setPrimaryUseCase] = useState<PrimaryUseCaseValue | "">("self_maternal");

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

  const [clinicianSpecialty, setClinicianSpecialty] = useState("");
  const [clinicianInstitution, setClinicianInstitution] = useState("");
  const [studentAffiliation, setStudentAffiliation] = useState("");
  const [studentFieldOfStudy, setStudentFieldOfStudy] = useState("");

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
  const [formError, setFormError] = useState<string | null>(null);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const steps = useMemo(
    () =>
      buildStepDefs(
        profession,
        (primaryUseCase || "self_maternal") as PrimaryUseCaseValue,
        sex,
      ),
    [profession, primaryUseCase, sex],
  );

  function applySexDefaults(nextSex: SignupProfileDraft["sex"]) {
    if (nextSex !== "male") return;
    const d = applySexAwareProfileDefaults({
      sex: nextSex,
      primaryUseCase: primaryUseCase || "self_maternal",
      pregnancyStatus,
    });
    setPrimaryUseCase(d.primaryUseCase as PrimaryUseCaseValue);
    setPregnancyStatus(d.pregnancyStatus as typeof pregnancyStatus);
  }

  useEffect(() => {
    if (steps.some((s) => s.id === stepId)) return;
    const idx = STEP_FALLBACK_ORDER.indexOf(stepId);
    const nextId =
      STEP_FALLBACK_ORDER.slice(idx >= 0 ? idx : 0).find((id) => steps.some((s) => s.id === id)) ??
      steps[0]?.id ??
      "persona";
    queueMicrotask(() => setStepId(nextId));
  }, [steps, stepId]);

  const resolvedIdx = steps.findIndex((s) => s.id === stepId);
  const stepIndex = resolvedIdx === -1 ? 0 : resolvedIdx;
  const current = steps[stepIndex] ?? steps[0]!;
  const isLast = stepIndex === steps.length - 1;

  const progress = useMemo(() => {
    if (steps.length <= 1) return 0;
    return (stepIndex / (steps.length - 1)) * 100;
  }, [stepIndex, steps.length]);
  const pregVis = useMemo(
    () => resolveProfileFieldVisibility(pregnancyStatus, primaryUseCase || "self_maternal", sex),
    [pregnancyStatus, primaryUseCase, sex],
  );

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
    queueMicrotask(() => {
      setEmailLookupPending(true);
      setEmailRegistered(null);
    });
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

  function goNextStepId() {
    const i = steps.findIndex((s) => s.id === stepId);
    const next = steps[Math.min(steps.length - 1, Math.max(0, i) + 1)];
    if (next) setStepId(next.id);
  }

  function goPrevStepId() {
    const i = steps.findIndex((s) => s.id === stepId);
    const prev = steps[Math.max(0, i - 1)];
    if (prev) setStepId(prev.id);
  }

  async function nextStep() {
    setFormError(null);
    if (current.id === "persona") {
      const perr = validateProfession(profession);
      if (perr) {
        setFormError(perr);
        return;
      }
    }
    if (current.id === "account") {
      const err = validateAccountCredentials({ name, email, password });
      if (err) {
        setFormError(err);
        return;
      }
      const dupCheck = await checkEmailRegistered(email.trim());
      if (dupCheck.ok && !("unavailable" in dupCheck) && dupCheck.registered) {
        setFormError(t("signup_wizard_email_taken"));
        setEmailRegistered(true);
        return;
      }
    }
    goNextStepId();
  }

  function skipStep() {
    goNextStepId();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const accErr = validateAccountCredentials({ name, email, password });
    setFormError(null);
    if (accErr) {
      setFormError(accErr);
      return;
    }
    const termsErr = validateTermsAccepted(terms);
    if (termsErr) {
      setFormError(termsErr);
      return;
    }
    const perr = validateProfession(profession);
    if (perr) {
      setFormError(perr);
      return;
    }

    const dupCheck = await checkEmailRegistered(email.trim());
    if (dupCheck.ok && !("unavailable" in dupCheck) && dupCheck.registered) {
      setFormError(t("signup_wizard_email_taken"));
      setEmailRegistered(true);
      return;
    }

    setSaving(true);
    const result = await registerAccount(name, email, password);
    if (!result.ok) {
      setFormError(result.error);
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
      clinicianSpecialty,
      clinicianInstitution,
      studentAffiliation,
      studentFieldOfStudy,
    };
    const profilePayload = buildSignupProfilePayload(draft);

    if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      setEmailConfirmSent(true);
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

    router.push("/app");
  }

  const stepTitle = `${t(current.titleKey)}${current.optional ? ` (${t("signup_wizard_optional_suffix")})` : ""}`;

  useEffect(() => {
    onCompleteChange?.(emailConfirmSent);
  }, [emailConfirmSent, onCompleteChange]);

  useEffect(() => {
    setFormError(null);
  }, [stepId]);

  useEffect(() => {
    if (emailConfirmSent || saving) {
      onNavChange(null);
      return;
    }

    const accountStepInvalid =
      current.id === "account" &&
      (!isValidEmailFormat(email.trim()) ||
        (emailRegistered === true && !emailLookupPending));
    const finishStepInvalid = isLast && !terms;

    onNavChange({
      isFirstStep: stepIndex === 0,
      onBackStep: goPrevStepId,
      primaryLabel: isLast ? t("signup_wizard_create") : t("signup_wizard_continue"),
      onPrimary: () => void nextStep(),
      primaryDisabled: saving || (!isLast && accountStepInvalid) || finishStepInvalid,
      showSkip: Boolean(current.optional && !isLast),
      onSkip: skipStep,
      isSubmit: isLast,
      formId: MANUAL_SIGNUP_FORM_ID,
      stepId: current.id,
    });
  }, [
    current,
    email,
    emailConfirmSent,
    emailLookupPending,
    emailRegistered,
    isLast,
    onNavChange,
    saving,
    stepIndex,
    t,
    terms,
  ]);

  if (emailConfirmSent) {
    return (
      <AuthMailSuccessState
        title={t("signup_email_confirm_title")}
        body={t("signup_email_confirm_body")}
        email={email.trim()}
      />
    );
  }

  if (saving) {
    return <AuthSubmittingState label={t("signup_wizard_creating")} />;
  }

  return (
    <form
      id={MANUAL_SIGNUP_FORM_ID}
      onSubmit={submit}
      className={cn("min-w-0 space-y-4", FORM_FOCUS_SAFE)}
    >
      {formError ? <AuthInlineAlert message={formError} /> : null}
      <StepProgressRail label={stepTitle} percent={progress} />

      <SignupMorphContent contentKey={current.id}>
      {current.id === "persona" && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("signup_wizard_persona_hint")}</p>
          <SignupProfessionPicker
            value={profession}
            onChange={(p) => {
              setProfession(p);
              if (p === "student_researcher") {
                setPrimaryUseCase("student_research");
                setPregnancyStatus("not_applicable");
              } else if (p === "clinician") {
                setPrimaryUseCase("clinician");
                setPregnancyStatus("not_applicable");
              } else if (p === "parent_caregiver") {
                setPrimaryUseCase(defaultPrimaryUseForProfession(p, sex || undefined));
                if (sex === "male") {
                  setPregnancyStatus("not_applicable");
                }
              }
            }}
          />
          <div className="space-y-2 pt-1">
            <Label className="text-base font-semibold">{t("signup_wizard_sex_optional")}</Label>
            <p className="text-xs text-muted-foreground">{t("signup_wizard_sex_hint")}</p>
            <SexIconCards
              value={sex}
              onChange={(v) => {
                setSex(v as SignupProfileDraft["sex"]);
                applySexDefaults(v as SignupProfileDraft["sex"]);
              }}
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      {current.id === "account" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">{t("signup_wizard_full_name")}</Label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                placeholder="Aisha Rahman"
                className={`${fieldBase} pl-9`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                autoComplete="name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`${fieldBase} pl-9`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                  setEmailRegistered(null);
                }}
              />
            </div>
            {emailLookupPending && isValidEmailFormat(email.trim()) ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{t("signup_wizard_email_checking")}</p>
            ) : null}
            {emailRegistered === true ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                {t("signup_wizard_email_taken")}{" "}
                <Link href="/login" className="underline underline-offset-2">
                  {t("signup_footer_login")}
                </Link>
              </p>
            ) : null}
            {email.trim() && !isValidEmailFormat(email.trim()) ? (
              <p className="mt-1.5 text-xs text-destructive">{t("signup_wizard_email_invalid")}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("signup_wizard_password_hint")}
                className={`${fieldBase} pl-9`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {current.id === "clinician_profile" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("signup_wizard_clinician_disclaimer")}</p>
          <div className="space-y-2">
            <Label htmlFor="spec">{t("signup_wizard_specialty_label")}</Label>
            <Input
              id="spec"
              className={fieldBase}
              placeholder={t("signup_wizard_specialty_placeholder")}
              value={clinicianSpecialty}
              onChange={(e) => setClinicianSpecialty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inst">{t("signup_wizard_institution_label")}</Label>
            <Input
              id="inst"
              className={fieldBase}
              placeholder={t("signup_wizard_institution_placeholder")}
              value={clinicianInstitution}
              onChange={(e) => setClinicianInstitution(e.target.value)}
            />
          </div>
        </div>
      )}

      {current.id === "student_profile" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aff">{t("signup_wizard_affiliation_label")}</Label>
            <Input
              id="aff"
              className={fieldBase}
              placeholder={t("signup_wizard_affiliation_placeholder")}
              value={studentAffiliation}
              onChange={(e) => setStudentAffiliation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fos">{t("signup_wizard_field_label")}</Label>
            <Input
              id="fos"
              className={fieldBase}
              placeholder={t("signup_wizard_field_placeholder")}
              value={studentFieldOfStudy}
              onChange={(e) => setStudentFieldOfStudy(e.target.value)}
            />
          </div>
        </div>
      )}

      {current.id === "journey" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">{t("signup_wizard_journey_heading")}</Label>
            <p className="text-xs text-muted-foreground">{t("signup_wizard_journey_hint")}</p>
            <JourneyStatusPicker value={pregnancyStatus} onChange={setPregnancyStatus} />
          </div>
        </div>
      )}

      {current.id === "pregnancy" && (
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("signup_wizard_journey_status_prefix")}{" "}
            <span className="font-medium text-foreground">{pregnancyStatus.replace("_", " ")}</span>
            {pregnancyStatus === "not_applicable"
              ? ` — ${t("signup_wizard_pregnancy_na")}`
              : ` — ${t("signup_wizard_pregnancy_hint")}`}
          </p>

          {pregVis.showLmpEdd && (
            <div className="flex w-full min-w-0 max-w-full flex-col gap-4">
              <div className="w-full min-w-0 max-w-full">
                <Label htmlFor="lmp">{t("signup_wizard_lmp")}</Label>
                <div className="mt-1.5 min-w-0">
                  <PopoverDateInput
                    id="lmp"
                    value={lmpDate}
                    onChange={setLmpDate}
                    className={fieldBase}
                    placeholder={t("signup_wizard_lmp_ph")}
                  />
                </div>
              </div>
              <div className="w-full min-w-0 max-w-full">
                <Label htmlFor="edd">{t("signup_wizard_edd")}</Label>
                <div className="mt-1.5 min-w-0">
                  <PopoverDateInput
                    id="edd"
                    value={eddDate}
                    onChange={setEddDate}
                    className={fieldBase}
                    placeholder={t("signup_wizard_edd_ph")}
                  />
                </div>
              </div>
            </div>
          )}

          {pregVis.showGestationalWeek && (
            <div>
              <Label htmlFor="ga">{t("signup_wizard_ga")}</Label>
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
              <Label htmlFor="birth">{t("signup_wizard_birth")}</Label>
              <div className="mt-1.5 min-w-0">
                <PopoverDateInput
                  id="birth"
                  value={babyBirthDate}
                  onChange={setBabyBirthDate}
                  className={fieldBase}
                  placeholder={t("signup_wizard_birth_ph")}
                />
              </div>
            </div>
          )}

          {pregVis.showGravidaPara && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="gravida">{t("signup_wizard_gravida")}</Label>
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
                <Label htmlFor="para">{t("signup_wizard_para")}</Label>
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
          <div>
            <Label>{t("signup_wizard_blood_type")}</Label>
            <BloodTypeCardPicker value={bloodType} onChange={setBloodType} className="mt-2" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="h">{t("signup_wizard_height")}</Label>
              <Input
                id="h"
                type="number"
                className={cn("mt-1.5", fieldBase)}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="w">{t("signup_wizard_weight")}</Label>
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
            <Label htmlFor="conditions">{t("signup_wizard_conditions")}</Label>
            <Input
              id="conditions"
              className={cn("mt-1.5", fieldBase)}
              placeholder={t("signup_wizard_conditions_ph")}
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="notes">{t("signup_wizard_health_notes")}</Label>
            <Textarea
              id="notes"
              className="mt-1.5 min-h-[90px] w-full min-w-0 rounded-md border border-input bg-background shadow-none focus-visible:ring-1"
              placeholder={t("signup_wizard_health_notes_ph")}
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {current.id === "preferences" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="phone">{t("signup_wizard_phone_optional")}</Label>
            <Input
              id="phone"
              className={cn("mt-1.5", fieldBase)}
              placeholder="+880..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="timezone">{t("signup_wizard_timezone_optional")}</Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("signup_wizard_timezone_hint")}</p>
            <Input
              id="timezone"
              className={cn("mt-1.5", fieldBase)}
              placeholder="Asia/Dhaka"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2.5 border-t border-border/60 pt-4 text-sm">
            <Checkbox
              checked={terms}
              onCheckedChange={(v) => {
                setTerms(!!v);
                setFormError(null);
              }}
              className="mt-0.5 rounded-sm"
            />
            <span className="text-muted-foreground">{t("signup_wizard_terms_ack")}</span>
          </label>
        </div>
      )}

      </SignupMorphContent>

    </form>
  );
}
