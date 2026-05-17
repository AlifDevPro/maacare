/** Session / client auth user (same shape as API `/api/auth/session`). */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  language: "en" | "bn";
  avatarUrl?: string | null;
  isTeamDeveloper?: boolean;
};

/** @deprecated Use AuthUser */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  language: "en" | "bn";
  /** Public profile photo URL (e.g. Supabase Storage). */
  avatarUrl?: string | null;
  /** True when this account has a developer_team_profiles row (team portal + optional landing card when published). */
  isTeamDeveloper?: boolean;
};
