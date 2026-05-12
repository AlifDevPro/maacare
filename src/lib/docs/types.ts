export type ApiDocGroup = "auth" | "core" | "ai" | "community" | "notifications" | "admin" | "misc";

/** Who can successfully call the handler (proxy may still allow wider `/api/auth/*`). */
export type ApiAccess = "public" | "session" | "admin";

export type ApiRouteEntry = {
  methods: string;
  path: string;
  access: ApiAccess;
  group: ApiDocGroup;
  summary: string;
  notes?: string;
};
