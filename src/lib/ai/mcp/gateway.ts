import { MCP_TOOL_REGISTRY } from "./registry";
import type { McpToolName, ToolCallContext, ToolExecutionTrace, ToolResultEnvelope } from "./types";

const BREAKER_FAIL_THRESHOLD = 3;
const BREAKER_OPEN_MS = 45_000;

const breakerState = new Map<McpToolName, { failures: number; openUntil: number }>();

function redactValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.length > 180) return `${value.slice(0, 180)}…`;
  if (/@/.test(value)) return "[redacted_email]";
  if (/token|secret|password/i.test(value)) return "[redacted_secret]";
  return value;
}

function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(value);
  }
  return out;
}

function canRunTool(tool: McpToolName): { ok: boolean; reason: string | null } {
  const state = breakerState.get(tool);
  if (!state) return { ok: true, reason: null };
  if (state.openUntil > Date.now()) return { ok: false, reason: "Circuit breaker open" };
  return { ok: true, reason: null };
}

function markFailure(tool: McpToolName) {
  const prev = breakerState.get(tool) ?? { failures: 0, openUntil: 0 };
  const failures = prev.failures + 1;
  breakerState.set(tool, {
    failures,
    openUntil: failures >= BREAKER_FAIL_THRESHOLD ? Date.now() + BREAKER_OPEN_MS : 0,
  });
}

function markSuccess(tool: McpToolName) {
  breakerState.set(tool, { failures: 0, openUntil: 0 });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("mcp_tool_timeout")), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  });
}

export async function executeMcpTool(input: {
  name: McpToolName;
  args: Record<string, unknown>;
  ctx: ToolCallContext;
  timeoutMs?: number;
  retryOnce?: boolean;
}): Promise<ToolResultEnvelope<Record<string, unknown>>> {
  const started = Date.now();
  const timeoutMs = Math.max(300, input.timeoutMs ?? 2500);
  const retryOnce = input.retryOnce !== false;
  const def = MCP_TOOL_REGISTRY[input.name];
  const redacted = redactInput(input.args);
  const blocked = canRunTool(input.name);

  const baseTrace: ToolExecutionTrace = {
    tool: input.name,
    ok: false,
    readonly: def.readonly,
    attemptCount: 0,
    elapsedMs: 0,
    error: null,
    timedOut: false,
    skipped: false,
    skipReason: null,
    redactedInput: redacted,
  };

  if (!blocked.ok) {
    return {
      ok: false,
      tool: input.name,
      data: null,
      error: blocked.reason,
      trace: {
        ...baseTrace,
        skipped: true,
        skipReason: blocked.reason,
        elapsedMs: Date.now() - started,
      },
    };
  }

  if (!def.readonly && !input.ctx.allowWrites) {
    return {
      ok: false,
      tool: input.name,
      data: null,
      error: "Write tool denied by consent/policy.",
      trace: {
        ...baseTrace,
        skipped: true,
        skipReason: "Write tool denied by consent/policy.",
        elapsedMs: Date.now() - started,
      },
    };
  }

  const parsed = def.inputSchema.safeParse(input.args);
  if (!parsed.success) {
    return {
      ok: false,
      tool: input.name,
      data: null,
      error: "Invalid tool input.",
      trace: {
        ...baseTrace,
        skipped: true,
        skipReason: "Invalid tool input.",
        elapsedMs: Date.now() - started,
      },
    };
  }

  let attempt = 0;
  let lastError: string | null = null;
  while (attempt < (retryOnce ? 2 : 1)) {
    attempt += 1;
    try {
      const data = await withTimeout(def.handler(parsed.data, input.ctx), timeoutMs);
      const outParsed = def.outputSchema.safeParse(data);
      if (!outParsed.success) throw new Error("mcp_output_schema_invalid");
      markSuccess(input.name);
      return {
        ok: true,
        tool: input.name,
        data: data as Record<string, unknown>,
        error: null,
        trace: {
          ...baseTrace,
          ok: true,
          attemptCount: attempt,
          elapsedMs: Date.now() - started,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      markFailure(input.name);
      if (!retryOnce || attempt >= 2) break;
    }
  }

  return {
    ok: false,
    tool: input.name,
    data: null,
    error: lastError ?? "mcp_tool_failed",
    trace: {
      ...baseTrace,
      attemptCount: Math.max(1, attempt),
      elapsedMs: Date.now() - started,
      timedOut: (lastError ?? "").includes("timeout"),
      error: lastError,
    },
  };
}

export async function executeMcpToolsBatch(input: {
  calls: Array<{ name: McpToolName; args: Record<string, unknown> }>;
  ctx: ToolCallContext;
  timeoutMs?: number;
}): Promise<{ results: ToolResultEnvelope<Record<string, unknown>>[]; traces: ToolExecutionTrace[] }> {
  const capped = input.calls.slice(0, Math.max(0, input.ctx.maxToolCalls));
  const results = await Promise.all(
    capped.map((call) =>
      executeMcpTool({
        name: call.name,
        args: call.args,
        ctx: input.ctx,
        timeoutMs: input.timeoutMs,
      }),
    ),
  );
  return {
    traces: results.map((r) => r.trace),
    results,
  };
}

