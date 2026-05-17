import { NextResponse } from "next/server";

/** Build id for PWA update checks — changes on each deploy. */
export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    "development";

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
