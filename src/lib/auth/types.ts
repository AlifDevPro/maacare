export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  language: "en" | "bn";
  /** Public profile photo URL (e.g. Supabase Storage). */
  avatarUrl?: string | null;
};
