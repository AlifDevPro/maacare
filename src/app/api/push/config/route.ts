import { NextResponse } from "next/server";

import {
  getFirebasePublicConfig,
  getFirebaseWebVapidKey,
  isFcmConfigured,
} from "@/lib/push/firebase-config";

export function GET() {
  const firebase = getFirebasePublicConfig();
  const configured = isFcmConfigured();

  return NextResponse.json({
    configured,
    firebase: configured ? firebase : null,
    vapidKey: configured ? getFirebaseWebVapidKey() : null,
  });
}
