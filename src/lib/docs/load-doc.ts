import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadDocsMarkdown(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "content", "docs", filename);
  return readFile(filePath, "utf8");
}
