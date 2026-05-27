import { serverErrorJson } from "@/lib/api/error-response";
import { getDocsSearchIndex } from "@/lib/docs-runtime/search-index";

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = normalize(url.searchParams.get("q") ?? "");
    const records = await getDocsSearchIndex();
    if (!query) return Response.json({ results: records.slice(0, 20) });
    const results = records
      .filter((row) => {
        const hay = `${row.title} ${row.summary} ${row.bodyText}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 30);
    return Response.json({ results });
  } catch (e) {
    return serverErrorJson("docs/search GET", e);
  }
}

