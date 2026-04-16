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
    bg: "#071226",
    card: "#10203a",
    border: "#20385f",
    text: "#e7edf7",
    muted: "#9bb0d1",
    accent: "#16d6a3",
    warning: "#f7c948",
    danger: "#ef476f",
} as const
