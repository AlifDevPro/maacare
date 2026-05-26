type PromptBlock = string | string[] | null | undefined;

export function composeSystemPrompt(...blocks: PromptBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block) continue;
    if (Array.isArray(block)) {
      for (const line of block) {
        const t = line?.trim();
        if (t) lines.push(t);
      }
      continue;
    }
    const t = block.trim();
    if (t) lines.push(t);
  }
  return lines.join("\n");
}
