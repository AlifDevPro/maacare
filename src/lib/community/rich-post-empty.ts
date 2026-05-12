/** True when TipTap-style HTML has no visible text (empty paragraphs only). */
export function isRichPostBodyEmpty(html: string): boolean {
  const t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").trim();
  return !t;
}
