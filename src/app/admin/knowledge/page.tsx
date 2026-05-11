"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { format } from "date-fns";
import {
  Upload,
  FileText,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Table2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { adminFormFieldClasses } from "../admin-form-styles";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const SAMPLE_CSV = `title,category,source,section_one,section_two,extra
"Nutrition week 28","Antenatal","Internal guideline","Iron-rich foods…","Hydration tips…","When to call care team…"
"Postpartum mood","Postpartum","WHO","Common feelings…","Support resources…",`;


type Doc = {
  id: string;
  title: string;
  source: string;
  category: string;
  description: string;
  chunks: number;
  updated: string;
};

type DeleteMode = "ids" | "filtered" | "all";

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

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvChunkMode, setCsvChunkMode] = useState<"per_column" | "merge_then_split">("per_column");
  const [csvCategory, setCsvCategory] = useState("");
  const [batchImporting, setBatchImporting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editChunks, setEditChunks] = useState(0);
  const [editTitle, setEditTitle] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>("ids");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

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
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/knowledge/documents", { credentials: "include" });
        const data = (await res.json()) as { documents?: Doc[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        if (active) setDocs(data.documents ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load knowledge base");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cats = useMemo(
    () => Array.from(new Set(docs.map((d) => d.category).filter(Boolean))),
    [docs],
  );

  const filtered = useMemo(
    () =>
      docs.filter(
        (d) =>
          (cat === "all" || d.category === cat) && d.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [docs, cat, q],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  const allOnPageSelected = paginated.length > 0 && paginated.every((d) => selectedIds.includes(d.id));

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

  async function submitCsvBatch() {
    if (!csvFile) {
      toast.error("Choose a CSV file");
      return;
    }
    setBatchImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("chunkMode", csvChunkMode);
      if (csvCategory.trim()) fd.append("category", csvCategory.trim());
      const res = await fetch("/api/admin/knowledge/documents/batch", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        parseErrors?: string[];
        documentsImported?: number;
        chunksImported?: number;
        rowErrors?: string[];
        truncated?: boolean;
        maxDocuments?: number;
      };
      if (!res.ok) {
        const pe = data.parseErrors?.length ? ` ${data.parseErrors.join("; ")}` : "";
        throw new Error((data.error ?? "Batch import failed") + pe);
      }
      const { documentsImported = 0, chunksImported = 0, rowErrors, truncated, maxDocuments } = data;
      if (rowErrors?.length) {
        toast.warning(
          `Imported ${documentsImported} docs (${chunksImported} chunks). ${rowErrors.length} row(s) failed.`,
        );
      } else {
        toast.success(
          `Imported ${documentsImported} document(s), ${chunksImported} chunk(s)${
            truncated ? ` (limit ${maxDocuments} rows per upload)` : ""
          }`,
        );
      }
      setUploadOpen(false);
      setCsvFile(null);
      setCsvCategory("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch import failed");
    } finally {
      setBatchImporting(false);
    }
  }

  function openEdit(d: Doc) {
    setEditDocId(d.id);
    setEditChunks(d.chunks);
    setEditTitle(d.title);
    setEditSource(d.source);
    setEditCategory(d.category);
    setEditDescription(d.description ?? "");
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!editDocId || !editTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/knowledge/documents/${editDocId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          source: editSource.trim(),
          category: editCategory.trim(),
          description: editDescription.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        document?: { title: string; source: string; category: string; description: string; updated: string };
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save");
      }
      const doc = data.document;
      if (doc) {
        setDocs((xs) =>
          xs.map((x) =>
            x.id === editDocId
              ? {
                  ...x,
                  title: doc.title,
                  source: doc.source,
                  category: doc.category,
                  description: doc.description,
                  updated: doc.updated,
                }
              : x,
          ),
        );
      }
      toast.success("Document updated");
      setEditOpen(false);
      setEditDocId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteDialog(mode: DeleteMode, ids: string[] = []) {
    setDeleteMode(mode);
    setDeleteTargetIds(ids);
    setDeletePassword("");
    setDeleteOpen(true);
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function setPageSelection(checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        const merged = new Set([...prev, ...paginated.map((d) => d.id)]);
        return Array.from(merged);
      }
      const pageIds = new Set(paginated.map((d) => d.id));
      return prev.filter((id) => !pageIds.has(id));
    });
  }

  async function confirmDelete() {
    const trimmedPassword = deletePassword.trim();
    if (!trimmedPassword) {
      toast.error("Please enter your admin password");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/knowledge/documents/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: deleteMode,
          ids: deleteTargetIds,
          q,
          category: cat,
          password: trimmedPassword,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string; deleted?: number };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Delete failed");
      }
      const deleted = data.deleted ?? 0;
      toast.success(`Deleted ${deleted} document${deleted === 1 ? "" : "s"}`);
      setSelectedIds([]);
      setDeleteOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
          className="rounded-2xl shadow-soft"
          disabled={loading}
        >
          <Upload className="mr-1.5 h-4 w-4" /> Import
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[min(100%,18rem)] flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search titles…"
              className="h-10 pl-14 pr-3.5"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={cat}
              onValueChange={(v) => {
                setCat(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full min-w-[11rem] rounded-sm sm:w-44">
                <SelectValue placeholder="Category" />
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
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full min-w-[7.5rem] rounded-sm sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-10 rounded-sm"
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-sm"
              disabled={selectedIds.length === 0 || loading}
              onClick={() => openDeleteDialog("ids", selectedIds)}
            >
              Delete selected ({selectedIds.length})
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-sm"
              disabled={filtered.length === 0 || loading}
              onClick={() => openDeleteDialog("filtered")}
            >
              Delete filtered ({filtered.length})
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-sm"
              disabled={docs.length === 0 || loading}
              onClick={() => openDeleteDialog("all")}
            >
              Delete all ({docs.length})
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 pb-3 pt-5">
          <h2 className="font-display text-base font-semibold">Documents</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Filtered {filtered.length} of {docs.length} · scroll the list below
          </p>
        </div>
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain">
          <Table>
            <TableHeader className="sticky top-0 z-10 border-0 bg-card shadow-[inset_0_-1px_0_0_var(--color-border)]">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="w-10 bg-card">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => setPageSelection(Boolean(v))}
                    aria-label="Select all on this page"
                  />
                </TableHead>
                <TableHead className="bg-card">Document</TableHead>
                <TableHead className="bg-card">Source</TableHead>
                <TableHead className="bg-card">Category</TableHead>
                <TableHead className="bg-card">Chunks</TableHead>
                <TableHead className="bg-card">Updated</TableHead>
                <TableHead className="w-28 bg-card text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                    Loading documents…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No documents yet. Import clinical guidelines or internal articles as text.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(d.id)}
                        onCheckedChange={(v) => toggleSelected(d.id, Boolean(v))}
                        aria-label={`Select ${d.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                          <FileText className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-medium leading-snug">{d.title}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {d.source || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.category || "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {d.chunks}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.updated
                        ? format(new Date(d.updated), "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-md"
                        type="button"
                        aria-label={`Edit ${d.title}`}
                        onClick={() => openEdit(d)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-md text-destructive"
                        type="button"
                        onClick={() => openDeleteDialog("ids", [d.id])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-medium text-foreground">{filtered.length}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="tabular-nums text-xs text-muted-foreground">
                Page {safePage} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-sm"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (deleting && !o) return;
          setDeleteOpen(o);
          if (!o) setDeletePassword("");
        }}
      >
        <DialogContent className={cn("sm:max-w-md", adminFormFieldClasses)}>
          <DialogHeader>
            <DialogTitle>Confirm delete with admin password</DialogTitle>
            <DialogDescription>
              {deleteMode === "ids"
                ? `You are deleting ${deleteTargetIds.length} selected document(s) and all related chunks.`
                : deleteMode === "filtered"
                  ? `You are deleting all ${filtered.length} currently filtered document(s) and their chunks.`
                  : `You are deleting all ${docs.length} RAG documents and chunks.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="admin-delete-password">Admin password</Label>
            <Input
              id="admin-delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your account password"
              autoComplete="current-password"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Confirm delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditDocId(null);
        }}
      >
        <DialogContent
          className={cn("sm:max-w-xl", adminFormFieldClasses)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
            <DialogDescription>
              Update listing metadata. Chunk text and embeddings are unchanged ({editChunks} chunk
              {editChunks === 1 ? "" : "s"}).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-source">Source / publisher</Label>
              <Input
                id="edit-source"
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Short note (optional; not used in RAG chunks)"
                className="min-h-[72px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitEdit()} disabled={editSaving}>
              {editSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto sm:max-w-xl",
            adminFormFieldClasses,
          )}
        >
          <DialogHeader>
            <DialogTitle>Import knowledge</DialogTitle>
            <DialogDescription>
              Paste one article, or upload a CSV so each row becomes one document. Variable text
              columns per sheet are supported—any column besides title / category / source is
              treated as content.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">Paste text</TabsTrigger>
              <TabsTrigger value="csv" className="gap-1">
                <Table2 className="h-3.5 w-3.5" /> CSV batch
              </TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="grid gap-3 py-2">
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
              <DialogFooter className="gap-2 sm:gap-0 sm:pt-2">
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
            </TabsContent>
            <TabsContent value="csv" className="grid gap-3 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">CSV format</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  <li>
                    Required: a <strong>title</strong> column (<code>title</code>,{" "}
                    <code>document_title</code>, or <code>name</code>).
                  </li>
                  <li>
                    Optional: <code>category</code>, <code>source</code> (or <code>publisher</code>
                    ).
                  </li>
                  <li>
                    All <strong>other</strong> columns are text fields for that row (any number of
                    columns; empty cells are skipped).
                  </li>
                </ul>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 h-8"
                  onClick={() => {
                    void navigator.clipboard.writeText(SAMPLE_CSV);
                    toast.success("Sample CSV copied");
                  }}
                >
                  Copy sample CSV
                </Button>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="csv-file">CSV file</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                {csvFile ? (
                  <p className="text-xs text-muted-foreground">{csvFile.name}</p>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label>Chunking</Label>
                <Select
                  value={csvChunkMode}
                  onValueChange={(v) => setCsvChunkMode(v as typeof csvChunkMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_column">
                      Each text column → split long cells (~2k chars)
                    </SelectItem>
                    <SelectItem value="merge_then_split">
                      Merge all text columns per row, then split
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="csv-category">Apply one category to all rows (optional)</Label>
                <Input
                  id="csv-category"
                  value={csvCategory}
                  onChange={(e) => setCsvCategory(e.target.value)}
                  placeholder="e.g. nutrition, qna, risk_rules"
                />
                <p className="text-[11px] text-muted-foreground">
                  If filled, this overrides row category values from the CSV.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Large batches call Gemini once per chunk and may take several minutes (max 120 rows
                per upload).
              </p>
              <DialogFooter className="gap-2 sm:gap-0 sm:pt-2">
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitCsvBatch()}
                  disabled={batchImporting || !csvFile}
                >
                  {batchImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                    </>
                  ) : (
                    "Import CSV"
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
