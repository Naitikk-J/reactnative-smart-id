import { AxiosError } from "axios"
import { api } from "../api/client"

export interface ProfileUpdatePayload {
    phone?: string
    fatherName?: string
    bloodGroup?: string
    department?: string
    year?: number | null
    section?: string
    photoUrl?: string
}

export async function updateProfile(
    data: ProfileUpdatePayload,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const payload: Record<string, any> = {}

        if (data.phone !== undefined) payload.phone = data.phone.trim()
        if (data.fatherName !== undefined) payload.fatherName = data.fatherName.trim()
        if (data.bloodGroup !== undefined) payload.bloodGroup = data.bloodGroup.trim()
        if (data.department !== undefined) payload.department = data.department.trim()
        if (data.section !== undefined) payload.section = data.section.trim()
        if (data.photoUrl !== undefined) payload.photoUrl = data.photoUrl.trim()
        if (data.year !== undefined && data.year !== null) payload.year = data.year

        const response = await api.patch("auth/me", payload)

        if (response.data?.success === true) {
            return { ok: true }
        }
        return { ok: false, error: "Unable to update profile" }
    } catch (err) {
        const e = err as AxiosError<any>
        const msg = e.response?.data?.error
        return { ok: false, error: msg ? String(msg) : "Unable to update profile" }
    }
}

export async function getEIdCardData(): Promise<any | null> {
    try {
        const response = await api.get("auth/me")
        if (response.data?.success === true) {
            const data = response.data.data
            const userData = data?.user
            const cardData = data?.card

            if (userData) {
                return {
                    ...userData,
                    ...(cardData ? { cardDetails: cardData } : {}),
                }
            }
        }
        return null
    } catch {
        return null
    }
}

export async function getDynamicQrToken(): Promise<string | null> {
    try {
        const response = await api.get("auth/eid-card/token")
        if (response.data?.success === true) {
            return String(response.data?.data?.token ?? "")
        }
        return null
    } catch {
        return null
    }
}
