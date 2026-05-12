"use client";

import { useCallback, useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  createdAt: string;
  userId: string | null;
  userLabel: string;
  kind: string;
  message: string;
  context: Record<string, unknown>;
  status: string;
  adminNotes: string | null;
};

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/feedback?${params}`, { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { items?: Row[]; total?: number; message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not load");
      setRows(j.items ?? []);
      setTotal(typeof j.total === "number" ? j.total : 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRow(nextStatus?: string) {
    if (!open) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/feedback/${open.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus ?? open.status,
          adminNotes: notes.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Save failed");
      toast.success("Updated");
      setOpen(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Feedback & errors</h1>
        <p className="text-sm text-muted-foreground">
          Reports from the app (errors, feedback, navigation, support tickets). Total: {total.toLocaleString()}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="triaged">Triaged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => {
                    setOpen(r);
                    setNotes(r.adminNotes ?? "");
                  }}
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-primary">{r.kind}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm">{r.message}</p>
                  <p className="text-[11px] text-muted-foreground">{r.userLabel}</p>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                    {r.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Feedback detail</DialogTitle>
          </DialogHeader>
          {open ? (
            <>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {open.kind} · {open.userLabel}
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-foreground">{open.message}</p>
                <p className="text-xs font-medium text-muted-foreground">Context (JSON)</p>
                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-card p-2 text-[11px]">
                  {JSON.stringify(open.context, null, 2)}
                </pre>
              </div>
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">Admin notes</span>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
              </div>
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={() => void saveRow("triaged")} disabled={saving}>
                  Mark triaged
                </Button>
                <Button type="button" onClick={() => void saveRow("resolved")} disabled={saving}>
                  Mark resolved
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
