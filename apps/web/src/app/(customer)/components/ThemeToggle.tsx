"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aftersale-theme";

export type CustomerTheme = "light" | "dark";

function applyTheme(theme: CustomerTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const theme: CustomerTheme = stored === "dark" ? "dark" : "light";
    applyTheme(theme);
    setReady(true);
  }, []);

  return (
    <div className="as-theme-root" data-ready={ready ? "true" : "false"}>
      {children}
    </div>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<CustomerTheme>("light");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as CustomerTheme | null) ?? "light";
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: CustomerTheme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className="as-theme-toggle as-no-print"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      <span className="as-theme-toggle-track" data-mode={theme}>
        <span className="as-theme-toggle-thumb" />
      </span>
      <span className="as-theme-toggle-label">{theme === "light" ? "Light" : "Dark"}</span>
    </button>
  );
}
