import { NextRequest, NextResponse } from "next/server";

import { isFcmConfigured } from "@/lib/push/firebase-config";
import { processPushQueue } from "@/lib/push/send";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

/** Process push_queue — Vercel Cron every minute. */
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFcmConfigured()) {
    return NextResponse.json({ ok: true, configured: false, processed: 0 });
  }

  const result = await processPushQueue(80);
  return NextResponse.json({ ok: true, ...result });
}
