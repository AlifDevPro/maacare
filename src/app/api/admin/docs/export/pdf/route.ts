import { serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminSnapshot } from "@/lib/docs-runtime/snapshot";
import { runtimeSnapshotToPdfBytes } from "@/lib/docs-runtime/exporters";

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const snapshot = await getDocsAdminSnapshot();
    const bytes = await runtimeSnapshotToPdfBytes(snapshot);
    const body = new Uint8Array(bytes).buffer;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="maacare-docs-admin.pdf"',
      },
    });
  } catch (e) {
    return serverErrorJson("admin/docs/export/pdf GET", e);
  }
}

