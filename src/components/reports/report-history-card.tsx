"use client";

import Link from "next/link";
import Image from "next/image";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReportDocumentType } from "@/lib/reports/parse-analysis";

export type ReportHistoryListItem = {
  id: string;
  title: string;
  input_mode: "file" | "text";
  file_name: string | null;
  is_medical_report: boolean;
  risk_level: string | null;
  summary: string;
  document_type: ReportDocumentType;
  findings_count: number;
  recommendations_count: number;
  has_file: boolean;
  thumbnail_url?: string | null;
  created_at: string;
};

const RISK_LABEL_KEYS = {
  low: "reports_risk_low",
  medium: "reports_risk_medium",
  high: "reports_risk_high",
} as const;

const DOC_TYPE_KEYS: Record<ReportDocumentType, string> = {
  lab: "reports_doc_type_lab",
  prescription: "reports_doc_type_prescription",
  imaging: "reports_doc_type_imaging",
  clinical_note: "reports_doc_type_clinical_note",
  other: "reports_doc_type_other",
};

type ReportHistoryCardProps = {
  report: ReportHistoryListItem;
  deleting?: boolean;
  onDelete?: (id: string) => void;
  className?: string;
};

export function ReportHistoryCard({ report, deleting, onDelete, className }: ReportHistoryCardProps) {
  const { t } = useTranslation("health");

  const riskKey =
    report.risk_level && report.risk_level in RISK_LABEL_KEYS
      ? RISK_LABEL_KEYS[report.risk_level as keyof typeof RISK_LABEL_KEYS]
      : null;

  const docTypeKey = DOC_TYPE_KEYS[report.document_type] ?? DOC_TYPE_KEYS.other;

  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="flex gap-0">
        <Link
          href={`/reports/${report.id}`}
          className="flex min-w-0 flex-1 gap-3 p-4 transition-colors hover:bg-muted/30"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted/50">
            {report.thumbnail_url ? (
              <Image
                src={report.thumbnail_url}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{report.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t(docTypeKey)}
              </span>
              {report.is_medical_report && riskKey ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    report.risk_level === "high"
                      ? "bg-risk-high text-risk-high-foreground"
                      : report.risk_level === "medium"
                        ? "bg-risk-medium text-risk-medium-foreground"
                        : "bg-risk-low text-risk-low-foreground",
                  )}
                >
                  {t(riskKey)}
                </span>
              ) : null}
              {!report.is_medical_report ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t("reports_not_medical")}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{report.summary}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {new Date(report.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {report.findings_count > 0
                ? ` · ${t("reports_findings_count", { count: report.findings_count })}`
                : ""}
              {report.file_name ? ` · ${report.file_name}` : ""}
            </p>
          </div>
        </Link>

        {onDelete ? (
          <div className="flex shrink-0 items-start border-l border-border/60 p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-red-600"
              disabled={deleting}
              onClick={() => onDelete(report.id)}
              aria-label={t("reports_delete")}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
