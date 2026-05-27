import { serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { runtimeSnapshotToMarkdown } from "@/lib/docs-runtime/exporters";
import { getDocsAdminSnapshot } from "@/lib/docs-runtime/snapshot";

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const snapshot = await getDocsAdminSnapshot();
    const markdown = runtimeSnapshotToMarkdown(snapshot);
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="maacare-docs-admin.md"',
      },
    });
  } catch (e) {
    return serverErrorJson("admin/docs/export/markdown GET", e);
  }
}

