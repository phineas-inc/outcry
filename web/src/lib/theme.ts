import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "outcry.theme";
const systemTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** Follows the OS until the user picks a theme; the choice is then remembered. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme());
  useEffect(() => {
    if (document.documentElement.dataset.theme) return; // explicit choice made
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => setThemeState(mq.matches ? "light" : "dark");
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setThemeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle };
}
