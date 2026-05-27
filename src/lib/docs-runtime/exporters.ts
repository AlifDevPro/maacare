import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { DocsRuntimeSnapshot } from "./types";

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function runtimeSnapshotToMarkdown(snapshot: DocsRuntimeSnapshot): string {
  const lines: string[] = [];
  lines.push("# MaaCare Docs Snapshot");
  lines.push("");
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push("");
  for (const section of snapshot.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    const body = section.body_md?.trim() || stripHtml(section.body_html || "");
    lines.push(body || "_No content yet._");
    lines.push("");
  }
  if (snapshot.team.length > 0) {
    lines.push("## Team");
    lines.push("");
    for (const member of snapshot.team) {
      lines.push(`- ${member.full_name} (${member.role}) — ${member.email}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function runtimeSnapshotToPdfBytes(snapshot: DocsRuntimeSnapshot): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 810;
  const lineHeight = 14;
  page.drawText("MaaCare Docs Snapshot", { x: 40, y, size: 16, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
  y -= 22;
  page.drawText(`Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`, {
    x: 40,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 24;

  for (const section of snapshot.sections) {
    if (y < 90) {
      y = 810;
      doc.addPage([595, 842]);
    }
    const current = doc.getPages()[doc.getPageCount() - 1];
    current.drawText(section.title, { x: 40, y, size: 13, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
    const bodyRaw = stripHtml(section.body_html || section.body_md || "");
    const body = bodyRaw.length > 700 ? `${bodyRaw.slice(0, 700)}...` : bodyRaw;
    const chunks = body.match(/.{1,95}(\s|$)/g) ?? [body];
    for (const chunk of chunks) {
      if (y < 72) {
        y = 810;
        doc.addPage([595, 842]);
      }
      const p = doc.getPages()[doc.getPageCount() - 1];
      p.drawText(chunk.trim(), { x: 44, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
    }
    y -= 8;
  }

  return doc.save();
}

