/** Dispatched after actions that may create server-side notifications (e.g. community reply). */
export const NOTIFICATIONS_UPDATED_EVENT = "maacare:notifications-updated";

export function dispatchNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  }
}
