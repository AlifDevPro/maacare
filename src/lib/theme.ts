import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "maacare.theme";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem(KEY, theme);
  window.dispatchEvent(new CustomEvent("maacare:theme"));
}

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) || "system";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  useEffect(() => {
    const handler = () => setThemeState(getTheme());
    window.addEventListener("maacare:theme", handler);
    return () => window.removeEventListener("maacare:theme", handler);
  }, []);
  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  };
  return { theme, setTheme };
}
