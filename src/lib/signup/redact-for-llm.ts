const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Mask emails and obvious password lines before sending user text to an LLM. */
export function redactUserTextForLlm(text: string): string {
  const t = text.replace(EMAIL_RE, "[redacted-email]");
  const lines = t.split("\n");
  const out = lines.map((line) => {
    const lower = line.toLowerCase();
    if (
      lower.includes("password:") ||
      lower.includes("password is") ||
      lower.includes("passwd") ||
      /^\s*password\s*[:=]/i.test(line)
    ) {
      return "[redacted-password-line]";
    }
    return line;
  });
  return out.join("\n");
}

export function redactTranscriptForLlm(
  messages: readonly { role: "user" | "assistant"; content: string }[],
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) =>
    m.role === "user" ? { ...m, content: redactUserTextForLlm(m.content) } : { ...m, content: m.content },
  );
}
