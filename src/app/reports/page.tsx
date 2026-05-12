"use client";
import { useState } from "react";
import Link from "next/link";
import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  Upload,
  FileText,
  Sparkles,
  Bot,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartPulse,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Finding = {
  name: string;
  value: string;
  range: string;
  status: "normal" | "low" | "high" | "borderline";
  note: string;
};

type AnalysisResult = {
  summary: string;
  plainExplanation: string;
  riskLevel: "low" | "medium" | "high";
  findings: Finding[];
  recommendations: string[];
  extractedVitals: {
    systolicBp?: number | null;
    diastolicBp?: number | null;
    heartRateBpm?: number | null;
    weightKg?: number | null;
    temperatureC?: number | null;
    glucoseMgDl?: number | null;
    spo2Pct?: number | null;
  };
  provider?: "gemini" | "groq";
  extractionMode?: "provided_text" | "pdf_local" | "ocr_local" | "text_local" | "gemini_file";
  extractedTextPreview?: string;
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
};

export default function ReportsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<"input" | "loading" | "result">("input");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [reportText, setReportText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  /** When true, save extracted vitals and profile insights for the signed-in user. */
  const [reportForSelf, setReportForSelf] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(12);

  const loadingStepsFile = [
    "Reading your file on the server (PDF text or local OCR when available)...",
    "Running the clinical simplifier — this usually takes 15–60 seconds...",
    reportForSelf
      ? "Finishing up: saving vitals and insights to your profile when found..."
      : "Finishing up: generating your summary (not saving to your profile)...",
  ];
  const loadingStepsText = [
    "Preparing your pasted report text...",
    "Running the clinical simplifier — this usually takes 15–60 seconds...",
    reportForSelf
      ? "Finishing up: saving vitals and insights to your profile when found..."
      : "Finishing up: generating your summary (not saving to your profile)...",
  ];
  const RATE_LIMIT_RE = /\b(resource_exhausted|quota|rate[\s_-]*limit|too many requests|429)\b/i;

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
  }

  function startCooldown(seconds: number, message?: string) {
    const retry = Math.max(1, Number(seconds || 60));
    setCooldownSeconds(retry);
    setLimitMessage(message ?? "AI usage limit reached. Please wait and try again.");
    const t = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          setLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function analyzeReport() {
    if (inputMode === "text" && !reportText.trim()) {
      setUiError("Paste report text first, then tap Analyze report.");
      return;
    }
    if (inputMode === "file" && !file) {
      setUiError("Upload a report file first, then tap Analyze report.");
      return;
    }

    setUiError(null);
    setAnalyzing(true);
    setStage("loading");
    setLoadingStep(0);
    setLoadingProgress(8);

    let creep: number | undefined;

    const stopCreep = () => {
      if (creep != null) {
        window.clearInterval(creep);
        creep = undefined;
      }
    };

    const startCreep = (to: number, everyMs: number) => {
      stopCreep();
      creep = window.setInterval(() => {
        setLoadingProgress((p) => (p >= to ? p : Math.min(to, p + 1)));
      }, everyMs);
    };

    try {
      if (inputMode === "file" && file) {
        setLoadingStep(0);
        startCreep(36, 320);
        const previewFd = new FormData();
        previewFd.append("file", file);
        const previewRes = await fetch("/api/reports/extract-local", {
          method: "POST",
          credentials: "include",
          body: previewFd,
        });
        stopCreep();
        const previewData = (await previewRes.json().catch(() => ({}))) as {
          ok?: boolean;
          mode?: string;
          chars?: number;
          preview?: string;
          message?: string;
        };
        if (!previewRes.ok || !previewData.ok) {
          throw new Error(
            previewData.message ??
              "Local extraction failed. Please upload a clearer image or switch to Paste text.",
          );
        }
        setLoadingProgress(40);
      } else {
        setLoadingProgress(22);
      }

      setLoadingStep(1);
      startCreep(88, 420);

      const fd = new FormData();
      fd.append("reportTitle", "");
      fd.append("reportText", inputMode === "text" ? reportText.trim() : "");
      fd.append("saveVitals", String(reportForSelf));
      fd.append("saveProfileInsights", String(reportForSelf));
      if (inputMode === "file" && file) fd.append("file", file);

      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      stopCreep();
      const data = (await res.json().catch(() => ({}))) as
        | (AnalysisResult & { error?: string; retryAfterSeconds?: number })
        | { error?: string; retryAfterSeconds?: number };

      const errText = (data as { error?: string }).error ?? "";
      const looksLikeLimit = res.status === 429 || RATE_LIMIT_RE.test(errText);
      if (looksLikeLimit) {
        startCooldown(
          Number((data as { retryAfterSeconds?: number }).retryAfterSeconds ?? 60),
          errText || undefined,
        );
        setStage("input");
        return;
      }

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not analyze report.");
      }

      setLoadingStep(2);
      setLoadingProgress(96);
      setAnalysis(data as AnalysisResult);
      setLoadingProgress(100);
      setStage("result");
    } catch (e) {
      stopCreep();
      const msg = e instanceof Error ? e.message : "Could not analyze report.";
      if (RATE_LIMIT_RE.test(msg)) {
        startCooldown(60, "AI usage limit reached. Please wait and try again.");
        setStage("input");
        return;
      }
      setStage("input");
      setUiError(msg);
    } finally {
      stopCreep();
      setAnalyzing(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Understand your report" showBack />
      <div className="space-y-5 px-4 pt-4">
        <AnimatePresence mode="wait">
          {stage === "input" ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Card className="p-4">
                <div className="grid gap-4">
                  <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Report subject
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
                        {reportForSelf ? "My report" : "Another person's report"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {reportForSelf
                          ? "We can save vitals and clinical insights to your profile after analysis."
                          : "Preview only — nothing is saved to your account. Turn the switch off if this is your own report."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Switch
                        checked={!reportForSelf}
                        onCheckedChange={(c) => setReportForSelf(!Boolean(c))}
                        aria-label={
                          reportForSelf
                            ? "This is my report; turn on if it is for someone else"
                            : "This is another person's report; turn off for my report"
                        }
                      />
                    </div>
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
                      Upload file
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
                    <Textarea
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Paste full report text here..."
                      className="min-h-[180px] rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Upload your report file below. For best accuracy, use <strong>Paste text</strong> when you can.
                    </p>
                  )}

                  {inputMode === "file" ? (
                    <div className="rounded-2xl border border-dashed border-border/80 p-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center rounded-xl px-4 py-6 text-center transition-colors hover:bg-muted/50"
                      >
                        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                          <Upload className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-semibold">Upload file</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          PDF, image, text, CSV, or JSON (max 10MB)
                        </p>
                      </button>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,image/*,.txt,.csv,.json"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Tip: switch to <strong>Paste text</strong> for highest extraction accuracy.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Pasted text usually gives the best extraction quality and uses less AI quota than files.
                    </p>
                  )}

                  {cooldownSeconds > 0 ? (
                    <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                      {limitMessage ?? "AI usage limit reached."} Try again in {cooldownSeconds}s.
                    </div>
                  ) : null}
                  {uiError ? (
                    <div className="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 dark:border-red-500/40 dark:bg-red-500/15">
                      <p className="text-xs font-semibold text-red-800 dark:text-red-200">Could not analyze this report</p>
                      <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{uiError}</p>
                    </div>
                  ) : null}

                  <Button
                    className="rounded-2xl"
                    disabled={analyzing || cooldownSeconds > 0}
                    onClick={() => void analyzeReport()}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> Analyze report
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
                  <p className="text-base font-semibold">Analyzing your report...</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {(inputMode === "file" ? loadingStepsFile : loadingStepsText)[loadingStep]}
                  </p>
                  <div className="mt-2 w-full max-w-sm">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{loadingProgress}% complete</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {stage === "result" && analysis ? (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
            <Card className="overflow-hidden border-0 bg-gradient-warm p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary/80">
                  <Sparkles className="h-3.5 w-3.5" /> AI report summary
                </span>
                <span
                  className="text-muted-foreground"
                  title={analysis.provider === "groq" ? "Groq" : "Gemini"}
                >
                  {analysis.provider === "groq" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    analysis.riskLevel === "high"
                      ? "bg-risk-high text-risk-high-foreground"
                      : analysis.riskLevel === "medium"
                        ? "bg-risk-medium text-risk-medium-foreground"
                        : "bg-risk-low text-risk-low-foreground"
                  }`}
                >
                  {analysis.riskLevel} risk
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {analysis.findings.length} key markers
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/95">{analysis.summary}</p>
            </Card>
            </motion.div>

            {analysis.savedVitals ? (
              <Card className="flex items-center gap-2 bg-accent-soft/40 p-3">
                <HeartPulse className="h-4 w-4 text-accent" />
                <p className="text-sm">
                  Extracted vitals saved to tracker{analysis.savedVitalId ? ` (ID: ${analysis.savedVitalId})` : ""}.
                </p>
              </Card>
            ) : null}
            {analysis.savedProfile &&
            (analysis.savedProfile.conditions > 0 ||
              analysis.savedProfile.allergies > 0 ||
              analysis.savedProfile.medications > 0 ||
              analysis.savedProfile.notesUpdated) ? (
              <Card className="p-3">
                <p className="text-sm font-medium">Clinical insights saved to your profile</p>
                <p className="text-xs text-muted-foreground">
                  Conditions: {analysis.savedProfile.conditions} · Allergies: {analysis.savedProfile.allergies} ·
                  Medications: {analysis.savedProfile.medications}
                  {analysis.savedProfile.notesUpdated ? " · Notes updated" : ""}
                </p>
              </Card>
            ) : null}

            <div className="space-y-2">
              <h2 className="font-display text-sm font-semibold">Key information</h2>
              <div className="grid gap-2">
                {analysis.findings.length === 0 ? (
                  <Card className="p-3 text-sm text-muted-foreground">
                    No structured values were detected.
                  </Card>
                ) : (
                  analysis.findings.map((f, idx) => (
                    <ValueRow
                      key={`${f.name}-${idx}`}
                      name={f.name}
                      value={f.value}
                      range={f.range || "—"}
                      status={f.status === "borderline" ? "high" : f.status}
                    />
                  ))
                )}
              </div>
            </div>

            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold">What this means</h3>
              <p className="mt-1 text-sm text-foreground/90">{analysis.plainExplanation}</p>
            </Card>

            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold">Recommended next steps</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {analysis.recommendations.length ? (
                  analysis.recommendations.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" />
                      <span>{r}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">No recommendations generated.</li>
                )}
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold">Extracted profile insights</h3>
              <div className="mt-2 space-y-2 text-sm">
                <InsightList title="Conditions" items={analysis.extractedProfile.conditions} />
                <InsightList title="Allergies" items={analysis.extractedProfile.allergies} />
                <InsightList title="Medications" items={analysis.extractedProfile.medications} />
              </div>
              {analysis.extractedProfile.notes ? (
                <p className="mt-2 text-xs text-muted-foreground">{analysis.extractedProfile.notes}</p>
              ) : null}
            </Card>

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
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Ask AI
                </Link>
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetToFreshInput}>
                <FileText className="mr-1.5 h-4 w-4" /> Simplify another
              </Button>
            </div>
          </>
        ) : null}
        <p className="px-2 text-center text-[11px] text-muted-foreground">
          AI guidance only — not diagnosis. Always review critical findings with your clinician.
        </p>
      </div>
    </AppShell>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">None detected</p>
      )}
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
        <p className="text-xs text-muted-foreground">Normal: {range}</p>
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
