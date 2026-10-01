"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aftersale-admin-theme";
export type AdminTheme = "light" | "dark";

function applyTheme(theme: AdminTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next: AdminTheme = stored === "dark" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }, []);

  function toggle() {
    const next: AdminTheme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useAdminTheme();
  return (
    <button
      type="button"
      className="sa-theme-toggle"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
    >
      <span className="sa-theme-track" data-mode={theme}>
        <span className="sa-theme-thumb" />
      </span>
      <span>{theme === "light" ? "Light" : "Dark"}</span>
    </button>
  );
}
