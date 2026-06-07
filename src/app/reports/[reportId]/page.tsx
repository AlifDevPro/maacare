"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/reports/user-messages";

type Finding = {
  name: string;
  value: string;
  range: string;
  status: "normal" | "low" | "high" | "borderline";
  note: string;
};

type ReportDetail = {
  id: string;
  title: string;
  input_mode: "file" | "text";
  file_name: string | null;
  file_mime: string | null;
  extracted_text: string | null;
  is_medical_report: boolean;
  embedding_status: string;
  created_at: string;
  analysis: {
    isMedicalReport?: boolean;
    summary: string;
    plainExplanation: string;
    riskLevel: "low" | "medium" | "high";
    findings: Finding[];
    recommendations: string[];
  };
};

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = String(params.reportId ?? "");
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { report?: ReportDetail; message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      setReport(data.report ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (reportId) void loadReport();
  }, [loadReport, reportId]);

  async function handleReprocess() {
    setReprocessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/reprocess`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { report?: ReportDetail; message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      if (data.report) setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not re-process report.");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this report permanently?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      window.location.href = "/reports/history";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete report.");
      setDeleting(false);
    }
  }

  const analysis = report?.analysis;

  return (
    <AppShell>
      <AppHeader title={report?.title ?? "Report"} showBack />
      <div className="space-y-4 px-4 pt-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error && !report ? (
          <Card className="p-4 text-sm text-red-700 dark:text-red-200">{error}</Card>
        ) : report && analysis ? (
          <>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">
                Uploaded{" "}
                {new Date(report.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {report.file_name ? ` · ${report.file_name}` : " · Pasted text"}
              </p>
              {report.embedding_status === "ready" ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Bot className="h-3.5 w-3.5" /> Available to your AI assistant
                </p>
              ) : null}
            </Card>

            {error ? (
              <Card className="border-red-300/60 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
                {error}
              </Card>
            ) : null}

            <Card className="p-5">
              {!report.is_medical_report ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Not a medical report
                </span>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed">{analysis.summary}</p>
            </Card>

            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold">What this means</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{analysis.plainExplanation}</p>
            </Card>

            {analysis.findings.length > 0 ? (
              <div className="space-y-2">
                <h2 className="font-display text-sm font-semibold">Important results</h2>
                {analysis.findings.map((f, idx) => (
                  <ValueRow key={`${f.name}-${idx}`} finding={f} />
                ))}
              </div>
            ) : null}

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

            {report.extracted_text ? (
              <Card className="p-4">
                <h3 className="font-display text-sm font-semibold">Original text</h3>
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {report.extracted_text}
                </p>
              </Card>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link
                  href={`/chat?reportContext=${encodeURIComponent(
                    JSON.stringify({
                      title: report.title,
                      reportId: report.id,
                      summary: analysis.summary,
                      plainExplanation: analysis.plainExplanation,
                      findings: analysis.findings,
                      recommendations: analysis.recommendations,
                    }),
                  )}`}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Ask about this report
                </Link>
              </Button>
              {report.extracted_text ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={reprocessing}
                  onClick={() => void handleReprocess()}
                >
                  {reprocessing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  Re-process
                </Button>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Delete report
            </Button>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function ValueRow({ finding }: { finding: Finding }) {
  const status = finding.status === "borderline" ? "high" : finding.status;
  const map = {
    normal: { color: "bg-risk-low text-risk-low-foreground", icon: CheckCircle2, label: "Normal" },
    low: { color: "bg-risk-medium text-risk-medium-foreground", icon: AlertCircle, label: "Low" },
    high: { color: "bg-risk-high text-risk-high-foreground", icon: AlertCircle, label: "High" },
  } as const;
  const s = map[status];
  return (
    <Card className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm font-semibold">{finding.name}</p>
        {finding.range ? (
          <p className="text-xs text-muted-foreground">Typical range: {finding.range}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{finding.value}</span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>
          <s.icon className="h-3 w-3" />
          {s.label}
        </span>
      </div>
    </Card>
  );
}
