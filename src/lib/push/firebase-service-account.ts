import type { ServiceAccount } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ServiceAccountJson = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

function toServiceAccount(json: ServiceAccountJson): ServiceAccount {
  const projectId = json.project_id?.trim();
  const clientEmail = json.client_email?.trim();
  let privateKey = json.private_key;
  if (typeof privateKey === "string") {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing project_id, client_email, or private_key");
  }
  return { projectId, clientEmail, privateKey };
}

function parseJsonText(text: string): ServiceAccount {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Service account JSON is empty");
  }

  const attempts: string[] = [trimmed];

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    attempts.push(trimmed.slice(1, -1));
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as ServiceAccountJson;
      return toServiceAccount(parsed);
    } catch {
      /* try next */
    }
  }

  throw new Error("Could not parse service account JSON");
}

/** True when any server credential source is set. */
export function hasFirebaseServiceAccountEnv(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim(),
  );
}

/**
 * Load Firebase Admin service account from env.
 * Prefer FIREBASE_SERVICE_ACCOUNT_PATH or _JSON_B64 in .env — raw JSON often breaks on Windows.
 */
export function loadFirebaseServiceAccount(): ServiceAccount {
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (pathEnv) {
    const filePath = resolve(process.cwd(), pathEnv);
    return parseJsonText(readFileSync(filePath, "utf8"));
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64?.trim();
  if (b64) {
    return parseJsonText(Buffer.from(b64, "base64").toString("utf8"));
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "Firebase service account not set. Use FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON_B64, or FIREBASE_SERVICE_ACCOUNT_JSON.",
    );
  }

  return parseJsonText(raw);
}
