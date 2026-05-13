export const GUEST_LANGUAGE_STORAGE_KEY = "maacare:guest-language";
export const GUEST_LANGUAGE_CHANGED_EVENT = "maacare:guest-language-changed";

export type GuestLanguage = "en" | "bn";

function parseStored(raw: string | null): GuestLanguage | null {
  if (raw === "en" || raw === "bn") return raw;
  return null;
}

export function readGuestLanguage(): GuestLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStored(window.localStorage.getItem(GUEST_LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getGuestLanguageOrDefault(): GuestLanguage {
  return readGuestLanguage() ?? "en";
}

export function writeGuestLanguage(language: GuestLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_LANGUAGE_STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent(GUEST_LANGUAGE_CHANGED_EVENT, { detail: language }));
  } catch {
    /* quota / private mode */
  }
}

export function subscribeGuestLanguage(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === GUEST_LANGUAGE_STORAGE_KEY || e.key === null) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(GUEST_LANGUAGE_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(GUEST_LANGUAGE_CHANGED_EVENT, onCustom);
  };
}
