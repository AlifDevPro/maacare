import { z } from "zod";

import { generateTextWithGeminiGroqFailover } from "@/lib/gemini/text-failover";

const appointmentSchema = z.object({
  title: z.string().min(1).max(200),
  scheduledAt: z.string().datetime(),
  providerName: z.string().max(200).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ExtractedAppointment = {
  title: string;
  scheduledAt: string;
  providerName?: string;
  location?: string;
  notes?: string;
};

const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|visit|checkup|check-up|ultrasound|scan|prenatal|obgyn|ob-gyn|doctor visit|ডাক্তার|অ্যাপয়েন্টমেন্ট|সময়|বুক)\b/i;

export function isAppointmentBookingMessage(text: string): boolean {
  return APPOINTMENT_RE.test(text.trim());
}

function normalizeJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

export async function extractAppointmentFromTurn(input: {
  latestUserMessage: string;
  transcriptSnippet?: string | null;
  nowIso: string;
}): Promise<ExtractedAppointment | null> {
  const latest = input.latestUserMessage.trim();
  if (!latest || !isAppointmentBookingMessage(latest)) return null;

  const transcript = (input.transcriptSnippet ?? "").trim().slice(0, 1500);
  const now = new Date(input.nowIso);
  if (Number.isNaN(now.getTime())) return null;

  const systemInstruction = [
    "You extract appointment booking details from a maternal-health chat.",
    "Return strict JSON only with fields:",
    "title: short appointment label (required)",
    "scheduledAt: ISO-8601 datetime with timezone offset (required)",
    "providerName: doctor/clinic name if mentioned (optional)",
    "location: address or clinic name if mentioned (optional)",
    "notes: brief extra context (optional)",
    `Current server time (UTC): ${now.toISOString()}`,
    "Interpret relative dates like tomorrow, next Tuesday, or Bengali equivalents using current server time.",
    "If date or time is missing or ambiguous, return null by setting title to empty string.",
    "Do not invent a time — only extract when the user gave enough to schedule.",
  ].join("\n");

  const userMessage = [
    "LATEST_USER_MESSAGE:",
    latest,
    transcript ? `\nTRANSCRIPT_SNIPPET:\n${transcript}` : "",
  ].join("\n");

  try {
    const out = await generateTextWithGeminiGroqFailover({
      systemInstruction,
      userMessage,
      temperature: 0.1,
    });
    const rawJson = normalizeJsonObject(out.text);
    if (!rawJson) return null;
    const parsed = appointmentSchema.safeParse(JSON.parse(rawJson));
    if (!parsed.success || !parsed.data.title.trim()) return null;

    const scheduled = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
      return null;
    }

    const providerName = parsed.data.providerName?.trim();
    const location = parsed.data.location?.trim();
    const notes = parsed.data.notes?.trim();
    return {
      title: parsed.data.title.trim(),
      scheduledAt: scheduled.toISOString(),
      ...(providerName ? { providerName } : {}),
      ...(location ? { location } : {}),
      ...(notes ? { notes } : {}),
    };
  } catch {
    return null;
  }
}
