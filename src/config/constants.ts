export const API_BASE_URL = (
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    "https://smart-id-backend.vercel.app/api/v1"
).replace(/\/+$/, "")

export const STORAGE_KEYS = {
    token: "jwt_token",
    deviceId: "device_installation_id",
    deviceLabel: "device_label",
} as const

export const APP_THEME = {
    // ─── Core Palette ───────────────────────────────────────────
    bg: "#0A0E21",
    bgSecondary: "#111836",
    surfaceDark: "#151B3A",
    card: "#151B3A",

    // ─── Accents ────────────────────────────────────────────────
    accent: "#00D4FF",        // Cyan
    accentPurple: "#7B61FF",  // Purple
    accentPink: "#FF6B9D",    // Pink

    // ─── Glass ──────────────────────────────────────────────────
    glassBg: "rgba(255,255,255,0.06)",
    glassBorder: "rgba(255,255,255,0.12)",
    glassHighlight: "rgba(255,255,255,0.08)",

    // ─── Status ─────────────────────────────────────────────────
    success: "#00E676",
    warning: "#FFB74D",
    danger: "#FF5252",

    // ─── Text ───────────────────────────────────────────────────
    text: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.7)",
    muted: "rgba(255,255,255,0.45)",

    // ─── Legacy/Compat ──────────────────────────────────────────
    border: "rgba(255,255,255,0.12)",
} as const
