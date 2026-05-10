import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

type DailyPoint = { day: string; value: number };
type HourlyPoint = { hour: string; value: number };

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function buildDailySeries(days: number, startDaysAgo = 0): { keys: string[]; points: DailyPoint[] } {
  const now = new Date();
  const keys: string[] = [];
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - (startDaysAgo + i));
    keys.push(ymd(d));
    points.push({ day: shortWeekday(d), value: 0 });
  }
  return { keys, points };
}

function buildHourlySeries(stepHours: number): { keys: string[]; points: HourlyPoint[] } {
  const now = new Date();
  const keys: string[] = [];
  const points: HourlyPoint[] = [];
  for (let i = 24 - stepHours; i >= 0; i -= stepHours) {
    const d = new Date(now);
    d.setHours(now.getHours() - i, 0, 0, 0);
    const key = d.toISOString().slice(0, 13);
    keys.push(key);
    points.push({ hour: key.slice(-2), value: 0 });
  }
  return { keys, points };
}

function percentDelta(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);

    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 23, 0, 0, 0);

    const [
      usersCountRes,
      postsCountRes,
      docsCountRes,
      usersRecentRes,
      symptomRecentRes,
      postRecentRes,
      signupsRowsRes,
      symptomRowsRes,
    ] = await Promise.all([
      gate.supabase.from("profiles").select("*", { count: "exact", head: true }),
      gate.supabase.from("community_posts").select("*", { count: "exact", head: true }),
      gate.supabase.from("rag_documents").select("*", { count: "exact", head: true }),
      gate.supabase
        .from("profiles")
        .select("id")
        .gte("created_at", sevenDaysAgo.toISOString()),
      gate.supabase
        .from("symptom_logs")
        .select("user_id")
        .gte("logged_at", sevenDaysAgo.toISOString()),
      gate.supabase
        .from("community_posts")
        .select("author_id")
        .gte("created_at", sevenDaysAgo.toISOString()),
      gate.supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
      gate.supabase
        .from("symptom_logs")
        .select("logged_at")
        .gte("logged_at", twentyFourHoursAgo.toISOString())
        .order("logged_at", { ascending: true }),
    ]);

    if (usersCountRes.error || postsCountRes.error || docsCountRes.error) {
      console.error("[admin/dashboard] counts", usersCountRes.error ?? postsCountRes.error ?? docsCountRes.error);
      return failJson(500, "Could not load dashboard metrics.");
    }
    if (usersRecentRes.error || symptomRecentRes.error || postRecentRes.error) {
      console.error(
        "[admin/dashboard] active",
        usersRecentRes.error ?? symptomRecentRes.error ?? postRecentRes.error,
      );
      return failJson(500, "Could not load activity metrics.");
    }
    if (signupsRowsRes.error || symptomRowsRes.error) {
      console.error("[admin/dashboard] charts", signupsRowsRes.error ?? symptomRowsRes.error);
      return failJson(500, "Could not load dashboard charts.");
    }

    const activeIds = new Set<string>();
    for (const row of usersRecentRes.data ?? []) activeIds.add(row.id as string);
    for (const row of symptomRecentRes.data ?? []) activeIds.add(row.user_id as string);
    for (const row of postRecentRes.data ?? []) activeIds.add(row.author_id as string);

    const signups = buildDailySeries(7, 0);
    const prevSignups = buildDailySeries(7, 7);
    for (const row of signupsRowsRes.data ?? []) {
      const createdAt = String(row.created_at ?? "");
      const key = createdAt.slice(0, 10);
      const idx = signups.keys.indexOf(key);
      if (idx >= 0) signups.points[idx]!.value += 1;
      const prevIdx = prevSignups.keys.indexOf(key);
      if (prevIdx >= 0) prevSignups.points[prevIdx]!.value += 1;
    }

    const symptomHourly = buildHourlySeries(4);
    for (const row of symptomRowsRes.data ?? []) {
      const loggedAt = String(row.logged_at ?? "");
      const key = loggedAt.slice(0, 13);
      const idx = symptomHourly.keys.indexOf(key);
      if (idx >= 0) symptomHourly.points[idx]!.value += 1;
    }

    const currentSignupTotal = signups.points.reduce((sum, p) => sum + p.value, 0);
    const previousSignupTotal = prevSignups.points.reduce((sum, p) => sum + p.value, 0);

    const [recentProfilesRes, recentPostsRes, recentSymptomsRes] = await Promise.all([
      gate.supabase
        .from("profiles")
        .select("id, display_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      gate.supabase
        .from("community_posts")
        .select("id, title, created_at, author_id, profiles!author_id(display_name, email)")
        .order("created_at", { ascending: false })
        .limit(6),
      gate.supabase
        .from("symptom_logs")
        .select("id, title, logged_at, user_id, profiles!user_id(display_name, email)")
        .order("logged_at", { ascending: false })
        .limit(6),
    ]);

    if (recentProfilesRes.error || recentPostsRes.error || recentSymptomsRes.error) {
      console.error(
        "[admin/dashboard] recent",
        recentProfilesRes.error ?? recentPostsRes.error ?? recentSymptomsRes.error,
      );
      return failJson(500, "Could not load recent activity.");
    }

    const activity = [
      ...(recentProfilesRes.data ?? []).map((r) => ({
        who: (r.display_name as string | null) || (r.email as string | null) || "Member",
        what: "Created an account",
        at: r.created_at as string,
      })),
      ...(recentPostsRes.data ?? []).map((r) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          who:
            (profile?.display_name as string | null) ||
            (profile?.email as string | null) ||
            "Member",
          what: `Posted in Community${r.title ? `: ${String(r.title).slice(0, 32)}` : ""}`,
          at: r.created_at as string,
        };
      }),
      ...(recentSymptomsRes.data ?? []).map((r) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          who:
            (profile?.display_name as string | null) ||
            (profile?.email as string | null) ||
            "Member",
          what: `Logged symptom${r.title ? `: ${String(r.title).slice(0, 32)}` : ""}`,
          at: r.logged_at as string,
        };
      }),
    ]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 8);

    return Response.json({
      totals: {
        users: usersCountRes.count ?? 0,
        activeThisWeek: activeIds.size,
        communityPosts: postsCountRes.count ?? 0,
        ragDocuments: docsCountRes.count ?? 0,
      },
      deltas: {
        signupsWeekOverWeek: percentDelta(currentSignupTotal, previousSignupTotal),
      },
      signupsLast7Days: signups.points,
      symptomVolumeLast24Hours: symptomHourly.points,
      activity,
    });
  } catch (e) {
    return serverErrorJson("admin/dashboard GET", e);
  }
}
