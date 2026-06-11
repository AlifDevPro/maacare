"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileText,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartPulse,
  History,
  Bot,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  REPORT_IMAGE_ACCEPT,
  validateReportUploadFile,
} from "@/lib/reports/file-utils";
import { SubscriptionQuotaChip } from "@/components/subscription/subscription-quota-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { apiErrorMessage, reportLoadingSteps } from "@/lib/reports/user-messages";
import { useTranslation } from "react-i18next";

type Finding = {
  name: string;
  value: string;
  range: string;
  status: "normal" | "low" | "high" | "borderline";
  note: string;
};

type AnalysisResult = {
  isMedicalReport?: boolean;
  summary: string;
  plainExplanation: string;
  riskLevel: "low" | "medium" | "high";
  findings: Finding[];
  recommendations: string[];
  extractedVitals: Record<string, number | null | undefined>;
  savedVitalId?: string | null;
  savedVitals?: boolean;
  extractedProfile: {
    conditions: string[];
    allergies: string[];
    medications: string[];
    notes?: string;
  };
  savedProfile?: {
    conditions: number;
    allergies: number;
    medications: number;
    notesUpdated: boolean;
  };
  savedReportId?: string | null;
  saveError?: string | null;
  reportAvailableToAi?: boolean;
  documentType?: string;
};

const ANALYZE_TIMEOUT_MS = 55_000;
const RATE_LIMIT_RE = /\b(resource_exhausted|quota|rate[\s_-]*limit|too many requests|429|rate_limited)\b/i;

export default function ReportsPage() {
  const { t } = useTranslation("health");
  const { subscription, loading: subLoading, handleApiResponse, openPaywall } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadingTimerRef = useRef<number | null>(null);
  const [stage, setStage] = useState<"input" | "loading" | "result">("input");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [reportText, setReportText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reportForSelf, setReportForSelf] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(12);
  const loadingSteps =
    inputMode === "file" ? reportLoadingSteps.file : reportLoadingSteps.text;

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current != null) window.clearInterval(loadingTimerRef.current);
    };
  }, []);

  function resetToFreshInput() {
    setStage("input");
    setAnalysis(null);
    setReportText("");
    setFile(null);
    setInputMode("file");
    setReportForSelf(true);
    setCooldownSeconds(0);
    setLimitMessage(null);
    setLoadingStep(0);
    setLoadingProgress(12);
    setUiError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startCooldown(seconds: number, message?: string) {
    const retry = Math.max(1, Number(seconds || 60));
    setCooldownSeconds(retry);
    setLimitMessage(message ?? "We're busy right now. Please wait and try again.");
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleFileChange(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    const validationError = validateReportUploadFile(next);
    if (validationError) {
      setUiError(validationError);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUiError(null);
    setFile(next);
  }

  function startLoadingAnimation() {
    setLoadingStep(0);
    setLoadingProgress(10);
    if (loadingTimerRef.current != null) window.clearInterval(loadingTimerRef.current);

    loadingTimerRef.current = window.setInterval(() => {
      setLoadingProgress((p) => (p >= 92 ? p : p + 1));
      setLoadingStep((s) => (s >= loadingSteps.length - 1 ? s : s + (Math.random() > 0.65 ? 1 : 0)));
    }, 900);
  }

  function stopLoadingAnimation(finalProgress?: number) {
    if (loadingTimerRef.current != null) {
      window.clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    if (finalProgress != null) setLoadingProgress(finalProgress);
  }

  async function analyzeReport() {
    if (inputMode === "text" && !reportText.trim()) {
      setUiError("Paste your report text first, then tap Simplify report.");
      return;
    }
    if (inputMode === "file") {
      if (!file) {
        setUiError("Upload an image of your report first, then tap Simplify report.");
        return;
      }
      const validationError = validateReportUploadFile(file);
      if (validationError) {
        setUiError(validationError);
        return;
      }
    }

    setUiError(null);
    setAnalyzing(true);
    setStage("loading");
    startLoadingAnimation();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    try {
      const fd = new FormData();
      fd.append("reportTitle", "");
      fd.append("reportText", inputMode === "text" ? reportText.trim() : "");
      fd.append("saveVitals", String(reportForSelf));
      fd.append("saveProfileInsights", String(reportForSelf));
      fd.append("persistReport", String(reportForSelf));
      if (inputMode === "file" && file) fd.append("file", file);

      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        credentials: "include",
        body: fd,
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as AnalysisResult & {
        error?: string;
        message?: string;
        retryAfterSeconds?: number;
      };

      if (handleApiResponse(res, data)) {
        setStage("input");
        return;
      }

      const errText = apiErrorMessage(data);
      const looksLikeLimit = res.status === 429 || RATE_LIMIT_RE.test(data.error ?? "") || RATE_LIMIT_RE.test(data.message ?? "");
      if (looksLikeLimit) {
        startCooldown(Number(data.retryAfterSeconds ?? 60), errText);
        setStage("input");
        return;
      }

      if (!res.ok) {
        throw new Error(errText);
      }

      stopLoadingAnimation(100);
      setLoadingStep(loadingSteps.length - 1);
      setAnalysis(data);
      setStage("result");
    } catch (e) {
      stopLoadingAnimation();
      if (e instanceof DOMException && e.name === "AbortError") {
        setUiError("This is taking longer than expected. Please try again with a smaller or clearer image.");
      } else {
        const msg = e instanceof Error ? e.message : "We couldn't simplify this report.";
        if (RATE_LIMIT_RE.test(msg)) {
          startCooldown(60);
          setStage("input");
          return;
        }
        setUiError(apiErrorMessage({ message: msg }));
      }
      setStage("input");
    } finally {
      window.clearTimeout(timeoutId);
      stopLoadingAnimation();
      setAnalyzing(false);
    }
  }

  const hasProfileInsights =
    analysis &&
    (analysis.extractedProfile.conditions.length > 0 ||
      analysis.extractedProfile.allergies.length > 0 ||
      analysis.extractedProfile.medications.length > 0 ||
      Boolean(analysis.extractedProfile.notes?.trim()));

  return (
    <AppShell>
      <AppHeader title={t("reports_understand_title")} showBack />
      <div className="space-y-5 px-4 pt-4">
        {stage === "input" ? (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/reports/history">
                <History className="mr-1.5 h-4 w-4" /> {t("reports_history_title")}
              </Link>
            </Button>
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          {stage === "input" ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              <Card className="p-4">
                <div className="grid gap-4">
                  {subLoading ? (
                    <Skeleton className="h-10 w-full rounded-xl" />
                  ) : (
                    <SubscriptionQuotaChip
                      label="Report simplification"
                      quota={subscription.quotas.reportSimplification}
                      isPremium={subscription.isPremium}
                      variant="plain"
                    />
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="report-save" className="text-sm font-medium">
                      Save
                    </Label>
                    <Switch
                      id="report-save"
                      checked={reportForSelf}
                      onCheckedChange={setReportForSelf}
                      aria-label="Save report to your profile"
                    />
                  </div>

                  <div className="flex border-b border-border">
                    <button
                      type="button"
                      onClick={() => setInputMode("file")}
                      className={cn(
                        "flex-1 border-b-2 pb-2 text-sm font-semibold transition-colors",
                        inputMode === "file"
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Upload image
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("text")}
                      className={cn(
                        "flex-1 border-b-2 pb-2 text-sm font-semibold transition-colors",
                        inputMode === "text"
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Paste text
                    </button>
                  </div>

                  {inputMode === "text" ? (
                    <>
                      <Textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Paste the text from your lab or medical report here..."
                        className="min-h-[180px] rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste the full report text for the clearest summary.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/80 p-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center rounded-xl px-4 py-6 text-center transition-colors hover:bg-muted/50"
                      >
                        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                          <Upload className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-semibold">Upload an image of your report</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          JPG, PNG, or WebP · up to 10 MB
                        </p>
                      </button>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept={REPORT_IMAGE_ACCEPT}
                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                      {file ? (
                        <div className="mt-2 flex w-full min-w-0 max-w-full items-start gap-1.5 overflow-hidden rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span
                            className="min-w-0 flex-1 break-all whitespace-normal leading-relaxed"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {cooldownSeconds > 0 ? (
                    <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                      {limitMessage ?? "We're busy right now."} Try again in {cooldownSeconds}s.
                    </div>
                  ) : null}
                  {uiError ? (
                    <div className="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 dark:border-red-500/40 dark:bg-red-500/15">
                      <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                        Could not simplify this report
                      </p>
                      <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{uiError}</p>
                    </div>
                  ) : null}

                  <Button
                    className="rounded-2xl"
                    disabled={
                      analyzing ||
                      cooldownSeconds > 0 ||
                      (!subscription.isPremium &&
                        (subscription.quotas.reportSimplification.remaining ?? 0) <= 0)
                    }
                    onClick={() => {
                      if (
                        !subscription.isPremium &&
                        (subscription.quotas.reportSimplification.remaining ?? 0) <= 0
                      ) {
                        openPaywall("report_simplification");
                        return;
                      }
                      void analyzeReport();
                    }}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> Simplify report
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {stage === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Card className="p-6">
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </span>
                  <p className="text-base font-semibold">Working on your summary...</p>
                  <p className="max-w-sm text-sm text-muted-foreground">{loadingSteps[loadingStep]}</p>
                  <div className="mt-2 w-full max-w-sm">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">This usually takes under a minute</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {stage === "result" && analysis ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <Card className="overflow-hidden border-0 bg-gradient-warm p-5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary/80">
                  <Sparkles className="h-3.5 w-3.5" /> Simplified summary
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {analysis.isMedicalReport === false ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Not a medical report
                    </span>
                  ) : (
                    <>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          analysis.riskLevel === "high"
                            ? "bg-risk-high text-risk-high-foreground"
                            : analysis.riskLevel === "medium"
                              ? "bg-risk-medium text-risk-medium-foreground"
                              : "bg-risk-low text-risk-low-foreground"
                        }`}
                      >
                        {analysis.riskLevel === "high"
                          ? "Needs attention"
                          : analysis.riskLevel === "medium"
                            ? "Worth discussing"
                            : "Mostly reassuring"}
                      </span>
                      {analysis.findings.length > 0 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {analysis.findings.length} key result{analysis.findings.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/95">{analysis.summary}</p>
              </Card>
            </motion.div>

            {analysis.saveError ? (
              <Card className="border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/15">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t("reports_save_error_title")}
                </p>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">{analysis.saveError}</p>
              </Card>
            ) : null}

            {analysis.savedReportId ? (
              <Card className="flex items-start gap-2 bg-primary-soft/30 p-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {analysis.reportAvailableToAi
                      ? t("reports_saved_ai_available")
                      : t("reports_saved_history")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("reports_saved_ai_hint")}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Button asChild variant="link" className="h-auto p-0 text-xs">
                      <Link href={`/reports/${analysis.savedReportId}`}>{t("reports_view_saved")}</Link>
                    </Button>
                    <Button asChild variant="link" className="h-auto p-0 text-xs">
                      <Link href="/reports/history">{t("reports_history_title")}</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {analysis.savedVitals ? (
              <Card className="flex items-center gap-2 bg-accent-soft/40 p-3">
                <HeartPulse className="h-4 w-4 text-accent" />
                <p className="text-sm">Key measurements were saved to your health tracker.</p>
              </Card>
            ) : null}

            {analysis.savedProfile &&
            (analysis.savedProfile.conditions > 0 ||
              analysis.savedProfile.allergies > 0 ||
              analysis.savedProfile.medications > 0 ||
              analysis.savedProfile.notesUpdated) ? (
              <Card className="p-3">
                <p className="text-sm font-medium">Useful details saved to your profile</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    analysis.savedProfile.conditions > 0
                      ? `${analysis.savedProfile.conditions} condition${analysis.savedProfile.conditions === 1 ? "" : "s"}`
                      : null,
                    analysis.savedProfile.allergies > 0
                      ? `${analysis.savedProfile.allergies} allerg${analysis.savedProfile.allergies === 1 ? "y" : "ies"}`
                      : null,
                    analysis.savedProfile.medications > 0
                      ? `${analysis.savedProfile.medications} medication${analysis.savedProfile.medications === 1 ? "" : "s"}`
                      : null,
                    analysis.savedProfile.notesUpdated ? "notes updated" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Card>
            ) : null}

            {analysis.findings.length > 0 ? (
              <div className="space-y-2">
                <h2 className="font-display text-sm font-semibold">Important results</h2>
                <div className="grid gap-2">
                  {analysis.findings.map((f, idx) => (
                    <ValueRow
                      key={`${f.name}-${idx}`}
                      name={f.name}
                      value={f.value}
                      range={f.range || "—"}
                      status={f.status === "borderline" ? "high" : f.status}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold">What this means</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{analysis.plainExplanation}</p>
            </Card>

            {analysis.recommendations.length > 0 ? (
              <Card className="p-4">
                <h3 className="font-display text-sm font-semibold">Suggested next steps</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {analysis.recommendations.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {hasProfileInsights ? (
              <Card className="p-4">
                <h3 className="font-display text-sm font-semibold">Also noted in your report</h3>
                <div className="mt-2 space-y-2 text-sm">
                  <InsightList title="Conditions" items={analysis.extractedProfile.conditions} />
                  <InsightList title="Allergies" items={analysis.extractedProfile.allergies} />
                  <InsightList title="Medications" items={analysis.extractedProfile.medications} />
                </div>
                {analysis.extractedProfile.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">{analysis.extractedProfile.notes}</p>
                ) : null}
              </Card>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link
                  href={`/chat?reportContext=${encodeURIComponent(
                    JSON.stringify({
                      title: "Medical report",
                      summary: analysis.summary,
                      plainExplanation: analysis.plainExplanation,
                      findings: analysis.findings,
                      recommendations: analysis.recommendations,
                    }),
                  )}`}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Ask a question
                </Link>
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetToFreshInput}>
                <FileText className="mr-1.5 h-4 w-4" /> Simplify another
              </Button>
            </div>
          </>
        ) : null}
        <p className="px-2 text-center text-[11px] text-muted-foreground">
          For guidance only — not a diagnosis. Share anything urgent with your care team.
        </p>
      </div>
    </AppShell>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ValueRow({
  name,
  value,
  range,
  status,
}: {
  name: string;
  value: string;
  range: string;
  status: "normal" | "low" | "high";
}) {
  const map = {
    normal: { color: "bg-risk-low text-risk-low-foreground", icon: CheckCircle2, label: "Normal" },
    low: { color: "bg-risk-medium text-risk-medium-foreground", icon: AlertCircle, label: "Low" },
    high: { color: "bg-risk-high text-risk-high-foreground", icon: AlertCircle, label: "High" },
  } as const;
  const s = map[status];
  return (
    <Card className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        {range !== "—" ? <p className="text-xs text-muted-foreground">Typical range: {range}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{value}</span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
          <s.icon className="h-3 w-3" />
          {s.label}
        </span>
      </div>
    </Card>
  );
}
