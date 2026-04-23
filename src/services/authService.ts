import { AxiosError } from "axios"
import { api } from "../api/client"
import { STORAGE_KEYS } from "../config/constants"
import { User, parseUser } from "../types/User"
import { buildDeviceIdentityPayload } from "../utils/deviceIdentity"
import { clearStorageSafe, deleteSecureValueSafe, readSecureValueSafe, writeSecureValueSafe } from "../utils/secureStorage"

export interface LoginOutcome {
    ok: boolean
    user?: User
    error?: string
}

function readError(err: unknown, fallback: string): string {
    const e = err as AxiosError<any>
    return String(e?.response?.data?.error ?? fallback)
}

export async function login(email: string, password: string): Promise<LoginOutcome> {
    try {
        const devicePayload = await buildDeviceIdentityPayload()
        const response = await api.post("auth/login", {
            email: email.trim().toLowerCase(),
            password,
            ...devicePayload,
        })

        if (response.data?.success !== true) {
            return { ok: false, error: "Invalid response from server" }
        }

        const token = String(response.data?.data?.accessToken ?? "")
        const userRaw = response.data?.data?.user
        if (!token || !userRaw) {
            return { ok: false, error: "Login payload missing" }
        }

        await writeSecureValueSafe(STORAGE_KEYS.token, token)
        const user = parseUser(userRaw)
        return { ok: true, user }
    } catch (err) {
        return { ok: false, error: readError(err, "Login failed") }
    }
}

export async function tryAutoLogin(): Promise<User | null> {
    const token = await readSecureValueSafe(STORAGE_KEYS.token)
    if (!token) return null

    try {
        const response = await api.get("auth/me")
        if (response.data?.success !== true) {
            await logout()
            return null
        }

        return parseUser(response.data?.data?.user)
    } catch {
        await logout()
        return null
    }
}

export async function logout(): Promise<void> {
    try {
        const devicePayload = await buildDeviceIdentityPayload()
        await api.post("auth/logout", devicePayload)
    } catch {
        // local sign-out still continues
    }

    await deleteSecureValueSafe(STORAGE_KEYS.token)
}

export async function submitRebindRequestFromLogin(email: string, reason: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedReason = reason.trim()

    if (!normalizedEmail || !normalizedReason) {
        return "Email and reason are required"
    }

    try {
        const devicePayload = await buildDeviceIdentityPayload()
        const response = await api.post("auth/rebind-request", {
            email: normalizedEmail,
            reason: normalizedReason,
            ...devicePayload,
        })

        if (response.data?.success === true) {
            return null
        }

        return "Unable to submit rebind request"
    } catch (err) {
        return readError(err, "Unable to submit rebind request")
    }
}

export async function googleLogin(idToken: string): Promise<LoginOutcome> {
    try {
        const devicePayload = await buildDeviceIdentityPayload()
        const response = await api.post("auth/google", {
            idToken,
            ...devicePayload,
        })

        if (response.data?.success !== true) {
            return { ok: false, error: "Invalid response from server" }
        }

        const token = String(response.data?.data?.accessToken ?? "")
        const userRaw = response.data?.data?.user
        if (!token || !userRaw) {
            return { ok: false, error: "Google login payload missing" }
        }

        await writeSecureValueSafe(STORAGE_KEYS.token, token)
        const user = parseUser(userRaw)
        return { ok: true, user }
    } catch (err) {
        return { ok: false, error: readError(err, "Google login failed") }
    }
}

export async function hardResetSession(): Promise<void> {
    await clearStorageSafe()
}
