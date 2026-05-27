import { z } from "zod";

export const docsSectionTypeSchema = z.enum([
  "pitch",
  "technical",
  "live_matrix",
  "architecture",
  "data_flow",
  "team",
  "changelog",
  "custom",
]);

export const docsSectionStatusSchema = z.enum(["draft", "published"]);

export const docsSectionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  section_type: docsSectionTypeSchema,
  body_md: z.string(),
  body_html: z.string(),
  summary: z.string(),
  status: docsSectionStatusSchema,
  is_visible: z.boolean(),
  sort_order: z.number().int(),
  metadata: z.record(z.any()).default({}),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const docsTeamMemberSchema = z.object({
  id: z.string().uuid(),
  avatar_url: z.string().nullable(),
  avatar_width: z.number().int().nullable().optional(),
  avatar_height: z.number().int().nullable().optional(),
  full_name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email(),
  bio: z.string(),
  display_order: z.number().int(),
  active: z.boolean(),
  metadata: z.record(z.any()).default({}),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const docsPublicationSchema = z.object({
  key: z.literal("primary"),
  enabled: z.boolean(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  duration_minutes: z.number().int().nullable().optional(),
  override_public_window: z.boolean(),
  published_snapshot_id: z.string().uuid().nullable().optional(),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DocsSectionRow = z.infer<typeof docsSectionSchema>;
export type DocsTeamMemberRow = z.infer<typeof docsTeamMemberSchema>;
export type DocsPublicationRow = z.infer<typeof docsPublicationSchema>;

export type DocsWindowState = {
  enabled: boolean;
  nowIso: string;
  startAt: string | null;
  endAt: string | null;
  override: boolean;
  insideWindow: boolean;
  publicVisible: boolean;
};

export type DocsRuntimeSnapshot = {
  publication: DocsWindowState;
  sections: DocsSectionRow[];
  team: DocsTeamMemberRow[];
  generatedAt: string;
};

