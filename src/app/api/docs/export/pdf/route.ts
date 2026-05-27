import { serverErrorJson } from "@/lib/api/error-response";
import { getDocsRuntimeSnapshot } from "@/lib/docs-runtime/snapshot";
import { runtimeSnapshotToPdfBytes } from "@/lib/docs-runtime/exporters";

export async function GET() {
  try {
    const snapshot = await getDocsRuntimeSnapshot();
    const bytes = await runtimeSnapshotToPdfBytes(snapshot);
    const body = new Uint8Array(bytes).buffer;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="maacare-docs.pdf"',
      },
    });
  } catch (e) {
    return serverErrorJson("docs/export/pdf GET", e);
  }
}

