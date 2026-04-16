export interface StudentSummary {
    id: string
    name: string
    enrollmentNo: string
    photoUrl?: string
}

export interface ScanResult {
    success: boolean
    result: string
    badge: string
    message?: string
    scanEventId?: string
    student?: StudentSummary
    meta: Record<string, any>
}

export function parseScanResult(payload: any): ScanResult {
    if (!payload || typeof payload !== "object") {
        return {
            success: false,
            result: "PARSE_ERROR",
            badge: "RED",
            message: "Invalid response from server",
            meta: {},
        }
    }

    const success = Boolean(payload.success)
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {}

    return {
        success,
        result: String(data.result ?? (success ? "SUCCESS" : "ERROR")),
        badge: String(data.badge ?? (success ? "GREEN" : "RED")),
        message: String(data.message ?? payload.error ?? "Something went wrong"),
        scanEventId: data.scanEventId != null ? String(data.scanEventId) : undefined,
        student:
            data.student && typeof data.student === "object"
                ? {
                    id: String(data.student.id ?? data.student._id ?? "unknown"),
                    name: String(data.student.fullName ?? data.student.name ?? "Unknown Student"),
                    enrollmentNo: String(data.student.enrollmentNo ?? "N/A"),
                    photoUrl: data.student.photoUrl != null ? String(data.student.photoUrl) : undefined,
                }
                : undefined,
        meta: data,
    }
}
