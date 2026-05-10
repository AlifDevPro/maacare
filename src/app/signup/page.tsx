"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Mail, Lock, User, ChevronRight, Check } from "lucide-react";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registerAccount } from "@/lib/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StepId = "account" | "pregnancy" | "health" | "preferences" | "consent";

const STEPS: { id: StepId; title: string; optional?: boolean }[] = [
  { id: "account", title: "Account" },
  { id: "pregnancy", title: "Pregnancy", optional: true },
  { id: "health", title: "Health", optional: true },
  { id: "preferences", title: "Preferences", optional: true },
  { id: "consent", title: "Finish" },
];

const fieldBase =
  "rounded-sm shadow-none focus-visible:ring-1 h-10";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [pregnancyStatus, setPregnancyStatus] = useState<"planning" | "pregnant" | "postpartum" | "not_applicable">("pregnant");
  const [lmpDate, setLmpDate] = useState("");
  const [eddDate, setEddDate] = useState("");
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState("");
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

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  function nextStep() {
    if (current.id === "account") {
      if (!name.trim() || !email.trim() || !password) {
        toast.error("Please fill your name, email, and password");
        return;
      }
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function skipStep() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return toast.error("Please fill in account details");
    if (!terms) return toast.error("Please accept the Terms");

    setSaving(true);
    const result = await registerAccount(name, email, password);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    const profilePayload: Record<string, unknown> = {
      displayName: name.trim(),
      phone: phone.trim() || undefined,
      timezone: timezone.trim() || undefined,
      pregnancyStatus,
      lmpDate: lmpDate || undefined,
      eddDate: eddDate || undefined,
      gestationalAgeWeeks: gestationalAgeWeeks ? Number(gestationalAgeWeeks) : undefined,
      gravida: gravida ? Number(gravida) : undefined,
      para: para ? Number(para) : undefined,
      bloodType,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      healthNotes: healthNotes.trim() || undefined,
      notifyCommunityActivity,
      notifyDailyReminders,
    };
    const conditions = conditionsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (conditions.length > 0) profilePayload.conditions = conditions;

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
    <AuthShell
      title="Create your guided account"
      subtitle="Step-by-step registration. Optional details can be skipped and edited later."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}: {current.title}
              {current.optional ? " (optional)" : ""}
            </p>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex h-6 items-center justify-center rounded-sm border text-[10px]",
                  i < step && "border-primary/40 bg-primary-soft text-primary",
                  i === step && "border-primary text-primary",
                  i > step && "border-border text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
            ))}
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
                  placeholder="you@example.com"
                  className={`${fieldBase} pl-9`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
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

        {current.id === "pregnancy" && (
          <div className="space-y-3">
            <div>
              <Label>Pregnancy status</Label>
              <Select value={pregnancyStatus} onValueChange={(v) => setPregnancyStatus(v as typeof pregnancyStatus)}>
                <SelectTrigger className={fieldBase}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="pregnant">Pregnant</SelectItem>
                  <SelectItem value="postpartum">Postpartum</SelectItem>
                  <SelectItem value="not_applicable">Not applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lmp">LMP date</Label>
                <Input id="lmp" type="date" className={fieldBase} value={lmpDate} onChange={(e) => setLmpDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edd">EDD date</Label>
                <Input id="edd" type="date" className={fieldBase} value={eddDate} onChange={(e) => setEddDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ga">Weeks</Label>
                <Input id="ga" type="number" min={0} max={45} className={fieldBase} value={gestationalAgeWeeks} onChange={(e) => setGestationalAgeWeeks(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gravida">Gravida</Label>
                <Input id="gravida" type="number" min={0} max={30} className={fieldBase} value={gravida} onChange={(e) => setGravida(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="para">Para</Label>
                <Input id="para" type="number" min={0} max={30} className={fieldBase} value={para} onChange={(e) => setPara(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {current.id === "health" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Blood type</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger className={fieldBase}>
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
              <div>
                <Label htmlFor="h">Height (cm)</Label>
                <Input id="h" type="number" className={fieldBase} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="w">Weight (kg)</Label>
                <Input id="w" type="number" className={fieldBase} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="conditions">Medical conditions (comma separated)</Label>
              <Input
                id="conditions"
                className={fieldBase}
                placeholder="e.g. anemia, hypertension"
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Health notes</Label>
              <Textarea
                id="notes"
                className="rounded-sm shadow-none focus-visible:ring-1 min-h-[90px]"
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
                className={fieldBase}
                placeholder="+880..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                className={fieldBase}
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
            <div className="rounded-sm border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Account: <span className="font-medium text-foreground">{name || "—"}</span> · {email || "—"}
              <br />
              Pregnancy status: <span className="font-medium text-foreground">{pregnancyStatus}</span>
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

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {current.optional && !isLast ? (
              <Button type="button" variant="ghost" className="rounded-sm" onClick={skipStep} disabled={saving}>
                Skip for now
              </Button>
            ) : null}

            {!isLast ? (
              <Button type="button" className="rounded-sm" onClick={nextStep} disabled={saving}>
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
    </AuthShell>
  );
}
