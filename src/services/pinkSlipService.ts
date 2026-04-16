import { AxiosError } from "axios"
import { api } from "../api/client"

function readError(err: unknown, fallback: string): string {
    const e = err as AxiosError<any>
    return String(e?.response?.data?.error ?? fallback)
}

export async function createPinkSlip(params: {
    reason: string
    fromDate: string
    toDate: string
}): Promise<{ ok: boolean; error?: string }> {
    try {
        const response = await api.post("pink-slips", params)
        if (response.data?.success === true) return { ok: true }
        return { ok: false, error: "Unable to create pink slip" }
    } catch (err) {
        return { ok: false, error: readError(err, "Unable to create pink slip") }
    }
}

export async function getMyPinkSlips(): Promise<any[]> {
    try {
        const response = await api.get("pink-slips/me")
        if (response.data?.success !== true) return []
        const data = response.data?.data
        if (Array.isArray(data)) return data
        if (data && Array.isArray(data.pinkSlips)) return data.pinkSlips
        return []
    } catch {
        return []
    }
}

export async function getPendingPinkSlips(): Promise<any[]> {
    try {
        const response = await api.get("pink-slips", { params: { status: "PENDING" } })
        if (response.data?.success !== true) return []
        const data = response.data?.data
        if (Array.isArray(data)) return data
        if (data && Array.isArray(data.pinkSlips)) return data.pinkSlips
        return []
    } catch {
        return []
    }
}

export async function updatePinkSlipStatus(id: string, status: string, remarks?: string): Promise<boolean> {
    try {
        const response = await api.patch(`pink-slips/${id}`, { status, remarks })
        return Boolean(response.data?.success)
    } catch {
        return false
    }
}
