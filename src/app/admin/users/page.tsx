"use client";
import { useState } from "react";
import Link from "next/link";

import { Search, MoreHorizontal, ShieldCheck, Ban, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Status = "active" | "banned" | "pending";
type Role = "user" | "moderator" | "admin";
interface Row { id: string; name: string; email: string; week: number | null; role: Role; status: Status; joined: string; }

const seed: Row[] = [
  { id: "u1", name: "Nusrat Ahmed", email: "nusrat@example.com", week: 28, role: "user", status: "active", joined: "Apr 12" },
  { id: "u2", name: "Sara Khan", email: "sara@example.com", week: null, role: "user", status: "active", joined: "Apr 10" },
  { id: "u3", name: "Maya Rahman", email: "maya@example.com", week: 14, role: "moderator", status: "active", joined: "Mar 30" },
  { id: "u4", name: "Riya Saha", email: "riya@example.com", week: 22, role: "user", status: "banned", joined: "Mar 22" },
  { id: "u5", name: "Tania Islam", email: "tania@example.com", week: 9, role: "user", status: "pending", joined: "Mar 18" },
  { id: "u6", name: "Dr. Anika Hossain", email: "anika@example.com", week: null, role: "admin", status: "active", joined: "Feb 14" },
];

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>(seed);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  const filtered = rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())),
  );

  const toggleBan = (id: string) => {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, status: r.status === "banned" ? "active" : "banned" } : r));
    toast.success("User status updated");
  };
  const setRole = (id: string, role: Role) => {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, role } : r));
    toast.success(`Role set to ${role}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">{rows.length} total · {rows.filter((r) => r.status === "active").length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="w-64 pl-9" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                        {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.week ? `Week ${r.week}` : "—"}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{r.role}</Badge></TableCell>
                <TableCell>
                  <Badge className={
                    r.status === "active" ? "bg-risk-low text-risk-low-foreground" :
                    r.status === "banned" ? "bg-risk-high text-risk-high-foreground" :
                    "bg-risk-medium text-risk-medium-foreground"
                  }>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.joined}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`Email sent to ${r.email}`)}><Mail className="mr-2 h-4 w-4" /> Send email</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setRole(r.id, "user")}>Set as User</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRole(r.id, "moderator")}>Set as Moderator</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRole(r.id, "admin")}><ShieldCheck className="mr-2 h-4 w-4" /> Set as Admin</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleBan(r.id)} className="text-destructive focus:text-destructive">
                        <Ban className="mr-2 h-4 w-4" /> {r.status === "banned" ? "Unban user" : "Ban user"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
