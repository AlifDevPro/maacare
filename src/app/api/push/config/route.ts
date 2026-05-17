import { NextResponse } from "next/server";

import {
  getFirebasePublicConfig,
  getFirebaseWebVapidKey,
  isFcmClientConfigured,
  isFcmConfigured,
} from "@/lib/push/firebase-config";

export function GET() {
  const firebase = getFirebasePublicConfig();
  const clientReady = isFcmClientConfigured();
  const configured = isFcmConfigured();

  return NextResponse.json({
    configured,
    clientReady,
    firebase: clientReady ? firebase : null,
    vapidKey: clientReady ? getFirebaseWebVapidKey() : null,
  });
}
