"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { CalendarPlus, Clock3, Loader2, MapPin, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppointmentListItem } from "@/lib/app/user-lists-data";

export function AppointmentsPageClient({ initialItems }: { initialItems: AppointmentListItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<AppointmentListItem[]>(initialItems);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [providerName, setProviderName] = useState("");
  const [location, setLocation] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const upcoming = useMemo(
    () => items.filter((a) => new Date(a.scheduledAt).getTime() >= Date.now()),
    [items],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) {
      toast.error("Title and date/time are required");
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(scheduledAt).toISOString();
      const res = await fetch("/api/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scheduledAt: iso,
          providerName: providerName.trim() || undefined,
          location: location.trim() || undefined,
          appointmentType: appointmentType.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { appointment?: AppointmentListItem; message?: string };
      if (!res.ok || !j.appointment) throw new Error(j.message ?? "Could not add appointment");
      toast.success("Appointment added");
      setItems((prev) =>
        [...prev, j.appointment!].sort(
          (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
        ),
      );
      startTransition(() => router.refresh());
      setTitle("");
      setScheduledAt("");
      setProviderName("");
      setLocation("");
      setAppointmentType("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add appointment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Appointments" showBack showNotifications />
      <div className="space-y-4 px-4 pt-4">
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold">Add appointment</h2>
          </div>
          <form className="grid gap-2.5" onSubmit={(e) => void submit(e)}>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ANC follow-up" />
            </div>
            <div>
              <Label htmlFor="scheduled">Date & time</Label>
              <Input id="scheduled" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Dr. Rahman" />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Input id="type" value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} placeholder="Consultation" />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City Hospital" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[70px]" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save appointment
            </Button>
          </form>
        </Card>

        <Card className="p-4 shadow-soft">
          <h2 className="mb-2 font-display text-sm font-semibold">Upcoming</h2>
          {isPending ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((a) => (
                <div key={a.id} className="rounded-xl border border-border/60 p-2.5">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {format(new Date(a.scheduledAt), "MMM d, yyyy · hh:mm a")}
                    </span>
                    {a.providerName ? (
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {a.providerName}
                      </span>
                    ) : null}
                    {a.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {a.location}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

