"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

type Theme = "system" | "light" | "dark";
const KEY = "dqt.theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function apply(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // storage unavailable: the choice still applies for this page view
  }
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((fn) => fn());
}

/** Cycles system, light, dark. The saved choice is applied before first paint by the script in layout.tsx. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const label = theme === "system" ? "Theme: system" : theme === "light" ? "Theme: light" : "Theme: dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => apply(next)}
      aria-label={`${label}. Switch to ${next}.`}
      title={`${label} (click for ${next})`}
    >
      <Icon name={theme === "system" ? "auto" : theme === "light" ? "sun" : "moon"} size={17} />
    </button>
  );
}
