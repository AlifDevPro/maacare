"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, History, Loader2, Search, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/reports/user-messages";

type ReportListItem = {
  id: string;
  title: string;
  input_mode: "file" | "text";
  file_name: string | null;
  is_medical_report: boolean;
  risk_level: string | null;
  summary: string;
  embedding_status: string;
  created_at: string;
};

export default function ReportHistoryPage() {
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [search, setSearch] = useState("");
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
      const data = (await res.json().catch(() => ({}))) as { items?: ReportListItem[]; message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this report from your history? It will no longer be available to the AI assistant.")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(apiErrorMessage(data));
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete report.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Report history" showBack />
      <div className="space-y-4 px-4 pt-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="rounded-xl pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadReports(search);
              }}
            />
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => void loadReports(search)}>
            Search
          </Button>
        </div>

        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/reports">
            <FileText className="mr-1.5 h-4 w-4" /> Simplify a new report
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
        ) : items.length === 0 ? (
          <Card className="p-6 text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No saved reports yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a report and choose &quot;My report&quot; to save it here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((report) => (
              <Card key={report.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/reports/${report.id}`} className="text-sm font-semibold hover:underline">
                      {report.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{report.summary}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {report.file_name ? ` · ${report.file_name}` : ""}
                      {!report.is_medical_report ? " · Not a medical report" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                    disabled={deletingId === report.id}
                    onClick={() => void handleDelete(report.id)}
                    aria-label="Delete report"
                  >
                    {deletingId === report.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
