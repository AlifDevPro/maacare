import { serverErrorJson } from "@/lib/api/error-response";
import { getDocsRuntimeSnapshot } from "@/lib/docs-runtime/snapshot";

export async function GET(req: Request) {
  try {
    const snapshot = await getDocsRuntimeSnapshot();
    const origin = new URL(req.url).origin;
    const shareUrl = `${origin}/docs?snapshot=${encodeURIComponent(snapshot.generatedAt)}`;
    return Response.json({ shareUrl, generatedAt: snapshot.generatedAt });
  } catch (e) {
    return serverErrorJson("docs/share GET", e);
  }
}

