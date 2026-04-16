import { Platform } from "react-native"
import * as Device from "expo-device"
import { STORAGE_KEYS } from "../config/constants"
import { readSecureValueSafe, writeSecureValueSafe } from "./secureStorage"

function randomToken(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

function platformName(): string {
    if (Platform.OS === "ios") return "IOS"
    if (Platform.OS === "android") return "ANDROID"
    if (Platform.OS === "web") return "WEB"
    return "UNKNOWN"
}

export async function getOrCreateDeviceInstallationId(): Promise<string> {
    const existing = await readSecureValueSafe(STORAGE_KEYS.deviceId)
    if (existing && existing.trim().length > 0) {
        return existing.trim()
    }

    const generated = `MITS-${platformName()}-${Date.now()}-${randomToken(8)}`
    await writeSecureValueSafe(STORAGE_KEYS.deviceId, generated)
    return generated
}

export async function getSavedDeviceLabel(): Promise<string | null> {
    const existing = await readSecureValueSafe(STORAGE_KEYS.deviceLabel)
    if (!existing || existing.trim().length === 0) return null
    return existing.trim()
}

export async function saveDeviceLabel(label: string): Promise<void> {
    const normalized = label.trim()
    if (!normalized) return
    await writeSecureValueSafe(STORAGE_KEYS.deviceLabel, normalized)
}

export async function buildDeviceIdentityPayload(): Promise<Record<string, string>> {
    const deviceId = await getOrCreateDeviceInstallationId()
    const savedLabel = await getSavedDeviceLabel()
    const defaultLabel = Device.modelName ? `${Device.modelName}` : `${platformName()} Device`

    return {
        deviceId,
        deviceLabel: savedLabel ?? defaultLabel,
        devicePlatform: platformName(),
    }
}
