import { serverErrorJson } from "@/lib/api/error-response";
import { getDocsLiveMetrics } from "@/lib/docs-runtime/live-matrix";
import { getDocsRuntimeSnapshot } from "@/lib/docs-runtime/snapshot";

export async function GET() {
  try {
    const [snapshot, metrics] = await Promise.all([
      getDocsRuntimeSnapshot(),
      getDocsLiveMetrics(),
    ]);
    return Response.json({ snapshot, metrics });
  } catch (e) {
    return serverErrorJson("docs/runtime GET", e);
  }
}

