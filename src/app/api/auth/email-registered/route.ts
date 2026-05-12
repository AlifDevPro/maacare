import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

/**
 * Returns whether an auth user with this exact email already exists.
 * Uses the GoTrue admin list `filter` (substring on email / display name); we then match email exactly.
 * Requires `SUPABASE_SERVICE_ROLE_KEY`. If missing, returns `unavailable: true` (client skips inline hint).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationJsonResponse(parsed.error);
    }

    const emailLower = parsed.data.email.toLowerCase().trim();
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!base || !key) {
      return NextResponse.json({ unavailable: true as const });
    }

    const url = new URL(`${base}/auth/v1/admin/users`);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "50");
    url.searchParams.set("filter", emailLower);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[auth/email-registered] admin list failed:", res.status);
      return NextResponse.json({ unavailable: true as const });
    }

    const data = (await res.json()) as { users?: { email?: string | null }[] };
    const users = data.users ?? [];
    const registered = users.some((u) => (u.email ?? "").toLowerCase() === emailLower);

    return NextResponse.json({ registered });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return failJson(400, "Request body must be valid JSON.");
    }
    return serverErrorJson("auth/email-registered", err);
  }
}
