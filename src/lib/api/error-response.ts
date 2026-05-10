import { NextResponse } from "next/server";
import type { z } from "zod";

/** Short, non-technical copy for auth and profile flows (toast / UI). */
export const friendlyAuth = {
  signInIncomplete:
    "We couldn't complete sign-in. Please try again in a moment.",
  accountIncomplete:
    "We couldn't finish setting up your account. Please try again in a moment.",
  confirmEmailFirst:
    "Please confirm your email using the link we sent you, then try signing in.",
} as const;

/** First human-readable validation hint from Zod (field name + message). */
export function zodFirstMessage(err: z.ZodError): string {
  const fe = err.flatten().fieldErrors;
  for (const [field, msgs] of Object.entries(fe)) {
    if (msgs?.length) {
      return `${field}: ${msgs[0]}`;
    }
  }
  const form = err.flatten().formErrors;
  if (form.length) return form[0] ?? "Invalid input";
  return err.errors[0]?.message ?? "Invalid input";
}

export function validationJsonResponse(err: z.ZodError) {
  const message = zodFirstMessage(err);
  return NextResponse.json(
    {
      error: "validation_failed",
      message,
      details: err.flatten(),
    },
    { status: 400 },
  );
}

export function failJson(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: "request_failed", message, ...extra }, { status });
}

export function serverErrorJson(context: string, err: unknown): NextResponse {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, err);
  const message =
    process.env.NODE_ENV === "development"
      ? `${context}: ${raw}`
      : "Something went wrong on our side. Please try again in a moment.";
  return NextResponse.json(
    {
      error: "server_error",
      message,
      ...(process.env.NODE_ENV === "development" ? { debug: raw } : {}),
    },
    { status: 500 },
  );
}
