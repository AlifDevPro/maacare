"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import {
  Activity,
  Apple,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  Droplets,
  Loader2,
  Moon,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type PlannerAppt = {
  id: string;
  title: string;
  scheduledAt: string;
  providerName: string | null;
  location: string | null;
};

type PlannerSymptom = {
  id: string;
  loggedAt: string;
  title: string | null;
  severity: number | null;
  symptomCodes: string[];
};

type PlannerHistory = {
  date: string;
  completionPercent: number;
  waterGlasses: number;
};

type MealSuggestion = {
  label: "Breakfast" | "Lunch" | "Dinner";
  body: string;
  tag: string;
};

const BASE_TASKS: Array<{ id: string; label: string; href?: string }> = [
  { id: "movement", label: "10 min gentle walk or yoga", href: "/guidance/movement" },
  { id: "water", label: "Start day with a glass of water" },
  { id: "vitamin", label: "Take prenatal vitamin" },
  { id: "meal-plan", label: "Follow meal plan for today" },
];

export default function PlannerPage() {
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<PlannerAppt[]>([]);
  const [symptoms, setSymptoms] = useState<PlannerSymptom[]>([]);
  const [glasses, setGlasses] = useState(0);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState({ water: true, meals: true, walk: false });
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<PlannerHistory[]>([]);
  const [meals, setMeals] = useState<MealSuggestion[]>([
    { label: "Breakfast", body: "Oats with banana, almonds, milk", tag: "Iron · Calcium" },
    { label: "Lunch", body: "Brown rice, lentils, spinach, fish curry", tag: "Protein · Iron" },
    { label: "Dinner", body: "Chapati, mixed vegetables, yogurt", tag: "Calcium · Fiber" },
  ]);
  const [plannerLoaded, setPlannerLoaded] = useState(false);
  const [mealPlanSource, setMealPlanSource] = useState<string>("");
  const dayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let alive = true;
    async function loadPlannerForDay() {
      try {
        const res = await fetch(`/api/planner/daily?date=${encodeURIComponent(dayKey)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as {
          entry?: {
            waterGlasses?: number;
            tasks?: Record<string, boolean>;
            reminders?: { water?: boolean; meals?: boolean; walk?: boolean } | null;
            completed?: boolean;
          } | null;
          history?: PlannerHistory[];
        };
        if (!alive) return;
        const entry = json.entry;
        setGlasses(typeof entry?.waterGlasses === "number" ? Math.max(0, Math.min(8, entry.waterGlasses)) : 0);
        setDoneTasks(entry?.tasks ?? {});
        setReminders({
          water: entry?.reminders?.water ?? true,
          meals: entry?.reminders?.meals ?? true,
          walk: entry?.reminders?.walk ?? false,
        });
        setDone(entry?.completed ?? false);
        setHistory(Array.isArray(json.history) ? json.history : []);
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Could not load planner progress");
      } finally {
        if (alive) setPlannerLoaded(true);
      }
    }
    void loadPlannerForDay();
    return () => {
      alive = false;
    };
  }, [dayKey]);

  const completion = useMemo(() => {
    const baseDone = BASE_TASKS.filter((t) => doneTasks[t.id]).length;
    const hydrationDone = glasses >= 8 ? 1 : 0;
    const total = BASE_TASKS.length + 1;
    return Math.round(((baseDone + hydrationDone) / total) * 100);
  }, [doneTasks, glasses]);

  useEffect(() => {
    if (!plannerLoaded) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void fetch("/api/planner/daily", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          date: dayKey,
          waterGlasses: glasses,
          tasks: doneTasks,
          reminders,
          completed: done,
          completionPercent: completion,
        }),
      }).catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [plannerLoaded, dayKey, glasses, doneTasks, reminders, done, completion]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [homeRes, apptRes, symptomRes] = await Promise.all([
          fetch("/api/app/home", { credentials: "include", cache: "no-store" }),
          fetch("/api/appointments?status=scheduled&limit=10", { credentials: "include" }),
          fetch("/api/symptoms/log?limit=6", { credentials: "include" }),
        ]);
        const homeJson = (await homeRes.json().catch(() => ({}))) as {
          pregnancy?: { gestationalWeek?: number | null };
        };
        const apptJson = (await apptRes.json().catch(() => ({}))) as { appointments?: PlannerAppt[] };
        const symptomJson = (await symptomRes.json().catch(() => ({}))) as { logs?: PlannerSymptom[] };
        if (!alive) return;
        setWeek(
          typeof homeJson.pregnancy?.gestationalWeek === "number"
            ? homeJson.pregnancy.gestationalWeek
            : null,
        );
        setAppointments(apptJson.appointments ?? []);
        setSymptoms(symptomJson.logs ?? []);

        const gw =
          typeof homeJson.pregnancy?.gestationalWeek === "number"
            ? homeJson.pregnancy.gestationalWeek
            : null;
        const foodRes = await fetch(
          gw
            ? `/api/planner/food?week=${encodeURIComponent(String(Math.round(gw)))}`
            : "/api/planner/food",
          { credentials: "include" },
        );
        const foodJson = (await foodRes.json().catch(() => ({}))) as { meals?: MealSuggestion[]; source?: string };
        if (alive && Array.isArray(foodJson.meals) && foodJson.meals.length === 3) {
          setMeals(foodJson.meals);
          setMealPlanSource(typeof foodJson.source === "string" ? foodJson.source : "");
        }
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Could not load planner data");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  function toggleTask(id: string) {
    setDoneTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <AppShell>
      <AppHeader title="Your daily care plan" showBack showNotifications />

      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Today{week ? ` · Week ${week}` : ""}
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-balance">
            Personalized daily planner
          </h1>
        </div>

        <Card className="p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Daily progress</p>
            <span className="text-xs font-semibold text-primary">{completion}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
        </Card>

        <PlanCard icon={Sun} tone="rose" title="Morning routine">
          {BASE_TASKS.map((task) => (
            <Item
              key={task.id}
              label={task.label}
              done={!!doneTasks[task.id]}
              onToggle={() => toggleTask(task.id)}
            >
              {task.href ? (
                <Link href={task.href} className="text-xs text-primary">
                  Why
                </Link>
              ) : null}
            </Item>
          ))}
        </PlanCard>

        <PlanCard icon={Check} tone="sage" title="Last 7 days progress">
          <div className="space-y-1.5">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No planner history yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.date} className="flex items-center justify-between rounded-sm bg-muted/60 px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">{h.date}</span>
                  <span className="text-xs font-semibold text-foreground">{h.completionPercent}%</span>
                </div>
              ))
            )}
          </div>
        </PlanCard>

        <PlanCard
          icon={Apple}
          tone="sage"
          title="Nutrition plan"
          trailing={
            mealPlanSource === "food-rag" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-soft/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                AI
              </span>
            ) : null
          }
        >
          <div className="space-y-2.5">
            {meals.map((m) => (
              <Meal key={m.label} label={m.label} body={m.body} tag={m.tag} />
            ))}
          </div>
        </PlanCard>

        <PlanCard icon={Droplets} tone="rose" title="Hydration tracker">
          <div className="mb-2 flex items-end justify-between">
            <p className="text-2xl font-semibold">
              {glasses}
              <span className="text-base font-medium text-muted-foreground"> / 8</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGlasses((g) => Math.min(8, g + 1))}
              className="rounded-sm"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Glass
            </Button>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setGlasses(i + 1)}
                className={cn(
                  "h-8 rounded-sm border transition-all",
                  i < glasses ? "border-accent bg-accent/80" : "border-border bg-muted",
                )}
                aria-label={`Glass ${i + 1}`}
              />
            ))}
          </div>
        </PlanCard>

        <PlanCard icon={CalendarClock} tone="sage" title="Upcoming appointments">
          {loading ? (
            <div className="flex items-center justify-center py-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-sm border border-border/70 px-3 py-2 text-sm text-muted-foreground">
              No upcoming appointments.
            </div>
          ) : (
            appointments.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-sm border border-border/70 bg-card px-3 py-2">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.scheduledAt).toLocaleString()}</p>
              </div>
            ))
          )}
          <Link href="/appointments" className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            Manage appointments <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </PlanCard>

        <PlanCard icon={Activity} tone="rose" title="Recent symptom checks">
          {loading ? (
            <div className="flex items-center justify-center py-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : symptoms.length === 0 ? (
            <div className="rounded-sm border border-border/70 px-3 py-2 text-sm text-muted-foreground">
              No symptom logs yet.
            </div>
          ) : (
            symptoms.slice(0, 3).map((s) => (
              <Link
                key={s.id}
                href={`/symptoms/result?logId=${encodeURIComponent(s.id)}`}
                className="block rounded-sm border border-border/70 bg-card px-3 py-2"
              >
                <p className="text-sm font-semibold">{s.title || "Symptom check"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.loggedAt).toLocaleString()}
                  {s.severity != null ? ` · Severity ${s.severity}/10` : ""}
                </p>
              </Link>
            ))
          )}
        </PlanCard>

        <PlanCard icon={Moon} tone="sage" title="Rest & reminders">
          <Item label="Aim for 8h sleep tonight" done={false} onToggle={() => undefined} />
          <Item label="20 min nap if tired" done={false} onToggle={() => undefined} />
          <div className="mt-2 space-y-2 border-t border-border pt-2">
            <Toggle
              label="Water reminder"
              icon={Droplets}
              value={reminders.water}
              onChange={(v) => setReminders((r) => ({ ...r, water: v }))}
            />
            <Toggle
              label="Meal reminder"
              icon={Bell}
              value={reminders.meals}
              onChange={(v) => setReminders((r) => ({ ...r, meals: v }))}
            />
            <Toggle
              label="Walk reminder"
              icon={Bell}
              value={reminders.walk}
              onChange={(v) => setReminders((r) => ({ ...r, walk: v }))}
            />
          </div>
        </PlanCard>

        <Button
          size="lg"
          className={cn("w-full rounded-sm", done && "bg-accent text-accent-foreground hover:bg-accent/90")}
          onClick={() => setDone(true)}
        >
          {done ? (
            <>
              <Check className="mr-2 h-5 w-5" /> Completed
            </>
          ) : (
            "Mark as completed"
          )}
        </Button>
      </div>
    </AppShell>
  );
}

function PlanCard({
  icon: Icon,
  tone,
  title,
  children,
  trailing,
}: {
  icon: typeof Sun;
  tone: "rose" | "sage";
  title: string;
  children: React.ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm",
              tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="font-display text-base font-semibold">{title}</h2>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Item({
  label,
  done,
  onToggle,
  children,
}: {
  label: string;
  done: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-sm border border-border transition-colors",
            done && "border-accent bg-accent text-accent-foreground",
          )}
          aria-pressed={done}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : null}
        </button>
        {label}
      </div>
      {children}
    </div>
  );
}

function Meal({ label, body, tag }: { label: string; body: string; tag: string }) {
  return (
    <div className="rounded-sm bg-muted/60 p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="rounded-sm bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{tag}</span>
      </div>
      <p className="mt-0.5 text-sm">{body}</p>
    </div>
  );
}

function Toggle({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: typeof Sun;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
