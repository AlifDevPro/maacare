"use client";

import { useCallback, useEffect, useState } from "react";

import { format } from "date-fns";
import { Upload, FileText, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Doc = {
  id: string;
  title: string;
  source: string;
  category: string;
  chunks: number;
  updated: string;
};

export default function KnowledgePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formText, setFormText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge/documents", { credentials: "include" });
      const data = (await res.json()) as { documents?: Doc[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load");
      }
      setDocs(data.documents ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load knowledge base");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cats = Array.from(new Set(docs.map((d) => d.category).filter(Boolean)));
  const filtered = docs.filter(
    (d) =>
      (cat === "all" || d.category === cat) && d.title.toLowerCase().includes(q.toLowerCase()),
  );

  async function submitImport() {
    if (!formTitle.trim() || !formText.trim()) {
      toast.error("Title and text are required");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/knowledge/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTitle: formTitle.trim(),
          text: formText,
          source: formSource.trim() || undefined,
          category: formCategory.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; chunkIds?: string[] };
      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }
      toast.success(`Imported ${data.chunkIds?.length ?? 0} chunks`);
      setUploadOpen(false);
      setFormTitle("");
      setFormSource("");
      setFormCategory("");
      setFormText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function removeDoc(id: string) {
    if (!confirm("Delete this document and all its chunks?")) return;
    try {
      const res = await fetch(`/api/admin/knowledge/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      toast.success("Document removed");
      setDocs((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Knowledge base</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? (
              "Loading…"
            ) : (
              <>
                {docs.length} documents · {docs.reduce((s, d) => s + d.chunks, 0)} chunks · Gemini
                embeddings + pgvector
              </>
            )}
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="rounded-full shadow-soft"
          disabled={loading}
        >
          <Upload className="mr-1.5 h-4 w-4" /> Import text
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles…"
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                  Loading documents…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No documents yet. Import clinical guidelines or internal articles as text.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <FileText className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium">{d.title}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{d.source || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.category || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{d.chunks}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.updated
                      ? format(new Date(d.updated), "MMM d, yyyy HH:mm")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      type="button"
                      onClick={() =>
                        toast.info("Edit metadata: add columns or a PATCH route when you need it.")
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      type="button"
                      onClick={() => void removeDoc(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import document text</DialogTitle>
            <DialogDescription>
              Text is split into chunks, embedded with Gemini, and stored in Supabase pgvector for
              RAG. Ideal for guidelines, triage notes, or internal policies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="doc-title">Document title</Label>
              <Input
                id="doc-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Antenatal nutrition — trimester 2"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-source">Source / publisher</Label>
              <Input
                id="doc-source"
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                placeholder="WHO, ACOG, internal…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-category">Category</Label>
              <Input
                id="doc-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Antenatal, Postpartum, Symptoms…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-text">Full text</Label>
              <Textarea
                id="doc-text"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Paste article text here…"
                className="min-h-[220px] font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitImport()} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Embedding…
                </>
              ) : (
                "Import & embed"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
