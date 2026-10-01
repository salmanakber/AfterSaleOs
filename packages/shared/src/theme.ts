/** Design tokens from AfterSale OS §5B */
export const theme = {
  light: {
    primary: "#4338CA",
    primaryHover: "#3730A3",
    primaryTint: "#EEF2FF",
    accent: "#F59E0B",
    ink: "#0F172A",
    muted: "#64748B",
    border: "#E2E8F0",
    background: "#F8FAFC",
    surface: "#FFFFFF",
  },
  dark: {
    background: "#0B1220",
    surface: "#111A2B",
    border: "#1E293B",
    text: "#E2E8F0",
    primary: "#818CF8",
  },
  status: {
    active: "#16A34A",
    expiring: "#D97706",
    pending: "#0284C7",
    expired: "#64748B",
    rejected: "#DC2626",
  },
} as const;

export type Theme = typeof theme;

/** CSS custom properties for customer-facing pages */
export function themeCssVars(accentOverride?: string): Record<string, string> {
  const accent = accentOverride || theme.light.accent;
  return {
    "--as-primary": theme.light.primary,
    "--as-primary-hover": theme.light.primaryHover,
    "--as-primary-tint": theme.light.primaryTint,
    "--as-accent": accent,
    "--as-ink": theme.light.ink,
    "--as-muted": theme.light.muted,
    "--as-border": theme.light.border,
    "--as-bg": theme.light.background,
    "--as-surface": theme.light.surface,
    "--as-status-active": theme.status.active,
    "--as-status-expiring": theme.status.expiring,
    "--as-status-pending": theme.status.pending,
    "--as-status-expired": theme.status.expired,
    "--as-status-rejected": theme.status.rejected,
  };
}
