/**
 * Offline scan queue — ported from Flutter scan_service.dart
 * Stores failed scans in AsyncStorage and syncs when network is available.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { AxiosError } from "axios"
import { api } from "../api/client"

const OFFLINE_QUEUE_KEY = "offline_access_scan_queue_v1"

export interface OfflineScanEntry {
    id: string
    qr_token: string
    event_type: string
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
    mock_location: boolean
    queuedAt: string
    failureReason?: string
}

async function readQueue(): Promise<OfflineScanEntry[]> {
    try {
        const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

async function writeQueue(queue: OfflineScanEntry[]): Promise<void> {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

async function sendOfflineAudit(payload: Record<string, any>): Promise<void> {
    try {
        await api.post("scan/offline-sync-audit", payload)
    } catch {
        // Audit should not break scan flow
    }
}

export async function enqueueOfflineScan(params: {
    qrToken: string
    eventType: string
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
    isMockLocation: boolean
    failureReason?: string
}): Promise<void> {
    const queue = await readQueue()
    const entry: OfflineScanEntry = {
        id: `${Date.now()}_${queue.length + 1}`,
        qr_token: params.qrToken,
        event_type: params.eventType.trim().toUpperCase(),
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy,
        timestamp: params.timestamp,
        mock_location: params.isMockLocation,
        queuedAt: new Date().toISOString(),
        failureReason: params.failureReason,
    }

    queue.push(entry)
    await writeQueue(queue)

    await sendOfflineAudit({
        status: "QUEUED",
        qrTokenHash: hashCode(params.qrToken).toString(16),
        eventType: entry.event_type,
        gateLabel: "OfflineQueue",
        deviceTimestamp: entry.timestamp,
        failureReason: params.failureReason,
        payload: { queuedAt: entry.queuedAt },
    })
}

export async function syncOfflineQueue(): Promise<number> {
    const queue = await readQueue()
    if (queue.length === 0) return 0

    const remaining: OfflineScanEntry[] = []
    let syncedCount = 0

    for (const item of queue) {
        try {
            const response = await api.post("access/scan", {
                qr_token: item.qr_token,
                event_type: item.event_type,
                latitude: item.latitude,
                longitude: item.longitude,
                accuracy: item.accuracy,
                timestamp: item.timestamp,
                mock_location: item.mock_location,
            }, { timeout: 10000 })

            syncedCount += 1

            await sendOfflineAudit({
                status: "SYNCED",
                scanEventId: response.data?.data?.scanEventId?.toString(),
                qrTokenHash: hashCode(item.qr_token).toString(16),
                eventType: item.event_type,
                gateLabel: "OfflineQueue",
                deviceTimestamp: item.timestamp,
                syncedAt: new Date().toISOString(),
                payload: { queuedAt: item.queuedAt, offlineId: item.id },
            })
        } catch (err) {
            const e = err as AxiosError<any>
            if (e.response) {
                await sendOfflineAudit({
                    status: "FAILED",
                    qrTokenHash: hashCode(item.qr_token).toString(16),
                    eventType: item.event_type,
                    gateLabel: "OfflineQueue",
                    deviceTimestamp: item.timestamp,
                    failureReason: e.response?.data?.error?.toString() ?? e.message,
                    payload: { queuedAt: item.queuedAt, offlineId: item.id },
                })
            }
            remaining.push(item)
        }
    }

    await writeQueue(remaining)
    return syncedCount
}

export async function getOfflineQueueCount(): Promise<number> {
    const queue = await readQueue()
    return queue.length
}

/** Simple hash code for strings (matches Java/Dart hashCode) */
function hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0 // Convert to 32-bit integer
    }
    return Math.abs(hash)
}
