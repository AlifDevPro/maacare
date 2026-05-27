import type { IntentFamily } from "@/lib/ai/intent";

import type { McpRouteId, McpToolFamily, McpToolName, ToolCallContext } from "./types";

type PolicyRule = {
  maxToolCalls: number;
  families: McpToolFamily[];
  allowWrites: boolean;
};

const DEFAULT_POLICY: PolicyRule = {
  maxToolCalls: 1,
  families: [],
  allowWrites: false,
};

const ROUTE_POLICY: Record<McpRouteId, Record<IntentFamily, PolicyRule>> = {
  chat: {
    identity: { maxToolCalls: 1, families: ["profile"], allowWrites: false },
    greeting: { maxToolCalls: 1, families: ["profile"], allowWrites: false },
    symptom_guidance: { maxToolCalls: 2, families: ["profile", "knowledge", "observability"], allowWrites: false },
    planning: { maxToolCalls: 2, families: ["profile", "knowledge", "planner"], allowWrites: false },
    nearby_facilities: { maxToolCalls: 2, families: ["facilities"], allowWrites: false },
    report_explanation: { maxToolCalls: 2, families: ["knowledge"], allowWrites: false },
    onboarding: { maxToolCalls: 1, families: [], allowWrites: false },
    smalltalk: { maxToolCalls: 0, families: [], allowWrites: false },
    offtopic: { maxToolCalls: 0, families: [], allowWrites: false },
    general_health: { maxToolCalls: 2, families: ["profile", "knowledge"], allowWrites: false },
    unknown: { maxToolCalls: 0, families: [], allowWrites: false },
  },
  signup_ai_turn: {
    identity: { maxToolCalls: 0, families: [], allowWrites: false },
    greeting: { maxToolCalls: 0, families: [], allowWrites: false },
    symptom_guidance: { maxToolCalls: 0, families: [], allowWrites: false },
    planning: { maxToolCalls: 0, families: [], allowWrites: false },
    nearby_facilities: { maxToolCalls: 0, families: [], allowWrites: false },
    report_explanation: { maxToolCalls: 0, families: [], allowWrites: false },
    onboarding: { maxToolCalls: 0, families: [], allowWrites: false },
    smalltalk: { maxToolCalls: 0, families: [], allowWrites: false },
    offtopic: { maxToolCalls: 0, families: [], allowWrites: false },
    general_health: { maxToolCalls: 0, families: [], allowWrites: false },
    unknown: { maxToolCalls: 0, families: [], allowWrites: false },
  },
  planner_food: {
    identity: { maxToolCalls: 1, families: ["profile"], allowWrites: false },
    greeting: { maxToolCalls: 0, families: [], allowWrites: false },
    symptom_guidance: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    planning: { maxToolCalls: 2, families: ["profile", "knowledge", "planner"], allowWrites: false },
    nearby_facilities: { maxToolCalls: 0, families: [], allowWrites: false },
    report_explanation: { maxToolCalls: 0, families: [], allowWrites: false },
    onboarding: { maxToolCalls: 0, families: [], allowWrites: false },
    smalltalk: { maxToolCalls: 0, families: [], allowWrites: false },
    offtopic: { maxToolCalls: 0, families: [], allowWrites: false },
    general_health: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    unknown: { maxToolCalls: 0, families: [], allowWrites: false },
  },
  symptom_log_insight: {
    identity: { maxToolCalls: 0, families: [], allowWrites: false },
    greeting: { maxToolCalls: 0, families: [], allowWrites: false },
    symptom_guidance: { maxToolCalls: 2, families: ["knowledge", "observability"], allowWrites: false },
    planning: { maxToolCalls: 0, families: [], allowWrites: false },
    nearby_facilities: { maxToolCalls: 0, families: [], allowWrites: false },
    report_explanation: { maxToolCalls: 0, families: [], allowWrites: false },
    onboarding: { maxToolCalls: 0, families: [], allowWrites: false },
    smalltalk: { maxToolCalls: 0, families: [], allowWrites: false },
    offtopic: { maxToolCalls: 0, families: [], allowWrites: false },
    general_health: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    unknown: { maxToolCalls: 0, families: [], allowWrites: false },
  },
  nearby_once: {
    identity: { maxToolCalls: 0, families: [], allowWrites: false },
    greeting: { maxToolCalls: 0, families: [], allowWrites: false },
    symptom_guidance: { maxToolCalls: 0, families: [], allowWrites: false },
    planning: { maxToolCalls: 0, families: [], allowWrites: false },
    nearby_facilities: { maxToolCalls: 1, families: ["facilities"], allowWrites: false },
    report_explanation: { maxToolCalls: 0, families: [], allowWrites: false },
    onboarding: { maxToolCalls: 0, families: [], allowWrites: false },
    smalltalk: { maxToolCalls: 0, families: [], allowWrites: false },
    offtopic: { maxToolCalls: 0, families: [], allowWrites: false },
    general_health: { maxToolCalls: 0, families: [], allowWrites: false },
    unknown: { maxToolCalls: 0, families: [], allowWrites: false },
  },
  reports_analyze: {
    identity: DEFAULT_POLICY,
    greeting: DEFAULT_POLICY,
    symptom_guidance: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    planning: DEFAULT_POLICY,
    nearby_facilities: DEFAULT_POLICY,
    report_explanation: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    onboarding: DEFAULT_POLICY,
    smalltalk: DEFAULT_POLICY,
    offtopic: DEFAULT_POLICY,
    general_health: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    unknown: DEFAULT_POLICY,
  },
  postpartum_insights: {
    identity: DEFAULT_POLICY,
    greeting: DEFAULT_POLICY,
    symptom_guidance: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    planning: { maxToolCalls: 2, families: ["knowledge", "profile"], allowWrites: false },
    nearby_facilities: DEFAULT_POLICY,
    report_explanation: DEFAULT_POLICY,
    onboarding: DEFAULT_POLICY,
    smalltalk: DEFAULT_POLICY,
    offtopic: DEFAULT_POLICY,
    general_health: { maxToolCalls: 1, families: ["knowledge"], allowWrites: false },
    unknown: DEFAULT_POLICY,
  },
};

const TOOL_FAMILY: Record<McpToolName, McpToolFamily> = {
  get_user_context: "profile",
  search_medical_knowledge: "knowledge",
  get_nearby_facilities: "facilities",
  create_care_reminder: "planner",
  log_ai_escalation_event: "observability",
};

function routePolicy(route: McpRouteId, family: IntentFamily): PolicyRule {
  return ROUTE_POLICY[route]?.[family] ?? DEFAULT_POLICY;
}

export function mcpPlanForRoute(input: {
  route: McpRouteId;
  intentFamily: IntentFamily;
  requestedTools: McpToolName[];
  consentToken?: string | null;
}): { allowedTools: McpToolName[]; maxToolCalls: number; allowWrites: boolean; deniedReason: string | null } {
  const rule = routePolicy(input.route, input.intentFamily);
  const consentOk = (input.consentToken ?? "").trim().length >= 8;
  const allowedTools = input.requestedTools.filter((tool) => {
    const fam = TOOL_FAMILY[tool];
    const isWrite = tool === "create_care_reminder" || tool === "log_ai_escalation_event";
    if (!rule.families.includes(fam)) return false;
    if (isWrite && (!rule.allowWrites || !consentOk)) return false;
    return true;
  });
  const deniedReason =
    allowedTools.length === 0 && input.requestedTools.length > 0
      ? "Tool denied by route/intent policy or missing consent token."
      : null;
  return {
    allowedTools: allowedTools.slice(0, Math.max(0, rule.maxToolCalls)),
    maxToolCalls: rule.maxToolCalls,
    allowWrites: rule.allowWrites && consentOk,
    deniedReason,
  };
}

export function buildToolCallContext(input: Omit<ToolCallContext, "nowMs">): ToolCallContext {
  return {
    ...input,
    nowMs: Date.now(),
  };
}

