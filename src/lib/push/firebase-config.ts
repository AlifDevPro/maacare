import { hasFirebaseServiceAccountEnv } from "@/lib/push/firebase-service-account";

/** Public Firebase config (safe for client + service worker). */

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    `${projectId}.appspot.com`;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

export function getFirebaseWebVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? null;
}

/** Browser can register for FCM (public keys + VAPID). */
export function isFcmClientConfigured(): boolean {
  return Boolean(getFirebasePublicConfig() && getFirebaseWebVapidKey());
}

/** Server can send pushes (service account). */
export function isFcmConfigured(): boolean {
  return Boolean(isFcmClientConfigured() && hasFirebaseServiceAccountEnv());
}
