import { z } from "zod";

import { buildOneShotNearbyCatalogBlock } from "@/lib/bd-facilities/chat-nearby-context";
import { searchKnowledge } from "@/lib/rag/service";
import { searchUserReports } from "@/lib/reports/rag-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

import type { McpToolName, ToolCallContext } from "./types";

type ToolResult = Record<string, unknown>;
type ToolHandler<I> = (args: I, ctx: ToolCallContext) => Promise<ToolResult>;

export type ToolDefinition<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: McpToolName;
  readonly: boolean;
  inputSchema: I;
  outputSchema: z.ZodTypeAny;
  handler: ToolHandler<z.infer<I>>;
};

const getUserContextSchema = z.object({
  contextScope: z.enum(["basic", "health"]).default("basic"),
  locale: z.string().optional().default("en"),
});

const searchMedicalKnowledgeSchema = z.object({
  query: z.string().min(2).max(1200),
  language: z.string().optional().default("en"),
  audienceType: z.string().optional().default("general"),
  maxResults: z.number().int().min(1).max(12).optional().default(6),
  categories: z.array(z.string()).optional(),
});

const nearbyFacilitiesSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const createCareReminderSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(2).max(140),
  timeIso: z.string().datetime(),
  channel: z.enum(["in_app"]).default("in_app"),
  consentToken: z.string().min(8),
});

const escalationSchema = z.object({
  userId: z.string().uuid(),
  riskLevel: z.enum(["low", "medium", "high"]),
  reason: z.string().min(2).max(500),
  routeContext: z.string().min(1).max(80),
  consentToken: z.string().min(8).optional(),
});

async function getUserContext(
  args: z.infer<typeof getUserContextSchema>,
  ctx: ToolCallContext,
): Promise<ToolResult> {
  if (!ctx.userId) return { user: null, pregnancy: null, vitals: null };
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,display_name,language,primary_use_case")
    .eq("id", ctx.userId)
    .maybeSingle();
  const [pregnancy, vitals] =
    args.contextScope === "health"
      ? await Promise.all([
          supabase
            .from("pregnancy_profiles")
            .select("pregnancy_status,gestational_age_weeks,edd_date")
            .eq("user_id", ctx.userId)
            .maybeSingle()
            .then((r) => r.data ?? null),
          supabase
            .from("vital_signs")
            .select("recorded_at,systolic_bp,diastolic_bp,heart_rate_bpm")
            .eq("user_id", ctx.userId)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then((r) => r.data ?? null),
        ])
      : [null, null];
  return { user: profile ?? null, pregnancy, vitals, locale: args.locale };
}

const searchUserReportsSchema = z.object({
  query: z.string().min(2).max(1200),
  maxResults: z.number().int().min(1).max(10).optional().default(6),
});

async function searchUserReportsTool(
  args: z.infer<typeof searchUserReportsSchema>,
  ctx: ToolCallContext,
): Promise<ToolResult> {
  if (!ctx.userId) return { query: args.query, hits: [] };
  const hits = await searchUserReports(ctx.userId, args.query, { limit: args.maxResults });
  return {
    query: args.query,
    hits: hits.map((h) => ({
      id: h.id,
      reportId: h.reportId,
      reportTitle: h.reportTitle,
      reportDate: h.reportDate,
      score: h.score,
      content: h.content,
    })),
  };
}

async function searchMedicalKnowledge(
  args: z.infer<typeof searchMedicalKnowledgeSchema>,
): Promise<ToolResult> {
  const hits = await searchKnowledge(args.query, {
    limit: args.maxResults,
    categories: args.categories,
  });
  return {
    query: args.query,
    hits: hits.map((h) => ({
      id: h.id,
      title: h.title,
      source: h.source,
      category: h.category,
      score: h.score,
      content: h.content,
    })),
  };
}

async function getNearbyFacilities(
  args: z.infer<typeof nearbyFacilitiesSchema>,
): Promise<ToolResult> {
  const supabase = await createSupabaseServerClient();
  const block = await buildOneShotNearbyCatalogBlock(supabase, args.lat, args.lng);
  return { catalogText: block, latitude: args.lat, longitude: args.lng };
}

async function createCareReminder(args: z.infer<typeof createCareReminderSchema>): Promise<ToolResult> {
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("notifications")
    .insert({
      user_id: args.userId,
      kind: "reminder",
      title: args.title,
      body: `Reminder scheduled for ${new Date(args.timeIso).toLocaleString()}.`,
      metadata: {
        source: "mcp_tool",
        reminderTime: args.timeIso,
        channel: args.channel,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message || "Could not create care reminder.");
  return { reminderId: data?.id ?? null, status: "created" };
}

async function logAiEscalationEvent(args: z.infer<typeof escalationSchema>): Promise<ToolResult> {
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("notifications")
    .insert({
      user_id: args.userId,
      kind: "system",
      title: "MaaCare safety escalation suggestion",
      body: "A high-priority health concern was detected. Please review guidance and contact care support if needed.",
      metadata: {
        source: "mcp_tool",
        escalation: true,
        riskLevel: args.riskLevel,
        reason: args.reason,
        routeContext: args.routeContext,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message || "Could not log escalation event.");
  return { eventId: data?.id ?? null, status: "logged" };
}

export const MCP_TOOL_REGISTRY: Record<McpToolName, ToolDefinition> = {
  get_user_context: {
    name: "get_user_context",
    readonly: true,
    inputSchema: getUserContextSchema,
    outputSchema: z.object({}).passthrough(),
    handler: getUserContext,
  },
  search_medical_knowledge: {
    name: "search_medical_knowledge",
    readonly: true,
    inputSchema: searchMedicalKnowledgeSchema,
    outputSchema: z.object({}).passthrough(),
    handler: searchMedicalKnowledge,
  },
  search_user_reports: {
    name: "search_user_reports",
    readonly: true,
    inputSchema: searchUserReportsSchema,
    outputSchema: z.object({}).passthrough(),
    handler: searchUserReportsTool,
  },
  get_nearby_facilities: {
    name: "get_nearby_facilities",
    readonly: true,
    inputSchema: nearbyFacilitiesSchema,
    outputSchema: z.object({}).passthrough(),
    handler: getNearbyFacilities,
  },
  create_care_reminder: {
    name: "create_care_reminder",
    readonly: false,
    inputSchema: createCareReminderSchema,
    outputSchema: z.object({}).passthrough(),
    handler: createCareReminder,
  },
  log_ai_escalation_event: {
    name: "log_ai_escalation_event",
    readonly: false,
    inputSchema: escalationSchema,
    outputSchema: z.object({}).passthrough(),
    handler: logAiEscalationEvent,
  },
};

