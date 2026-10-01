/** Design tokens from AfterSale OS §5B (standalone copy; package export in @aftersale/shared). */
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
