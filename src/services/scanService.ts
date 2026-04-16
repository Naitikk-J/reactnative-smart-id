import { AxiosError } from "axios"
import { api } from "../api/client"
import { ScanResult, parseScanResult } from "../types/ScanResult"

const SIGNED_TOKEN_REGEX = /^(aq1|eq1|mq1)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const SIGNED_TOKEN_EMBEDDED_REGEX = /(aq1|eq1|mq1)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i

function decodeURIComponentSafe(value: string): string {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function normalizeTokenPrefixCase(token: string): string {
    if (token.length < 4) return token
    const prefix = token.slice(0, 3).toLowerCase()
    if (prefix === "aq1" || prefix === "eq1" || prefix === "mq1") {
        return `${prefix}${token.slice(3)}`
    }
    return token
}

function parseTokenCandidate(candidate: string): string | null {
    const trimmed = candidate.trim().replace(/^["'`\s]+|["'`\s]+$/g, "")
    if (!trimmed) return null

    const normalizedPrefix = normalizeTokenPrefixCase(trimmed)
    if (SIGNED_TOKEN_REGEX.test(normalizedPrefix)) {
        return normalizedPrefix
    }

    const embedded = trimmed.match(SIGNED_TOKEN_EMBEDDED_REGEX)
    if (embedded) {
        return normalizeTokenPrefixCase(embedded[0])
    }

    return null
}

function extractSignedToken(rawValue: string): string {
    const direct = rawValue.trim()

    const directCandidate = parseTokenCandidate(direct)
    if (directCandidate) return directCandidate

    const decodedDirect = decodeURIComponentSafe(direct)
    const decodedCandidate = parseTokenCandidate(decodedDirect)
    if (decodedCandidate) return decodedCandidate

    // Handle payloads like "qr_token=<token>&foo=bar".
    if (decodedDirect.includes("=")) {
        const parts = decodedDirect.split("&")
        for (const part of parts) {
            const pair = part.split("=")
            if (pair.length < 2) continue

            const value = pair.slice(1).join("=")
            const pairCandidate = parseTokenCandidate(value)
            if (pairCandidate) return pairCandidate

            const decodedPairCandidate = parseTokenCandidate(decodeURIComponentSafe(value))
            if (decodedPairCandidate) return decodedPairCandidate
        }
    }

    // Handle payloads like { qr_token: "mq1...." } or { token: "..." }.
    try {
        const parsed = JSON.parse(decodedDirect)
        if (parsed && typeof parsed === "object") {
            const tokenKeys = ["qr_token", "qrToken", "token", "data", "value", "payload"]
            for (const key of tokenKeys) {
                const value = String((parsed as Record<string, unknown>)[key] ?? "")
                const parsedCandidate = parseTokenCandidate(value)
                if (parsedCandidate) return parsedCandidate

                const decodedParsedCandidate = parseTokenCandidate(decodeURIComponentSafe(value))
                if (decodedParsedCandidate) return decodedParsedCandidate
            }
        }
    } catch {
        // Not a JSON payload.
    }

    // Handle QR values wrapped in URL query params or deep links.
    const urlLike = direct.includes("://") || direct.startsWith("exp://") || direct.startsWith("/\/")
    if (urlLike) {
        try {
            const normalizedInput = direct.startsWith("//") ? `https:${direct}` : direct
            const parsed = new URL(normalizedInput)

            const candidates = [
                parsed.searchParams.get("qr_token"),
                parsed.searchParams.get("qrToken"),
                parsed.searchParams.get("token"),
                parsed.searchParams.get("data"),
                parsed.hash.replace(/^#/, ""),
            ]

            for (const value of candidates) {
                const candidate = String(value ?? "")
                const parsedCandidate = parseTokenCandidate(candidate)
                if (parsedCandidate) return parsedCandidate

                const decodedCandidate = parseTokenCandidate(decodeURIComponentSafe(candidate))
                if (decodedCandidate) return decodedCandidate
            }

            const pathSegments = parsed.pathname.split("/").filter(Boolean)
            for (const segment of pathSegments) {
                const candidate = parseTokenCandidate(segment)
                if (candidate) return candidate

                const decodedCandidate = parseTokenCandidate(decodeURIComponentSafe(segment))
                if (decodedCandidate) return decodedCandidate
            }
        } catch {
            // Fall through to regex extraction.
        }
    }

    const embedded = parseTokenCandidate(direct)
    if (embedded) return embedded

    const decodedEmbedded = parseTokenCandidate(decodedDirect)
    if (decodedEmbedded) return decodedEmbedded

    return direct
}

function normalizeScanType(scanType: string): string {
    const normalized = scanType.trim().toUpperCase()
    if (normalized === "ENTRY") return "GATE_ENTRY"
    if (normalized === "EXIT") return "GATE_EXIT"
    return normalized
}

function looksLikeDynamicAccessToken(token: string): boolean {
    const trimmed = token.trim()
    const legacyHex = /^[a-fA-F0-9]{48}$/.test(trimmed)
    const signed = /^aq1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)
    return legacyHex || signed
}

function looksLikeEventToken(token: string): boolean {
    const trimmed = token.trim()
    return /^eq1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)
        || /^mq1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)
}

async function postEventScan(params: {
    qrToken: string
    eventType: string
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
    confirmMeal: boolean
}): Promise<ScanResult> {
    try {
        const response = await api.post("events/scan", {
            qr_token: params.qrToken,
            event_type: params.eventType.trim().toUpperCase(),
            latitude: params.latitude,
            longitude: params.longitude,
            accuracy: params.accuracy,
            timestamp: params.timestamp,
            confirm_meal: params.confirmMeal,
        })
        return parseScanResult(response.data)
    } catch (err) {
        const e = err as AxiosError<any>
        if (e.response?.data) return parseScanResult(e.response.data)
        return {
            success: false,
            result: "NETWORK_ERROR",
            badge: "RED",
            message: "Unable to connect to event scan server",
            meta: {},
        }
    }
}

export async function verifyScan(params: {
    rawToken: string
    scanType: string
    gateId?: string
    lat?: number
    lng?: number
}): Promise<ScanResult> {
    try {
        const response = await api.post("scan/verify", {
            rawToken: params.rawToken,
            scanType: normalizeScanType(params.scanType),
            gateId: params.gateId,
            gpsLat: params.lat,
            gpsLng: params.lng,
        })
        return parseScanResult(response.data)
    } catch (err) {
        const e = err as AxiosError<any>
        if (e.response?.data) return parseScanResult(e.response.data)
        return {
            success: false,
            result: "NETWORK_ERROR",
            badge: "RED",
            message: "Unable to connect to server",
            meta: {},
        }
    }
}

export async function accessScan(params: {
    qrToken: string
    eventType: string
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
    isMockLocation: boolean
    confirmMeal?: boolean
}): Promise<ScanResult> {
    const qrToken = extractSignedToken(params.qrToken)
    const rawToken = params.qrToken.trim()
    const decodedRawToken = decodeURIComponentSafe(rawToken)

    const eventTokenCandidates = Array.from(
        new Set([
            qrToken,
            parseTokenCandidate(rawToken) ?? "",
            parseTokenCandidate(decodedRawToken) ?? "",
        ].filter(Boolean)),
    ).filter(looksLikeEventToken)

    if (__DEV__) {
        const tokenKind = looksLikeEventToken(qrToken)
            ? "event"
            : looksLikeDynamicAccessToken(qrToken)
                ? "access"
                : "unknown"

        if (qrToken !== params.qrToken.trim()) {
            console.log("Normalized QR token payload before scan request")
        }

        console.log(`Scan token classified as ${tokenKind}: ${qrToken.slice(0, 16)}...`)
    }

    if (eventTokenCandidates.length > 0) {
        let lastResult: ScanResult | null = null

        for (const candidate of eventTokenCandidates) {
            const result = await postEventScan({
                qrToken: candidate,
                eventType: params.eventType,
                latitude: params.latitude,
                longitude: params.longitude,
                accuracy: params.accuracy,
                timestamp: params.timestamp,
                confirmMeal: Boolean(params.confirmMeal),
            })

            lastResult = result

            if (__DEV__) {
                console.log(`Event token attempt result: ${result.result}`)
            }

            // If token is accepted (or rejected for reason other than invalid QR), stop retries.
            if (result.result !== "INVALID_EVENT_QR") {
                return result
            }
        }

        if (lastResult) return lastResult
    }

    const normalizedType = normalizeScanType(params.eventType)
    const isDynamic = looksLikeDynamicAccessToken(qrToken)

    try {
        const response = await api.post("access/scan", {
            qr_token: qrToken,
            event_type: params.eventType.trim().toUpperCase(),
            latitude: params.latitude,
            longitude: params.longitude,
            accuracy: params.accuracy,
            timestamp: params.timestamp,
            mock_location: params.isMockLocation,
        })
        return parseScanResult(response.data)
    } catch (err) {
        const e = err as AxiosError<any>
        const statusCode = e.response?.status
        const errorText = String(e.response?.data?.error ?? "").toLowerCase()

        if (statusCode === 404 && errorText.includes("route not found") && isDynamic) {
            return {
                success: false,
                result: "ACCESS_ROUTE_MISSING",
                badge: "RED",
                message: "Server not updated for /api/v1/access/scan.",
                meta: {},
            }
        }

        if (statusCode === 404 && !isDynamic) {
            return verifyScan({
                rawToken: qrToken,
                scanType: normalizedType,
                lat: params.latitude,
                lng: params.longitude,
            })
        }

        if (e.response?.data) return parseScanResult(e.response.data)

        return {
            success: false,
            result: "NETWORK_ERROR",
            badge: "RED",
            message: "Unable to connect to scan server",
            meta: {},
        }
    }
}

export async function confirmEventMeal(params: {
    qrToken: string
    eventType: string
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
}): Promise<ScanResult> {
    return accessScan({
        ...params,
        isMockLocation: false,
        confirmMeal: true,
    })
}

export async function getPersonalLogs(limit = 20): Promise<any[]> {
    try {
        const response = await api.get("scan/me", { params: { limit } })
        if (response.data?.success === true && Array.isArray(response.data?.data)) {
            return response.data.data
        }
        return []
    } catch {
        return []
    }
}

export async function manualExit(studentId: string, gateId: string): Promise<boolean> {
    try {
        const response = await api.post("gates/exit-override", {
            studentId,
            gateId,
            direction: "EXIT",
        })
        return Boolean(response.data?.success)
    } catch {
        return false
    }
}
