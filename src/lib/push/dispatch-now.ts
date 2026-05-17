import { processPushQueue } from "@/lib/push/send";

/** Process pending push_queue rows (call after comment/like/DM insert). */
export async function dispatchPushNow(limit = 20): Promise<void> {
  try {
    await processPushQueue(limit);
  } catch (err) {
    console.error("[push] dispatch", err);
  }
}

/** @deprecated Prefer await dispatchPushNow() so the queue runs before the response ends. */
export function dispatchPushSoon(limit = 20): void {
  void dispatchPushNow(limit);
}
