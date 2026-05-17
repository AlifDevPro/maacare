import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

import { loadFirebaseServiceAccount } from "@/lib/push/firebase-service-account";

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing[0]) {
    adminApp = existing[0]!;
    return adminApp;
  }

  try {
    adminApp = initializeApp({
      credential: cert(loadFirebaseServiceAccount()),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Firebase Admin init failed: ${msg}. Tip: save the downloaded JSON as firebase-service-account.json and set FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json (add that file to .gitignore).`,
    );
  }

  return adminApp;
}

export function getFcmMessaging(): Messaging {
  getFirebaseAdminApp();
  return getMessaging();
}
