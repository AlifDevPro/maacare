import { serverErrorJson } from "@/lib/api/error-response";
import { runtimeSnapshotToMarkdown } from "@/lib/docs-runtime/exporters";
import { getDocsRuntimeSnapshot } from "@/lib/docs-runtime/snapshot";

export async function GET() {
  try {
    const snapshot = await getDocsRuntimeSnapshot();
    const markdown = runtimeSnapshotToMarkdown(snapshot);
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="maacare-docs.md"',
      },
    });
  } catch (e) {
    return serverErrorJson("docs/export/markdown GET", e);
  }
}

