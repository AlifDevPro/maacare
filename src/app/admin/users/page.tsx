"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import {
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { fetchJsonCached, invalidateByPrefix } from "@/lib/client/request-cache";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Role = "user" | "moderator" | "admin";

type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  created_at: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function initials(name: string | null, email: string | null): string {
  const n = (name ?? "").trim();
  if (n)
    return n
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const e = (email ?? "").trim();
  return e ? e[0]!.toUpperCase() : "?";
}

export default function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const offset = (page - 1) * pageSize;
  const rangeStart = rows.length === 0 ? 0 : offset + 1;
  const rangeEnd = offset + rows.length;

  const filterRef = useRef({ debouncedQ, roleFilter, pageSize });

  const loadUsers = useCallback(async () => {
    const prev = filterRef.current;
    const filtersChanged =
      prev.debouncedQ !== debouncedQ ||
      prev.roleFilter !== roleFilter ||
      prev.pageSize !== pageSize;

    if (filtersChanged) {
      filterRef.current = { debouncedQ, roleFilter, pageSize };
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (roleFilter !== "all") params.set("role", roleFilter);

      const qs = params.toString();
      const key = `admin:users?${qs}`;
      const { data: j } = await fetchJsonCached<{
        users?: AdminUserRow[];
        total?: number;
        message?: string;
      }>(key, `/api/admin/users?${qs}`, { credentials: "include" }, 20_000);
      setRows(j.users ?? []);
      setTotal(typeof j.total === "number" ? j.total : j.users?.length ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load users.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, pageSize, roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function setRole(userId: string, role: Role) {
    setPatchingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.status === 503) {
        toast.error(j.message ?? "Set SUPABASE_SERVICE_ROLE_KEY to assign roles from this panel.");
        return;
      }
      if (!res.ok) throw new Error(j.message ?? "Could not update role.");
      invalidateByPrefix("admin:users?");
      toast.success(`Role updated to ${role}`);
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update role.");
    } finally {
      setPatchingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? (
              "Loading…"
            ) : (
              <>
                {total.toLocaleString()} {total === 1 ? "user" : "users"} in directory
                {" · "}
                Roles live in Supabase; promoting admins needs the service role key on the server.
              </>
            )}
          </p>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[min(100%,18rem)] flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="h-10 pl-14 pr-3.5"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 w-full min-w-[11rem] rounded-sm sm:w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 pb-3 pt-5">
          <h2 className="font-display text-base font-semibold">Directory</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading ? "Loading…" : `${total.toLocaleString()} match${total === 1 ? "" : "es"} · scroll below`}
          </p>
        </div>
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain">
          <Table>
            <TableHeader className="sticky top-0 z-10 border-0 bg-card shadow-[inset_0_-1px_0_0_var(--color-border)]">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="bg-card">User</TableHead>
                <TableHead className="bg-card">Role</TableHead>
                <TableHead className="bg-card">Joined</TableHead>
                <TableHead className="w-12 bg-card" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No users match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-2xl">
                          <AvatarFallback className="rounded-2xl bg-primary-soft text-xs font-semibold text-primary">
                            {initials(r.display_name, r.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {r.display_name?.trim() || "Member"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{r.email ?? "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-normal">
                        {r.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-md"
                            disabled={patchingId === r.id}
                          >
                            {patchingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${r.id}`} className="cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" /> Open detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void setRole(r.id, "user")}>
                            Set as user
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void setRole(r.id, "moderator")}>
                            Set as moderator
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void setRole(r.id, "admin")}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> Set as admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!loading && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-medium text-foreground">{total.toLocaleString()}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="tabular-nums text-xs text-muted-foreground">
                Page {page} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
