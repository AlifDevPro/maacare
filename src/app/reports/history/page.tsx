"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, History, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import {
  ReportHistoryCard,
  type ReportHistoryListItem,
} from "@/components/reports/report-history-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReportDocumentType } from "@/lib/reports/parse-analysis";
import { apiErrorMessage } from "@/lib/reports/user-messages";

type DocumentFilter = "all" | "lab" | "prescription" | "imaging";

const FILTER_OPTIONS: { id: DocumentFilter; types: ReportDocumentType[] | null }[] = [
  { id: "all", types: null },
  { id: "lab", types: ["lab"] },
  { id: "prescription", types: ["prescription"] },
  { id: "imaging", types: ["imaging", "clinical_note"] },
];

export default function ReportHistoryPage() {
  const { t } = useTranslation("health");
  const [items, setItems] = useState<ReportHistoryListItem[]>([]);
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState<DocumentFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReports = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q?.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/reports?${params.toString()}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: ReportHistoryListItem[];
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reports_history_load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredItems = useMemo(() => {
    const option = FILTER_OPTIONS.find((f) => f.id === docFilter);
    if (!option?.types) return items;
    return items.filter((item) => option.types!.includes(item.document_type));
  }, [docFilter, items]);

  async function handleDelete(id: string) {
    if (!window.confirm(t("reports_delete_confirm"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reports_delete_error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <AppHeader title={t("reports_history_title")} showBack />
      <div className="space-y-4 px-4 pt-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reports_history_search")}
              className="rounded-xl pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadReports(search);
              }}
            />
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => void loadReports(search)}>
            {t("reports_history_search_button")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setDocFilter(filter.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                docFilter === filter.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`reports_filter_${filter.id}`)}
            </button>
          ))}
        </div>

        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/reports">
            <FileText className="mr-1.5 h-4 w-4" /> {t("reports_simplify_new")}
          </Link>
        </Button>

        {error ? (
          <Card className="border-red-300/60 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
            {error}
          </Card>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-6 text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">{t("reports_history_empty_title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("reports_history_empty_body")}</p>
            <Button asChild className="mt-4 rounded-xl">
              <Link href="/reports">{t("reports_simplify_new")}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((report) => (
              <ReportHistoryCard
                key={report.id}
                report={report}
                deleting={deletingId === report.id}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
