import { AxiosError } from "axios"
import { api } from "../api/client"

export interface PinkSlip {
    id: string
    ticketId: string
    reason: string
    fromDate: string
    toDate: string
    status: string
    remarks?: string
    approvedBy?: { name: string } | null
    createdAt?: string
}

function parsePinkSlip(raw: any): PinkSlip {
    return {
        id: String(raw?.id ?? raw?._id ?? ""),
        ticketId: String(raw?.ticketId ?? "PS-????"),
        reason: String(raw?.reason ?? ""),
        fromDate: String(raw?.fromDate ?? ""),
        toDate: String(raw?.toDate ?? ""),
        status: String(raw?.status ?? "PENDING").toUpperCase(),
        remarks: raw?.remarks != null ? String(raw.remarks) : undefined,
        approvedBy: raw?.approvedBy ?? null,
        createdAt: raw?.createdAt != null ? String(raw.createdAt) : undefined,
    }
}

export async function getMyPinkSlips(): Promise<PinkSlip[]> {
    try {
        const response = await api.get("pink-slips/me")
        if (response.data?.success === true && Array.isArray(response.data?.data)) {
            return response.data.data.map(parsePinkSlip)
        }
        return []
    } catch {
        return []
    }
}

export async function createPinkSlip(params: {
    reason: string
    fromDate: string
    toDate: string
}): Promise<{ ok: boolean; error?: string }> {
    try {
        const response = await api.post("pink-slips", {
            reason: params.reason,
            fromDate: params.fromDate,
            toDate: params.toDate,
        })

        if (response.data?.success === true) {
            return { ok: true }
        }
        return { ok: false, error: "Failed to submit leave request" }
    } catch (err) {
        const e = err as AxiosError<any>
        const msg = e.response?.data?.error
        return { ok: false, error: msg ? String(msg) : "Failed to submit leave request" }
    }
}
