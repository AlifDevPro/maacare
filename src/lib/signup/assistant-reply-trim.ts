/**
 * If the model echoed the previous assistant message at the start of the new reply,
 * strip that repeated prefix (conservative: only when overlap is very high).
 */
export function trimEchoOfPreviousAssistant(
  newReply: string,
  previousAssistant: string | undefined,
): string {
  if (!previousAssistant?.trim() || !newReply.trim()) return newReply.trim();
  const prev = previousAssistant.trim();
  const next = newReply.trim();
  const minLen = 48;
  if (prev.length < minLen || next.length < minLen) return newReply.trim();

  const probe = prev.slice(0, Math.min(160, prev.length));
  if (!next.startsWith(probe)) return newReply.trim();

  // If new reply is mostly the old message plus a little, drop the duplicate prefix
  const rest = next.slice(probe.length).trim();
  if (!rest) return newReply.trim();
  return rest;
}
