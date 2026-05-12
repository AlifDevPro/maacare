import type { ApiDocGroup, ApiRouteEntry } from "@/lib/docs/types";

/**
 * Canonical HTTP API inventory for Route Handlers under `src/app/api`.
 * Update this file when adding or changing endpoints.
 */
export const API_CATALOG: ApiRouteEntry[] = [
  // Auth (proxy allows unauthenticated calls to `/api/auth/*`; handlers still enforce session where needed.)
  {
    methods: "POST",
    path: "/api/auth/login",
    access: "public",
    group: "auth",
    summary: "Email/password sign-in; sets session cookies.",
  },
  {
    methods: "POST",
    path: "/api/auth/logout",
    access: "public",
    group: "auth",
    summary: "Clear Supabase session cookies.",
  },
  {
    methods: "GET",
    path: "/api/auth/session",
    access: "public",
    group: "auth",
    summary: "Lightweight session probe for the client.",
  },
  {
    methods: "POST",
    path: "/api/auth/email-registered",
    access: "public",
    group: "auth",
    summary: "Check whether an email is already registered (signup UX).",
  },
  {
    methods: "POST",
    path: "/api/auth/update-password",
    access: "public",
    group: "auth",
    summary: "Complete password reset when recovery session is present.",
    notes: "Typically used after magic link / recovery flow.",
  },
  {
    methods: "PATCH",
    path: "/api/auth/me",
    access: "session",
    group: "auth",
    summary: "Update lightweight auth-adjacent profile fields (e.g. UI language).",
  },

  // Core user data
  {
    methods: "GET",
    path: "/api/app/home",
    access: "session",
    group: "core",
    summary: "Aggregated home payload for the signed-in dashboard.",
  },
  {
    methods: "GET, PATCH",
    path: "/api/profile",
    access: "session",
    group: "core",
    summary: "Read or update the user profile row (display, avatar, pregnancy prefs, community flags).",
  },
  {
    methods: "GET, POST",
    path: "/api/vitals",
    access: "session",
    group: "core",
    summary: "List or create vital sign entries.",
  },
  {
    methods: "GET, POST",
    path: "/api/symptoms/log",
    access: "session",
    group: "core",
    summary: "List or create symptom log entries.",
  },
  {
    methods: "GET",
    path: "/api/symptoms/log/[id]",
    access: "session",
    group: "core",
    summary: "Fetch a single symptom log by id.",
  },
  {
    methods: "GET, POST",
    path: "/api/appointments",
    access: "session",
    group: "core",
    summary: "List or create appointments.",
  },
  {
    methods: "GET, PUT",
    path: "/api/planner/daily",
    access: "session",
    group: "core",
    summary: "Read or upsert daily planner entries.",
  },
  {
    methods: "GET",
    path: "/api/planner/food",
    access: "session",
    group: "core",
    summary: "Planner food suggestions or logs for the current context.",
  },

  // AI & reports
  {
    methods: "POST",
    path: "/api/chat",
    access: "session",
    group: "ai",
    summary: "Main chat completion: context assembly, optional RAG, Gemini with Groq failover.",
  },
  {
    methods: "POST",
    path: "/api/chat/nearby-once",
    access: "session",
    group: "ai",
    summary: "One-shot nearby-facilities style completion for chat UX.",
  },
  {
    methods: "POST",
    path: "/api/rag/search",
    access: "session",
    group: "ai",
    summary: "Semantic search over knowledge chunks (embeddings + RPC).",
  },
  {
    methods: "POST",
    path: "/api/rag/ingest",
    access: "admin",
    group: "ai",
    summary: "Ingest a knowledge chunk into RAG tables (admin-only).",
  },
  {
    methods: "POST",
    path: "/api/reports/analyze",
    access: "session",
    group: "ai",
    summary: "Analyze uploaded medical report content with AI.",
  },
  {
    methods: "POST",
    path: "/api/reports/extract-local",
    access: "session",
    group: "ai",
    summary: "Client-side extraction helper endpoint for report pipeline.",
  },

  // Community
  {
    methods: "GET, POST",
    path: "/api/community/posts",
    access: "session",
    group: "community",
    summary: "Feed query (filters, sort) or create a new post.",
  },
  {
    methods: "GET, PATCH, DELETE",
    path: "/api/community/posts/[postId]",
    access: "session",
    group: "community",
    summary: "Read, edit, or soft-delete a post (author or policy-gated).",
  },
  {
    methods: "GET, POST",
    path: "/api/community/posts/[postId]/comments",
    access: "session",
    group: "community",
    summary: "List threaded comments or add a comment/reply.",
  },
  {
    methods: "POST",
    path: "/api/community/posts/[postId]/like",
    access: "session",
    group: "community",
    summary: "Toggle or set like state for the current user.",
  },
  {
    methods: "POST",
    path: "/api/community/posts/[postId]/report",
    access: "session",
    group: "community",
    summary: "Submit a moderation report for a post.",
  },
  {
    methods: "POST",
    path: "/api/community/posts/[postId]/moderate",
    access: "session",
    group: "community",
    summary: "Moderator action on a post (hide/unhide).",
    notes: "Requires moderator capability in app policy.",
  },
  {
    methods: "POST",
    path: "/api/community/posts/[postId]/comments/[commentId]/moderate",
    access: "session",
    group: "community",
    summary: "Moderator action on a single comment.",
  },
  {
    methods: "GET",
    path: "/api/community/members/[userId]",
    access: "session",
    group: "community",
    summary: "Public-safe member card plus optional extended pregnancy fields when allowed.",
  },

  // Notifications
  {
    methods: "GET",
    path: "/api/notifications",
    access: "session",
    group: "notifications",
    summary: "List notifications for the current user.",
  },
  {
    methods: "POST",
    path: "/api/notifications/mark-read",
    access: "session",
    group: "notifications",
    summary: "Mark one or all notifications as read.",
  },

  // Admin
  {
    methods: "GET",
    path: "/api/admin/dashboard",
    access: "admin",
    group: "admin",
    summary: "Aggregate metrics for the admin home.",
  },
  {
    methods: "GET",
    path: "/api/admin/users",
    access: "admin",
    group: "admin",
    summary: "Search or list users for admin operations.",
  },
  {
    methods: "GET, PATCH",
    path: "/api/admin/users/[userId]",
    access: "admin",
    group: "admin",
    summary: "Inspect or update a user record (role, flags, etc.).",
  },
  {
    methods: "POST",
    path: "/api/admin/users/[userId]/ban",
    access: "admin",
    group: "admin",
    summary: "Ban or suspend a user account.",
  },
  {
    methods: "POST",
    path: "/api/admin/users/[userId]/confirm-email",
    access: "admin",
    group: "admin",
    summary: "Admin-triggered email confirmation for a user.",
  },
  {
    methods: "GET",
    path: "/api/admin/feedback",
    access: "admin",
    group: "admin",
    summary: "List submitted app feedback tickets.",
  },
  {
    methods: "PATCH",
    path: "/api/admin/feedback/[id]",
    access: "admin",
    group: "admin",
    summary: "Update feedback status or notes.",
  },
  {
    methods: "GET",
    path: "/api/admin/community/reports",
    access: "admin",
    group: "admin",
    summary: "List community moderation reports.",
  },
  {
    methods: "PATCH",
    path: "/api/admin/community/reports/[reportId]",
    access: "admin",
    group: "admin",
    summary: "Resolve or update a community report.",
  },
  {
    methods: "GET",
    path: "/api/admin/community/posts",
    access: "admin",
    group: "admin",
    summary: "Admin listing of community posts (moderation queue).",
  },
  {
    methods: "PATCH, DELETE",
    path: "/api/admin/community/posts/[postId]",
    access: "admin",
    group: "admin",
    summary: "Force-edit or remove a community post.",
  },
  {
    methods: "GET, POST",
    path: "/api/admin/knowledge/documents",
    access: "admin",
    group: "admin",
    summary: "List or create knowledge documents for RAG.",
  },
  {
    methods: "PATCH, DELETE",
    path: "/api/admin/knowledge/documents/[id]",
    access: "admin",
    group: "admin",
    summary: "Update metadata or delete a knowledge document.",
  },
  {
    methods: "POST",
    path: "/api/admin/knowledge/documents/batch",
    access: "admin",
    group: "admin",
    summary: "Batch operations on knowledge documents.",
  },
  {
    methods: "POST",
    path: "/api/admin/knowledge/documents/delete",
    access: "admin",
    group: "admin",
    summary: "Dedicated delete flow for knowledge documents.",
  },
  {
    methods: "GET, PATCH",
    path: "/api/admin/settings",
    access: "admin",
    group: "admin",
    summary: "Read or update operator-tunable app settings.",
  },

  // Misc
  {
    methods: "POST",
    path: "/api/feedback",
    access: "session",
    group: "misc",
    summary: "Submit in-app product feedback from a signed-in user.",
  },
  {
    methods: "POST",
    path: "/api/facilities/nearby",
    access: "session",
    group: "misc",
    summary: "Nearby facilities lookup for maps-style UX.",
  },
  {
    methods: "POST",
    path: "/api/emergency/hospitals",
    access: "public",
    group: "misc",
    summary: "Bangladesh hospital catalog lookup (structured POST body).",
    notes: "Used by emergency flows; validate body schema in route source.",
  },
];

export function getApiCatalogForGroup(group: "all" | ApiDocGroup): ApiRouteEntry[] {
  if (group === "all") return API_CATALOG;
  return API_CATALOG.filter((e) => e.group === group);
}
