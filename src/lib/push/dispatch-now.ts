import { processPushQueue } from "@/lib/push/send";

/** Fire-and-forget: process pending push_queue rows (after DB triggers enqueue). */
export function dispatchPushSoon(limit = 20): void {
  void processPushQueue(limit).catch((err) => {
    console.error("[push] dispatch", err);
  });
}
