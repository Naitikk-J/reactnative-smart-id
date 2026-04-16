import { AxiosError } from "axios"
import { api } from "../api/client"

function readError(err: unknown, fallback: string): string {
    const e = err as AxiosError<any>
    return String(e?.response?.data?.error ?? fallback)
}

export async function submitLateReturnRequest(params: {
    eta: string
    reason: string
    latitude: number
    longitude: number
}): Promise<{ ok: boolean; error?: string }> {
    try {
        const response = await api.post("late-return/request", params)
        if (response.data?.success === true) return { ok: true }
        return { ok: false, error: "Unable to submit late return request" }
    } catch (err) {
        return { ok: false, error: readError(err, "Unable to submit late return request") }
    }
}

export async function getMyLateReturnRequests(): Promise<any[]> {
    try {
        const response = await api.get("late-return/me")
        if (response.data?.success === true && Array.isArray(response.data?.data)) {
            return response.data.data
        }
        return []
    } catch {
        return []
    }
}
