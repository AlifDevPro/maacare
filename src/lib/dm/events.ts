export const DM_UNREAD_UPDATED_EVENT = "maacare:dm-unread-updated";

export function dispatchDmUnreadUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DM_UNREAD_UPDATED_EVENT));
}
