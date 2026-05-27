import type { IntentFamily } from "@/lib/ai/intent";

export const MCP_TOOL_NAMES = [
  "get_user_context",
  "search_medical_knowledge",
  "get_nearby_facilities",
  "create_care_reminder",
  "log_ai_escalation_event",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export type McpRouteId =
  | "chat"
  | "signup_ai_turn"
  | "planner_food"
  | "symptom_log_insight"
  | "nearby_once"
  | "reports_analyze"
  | "postpartum_insights";

export type ToolExecutionTrace = {
  tool: McpToolName;
  ok: boolean;
  readonly: boolean;
  attemptCount: number;
  elapsedMs: number;
  error: string | null;
  timedOut: boolean;
  skipped: boolean;
  skipReason: string | null;
  redactedInput: Record<string, unknown>;
};

export type ToolResultEnvelope<T> = {
  ok: boolean;
  tool: McpToolName;
  data: T | null;
  error: string | null;
  trace: ToolExecutionTrace;
};

export type ToolCallContext = {
  route: McpRouteId;
  intentFamily: IntentFamily;
  userId: string | null;
  sessionName?: string | null;
  allowWrites: boolean;
  consentToken?: string | null;
  nowMs: number;
  maxToolCalls: number;
};

export type McpToolFamily = "profile" | "knowledge" | "facilities" | "planner" | "observability";

