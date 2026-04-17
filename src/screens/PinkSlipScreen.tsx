import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Pressable,
} from "react-native"
import { APP_THEME } from "../config/constants"
import { createPinkSlip, getMyPinkSlips } from "../services/pinkSlipService"

type PinkSlipItem = {
    id?: string
    ticketId?: string
    reason?: string
    fromDate?: string
    toDate?: string
    updatedAt?: string
    remarks?: string
    status?: "APPROVED" | "PENDING" | "REJECTED" | string
}

const APPROVED_PINK = "#FF5FA2"

function hideBackendIds(value?: string): string {
    if (!value) return ""
    return value.replace(/\b[a-fA-F0-9]{24}\b/g, "[hidden]")
}

function formatDateShort(value?: string): string {
    if (!value) return "-"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "-"
    return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short" })
}

function formatDateFull(value?: string): string {
    if (!value) return "-"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "-"
    return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(value?: string): string {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return parsed.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function resolveTicketId(slip: PinkSlipItem): string {
    const existing = String(slip.ticketId ?? "").trim().toUpperCase()
    if (existing) return existing

    const rawId = String(slip.id ?? "").trim().toUpperCase()
    if (!rawId) return "N/A"

    let hash = 0
    for (let i = 0; i < rawId.length; i += 1) {
        hash = (hash * 31 + rawId.charCodeAt(i)) % 10000
    }
    return `PS-${String(hash).padStart(4, "0")}`
}

function statusColor(status: string): string {
    if (status === "APPROVED") return APPROVED_PINK
    if (status === "REJECTED") return APP_THEME.danger
    return APP_THEME.warning
}

export default function PinkSlipScreen() {
    const [items, setItems] = useState<PinkSlipItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [reason, setReason] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [submitLoading, setSubmitLoading] = useState(false)

    const loadItems = useCallback(async () => {
        const slips = await getMyPinkSlips()
        const normalized = slips
            .filter((item) => typeof item === "object" && item !== null)
            .map((item) => ({ ...(item as PinkSlipItem) }))
        setItems(normalized)
    }, [])

    useEffect(() => {
        loadItems().finally(() => setLoading(false))
    }, [loadItems])

    const approvedCount = useMemo(() => items.filter((s) => s.status === "APPROVED").length, [items])
    const pendingCount = useMemo(() => items.filter((s) => s.status === "PENDING").length, [items])
    const rejectedCount = useMemo(() => items.filter((s) => s.status === "REJECTED").length, [items])
    const latestApprovedSlip = useMemo(() => items.find((s) => s.status === "APPROVED") ?? null, [items])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadItems()
        setRefreshing(false)
    }

    const onCreate = async () => {
        if (!reason.trim() || !fromDate.trim() || !toDate.trim()) {
            Alert.alert("Missing fields", "Reason, from date, to date are required")
            return
        }

        const fromIso = new Date(fromDate).toISOString()
        const toIso = new Date(toDate).toISOString()

        if (Number.isNaN(new Date(fromIso).getTime()) || Number.isNaN(new Date(toIso).getTime())) {
            Alert.alert("Invalid date", "Use date format: YYYY-MM-DD")
            return
        }

        setSubmitLoading(true)
        const outcome = await createPinkSlip({ reason: reason.trim(), fromDate: fromIso, toDate: toIso })
        setSubmitLoading(false)

        if (!outcome.ok) {
            Alert.alert("Failed", outcome.error ?? "Unable to create pink slip")
            return
        }

        setReason("")
        setFromDate("")
        setToDate("")
        Alert.alert("Success", "Pink Slip Requested Successfully!")
        await loadItems()
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#4ade80" size="large" />
            </View>
        )
    }

    return (
        <View style={styles.root}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
            >
                <Text style={styles.pageTitle}>Request Leave</Text>
                <Text style={styles.pageSubtitle}>Submit a pink slip request to your warden for approval.</Text>

                <View style={styles.statsRow}>
                    <View style={[styles.statChip, { borderColor: "rgba(255,95,162,0.35)", backgroundColor: "rgba(255,95,162,0.1)" }]}>
                        <Text style={[styles.statCount, { color: APPROVED_PINK }]}>{approvedCount}</Text>
                        <Text style={styles.statLabel}>Approved</Text>
                    </View>
                    <View style={[styles.statChip, { borderColor: "rgba(250,204,21,0.35)", backgroundColor: "rgba(250,204,21,0.1)" }]}>
                        <Text style={[styles.statCount, { color: APP_THEME.warning }]}>{pendingCount}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={[styles.statChip, { borderColor: "rgba(248,113,113,0.35)", backgroundColor: "rgba(248,113,113,0.1)" }]}>
                        <Text style={[styles.statCount, { color: APP_THEME.danger }]}>{rejectedCount}</Text>
                        <Text style={styles.statLabel}>Rejected</Text>
                    </View>
                </View>

                {latestApprovedSlip ? (
                    <View style={styles.ticketCard}>
                        <View style={styles.ticketTopRow}>
                            <Text style={styles.ticketTitle}>Pink Slip Ticket</Text>
                            <View style={styles.ticketActiveChip}>
                                <Text style={styles.ticketActiveText}>ACTIVE</Text>
                            </View>
                        </View>

                        <Text style={styles.ticketId}>Ticket ID: {resolveTicketId(latestApprovedSlip)}</Text>

                        <View style={styles.ticketReasonRow}>
                            <View style={styles.ticketBadgeIcon}>
                                <Text style={styles.ticketBadgeIconText}>✓</Text>
                            </View>
                            <Text style={styles.ticketReason} numberOfLines={2}>
                                {hideBackendIds(latestApprovedSlip.reason?.trim()) || "Approved leave"}
                            </Text>
                        </View>

                        <View style={styles.ticketMetaRow}>
                            <View style={styles.ticketMetaCard}>
                                <Text style={styles.ticketMetaLabel}>VALIDITY</Text>
                                <Text style={styles.ticketMetaValue}>
                                    {formatDateShort(latestApprovedSlip.fromDate)} - {formatDateFull(latestApprovedSlip.toDate)}
                                </Text>
                            </View>
                            <View style={styles.ticketMetaCard}>
                                <Text style={styles.ticketMetaLabel}>STATUS</Text>
                                <Text style={styles.ticketMetaValue}>APPROVED</Text>
                            </View>
                        </View>

                        {hideBackendIds(latestApprovedSlip.remarks?.trim()) ? (
                            <Text style={styles.ticketRemark}>
                                Warden note: {hideBackendIds(latestApprovedSlip.remarks?.trim())}
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                <View style={styles.formCard}>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        style={[styles.input, styles.reasonInput]}
                        multiline
                        placeholder="Reason for leave"
                        placeholderTextColor="rgba(255,255,255,0.38)"
                    />

                    <View style={styles.dateRow}>
                        <TextInput
                            value={fromDate}
                            onChangeText={setFromDate}
                            style={[styles.input, styles.dateInput]}
                            placeholder="From (YYYY-MM-DD)"
                            placeholderTextColor="rgba(255,255,255,0.38)"
                        />
                        <TextInput
                            value={toDate}
                            onChangeText={setToDate}
                            style={[styles.input, styles.dateInput]}
                            placeholder="To (YYYY-MM-DD)"
                            placeholderTextColor="rgba(255,255,255,0.38)"
                        />
                    </View>

                    <Pressable style={styles.submitBtn} onPress={onCreate} disabled={submitLoading}>
                        {submitLoading ? (
                            <ActivityIndicator color="#121212" />
                        ) : (
                            <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>
                        )}
                    </Pressable>
                </View>

                <Text style={styles.historyTitle}>Request History</Text>

                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No pink slips yet. Create your first request above.</Text>
                    </View>
                ) : (
                    <View style={styles.historyList}>
                        {items.map((item, index) => {
                            const status = String(item.status ?? "PENDING").toUpperCase()
                            const color = statusColor(status)
                            const remarks = hideBackendIds(item.remarks?.trim())
                            const safeReason = hideBackendIds(item.reason?.trim()) || "No reason provided"

                            return (
                                <View
                                    key={String(item.id ?? index)}
                                    style={[
                                        styles.historyCard,
                                        status === "APPROVED"
                                            ? { backgroundColor: "rgba(255,95,162,0.08)", borderColor: "rgba(255,95,162,0.45)" }
                                            : null,
                                    ]}
                                >
                                    <View style={styles.historyIconWrap}>
                                        <Text style={[styles.historyIcon, { color }]}>
                                            {status === "APPROVED" ? "✓" : status === "REJECTED" ? "✕" : "⌛"}
                                        </Text>
                                    </View>

                                    <View style={styles.historyBody}>
                                        <Text style={styles.historyTicket}>Ticket: {resolveTicketId(item)}</Text>
                                        <Text style={styles.historyReason}>{safeReason}</Text>
                                        <Text style={styles.historyDates}>
                                            {formatDateShort(item.fromDate)} - {formatDateShort(item.toDate)}
                                        </Text>
                                        {item.updatedAt ? (
                                            <Text style={styles.historyUpdated}>Updated {formatDateTime(item.updatedAt)}</Text>
                                        ) : null}
                                        {remarks ? <Text style={styles.historyRemark}>Remark: {remarks}</Text> : null}
                                    </View>

                                    <View style={[styles.statusPill, { borderColor: `${color}66`, backgroundColor: `${color}1A` }]}>
                                        <Text style={[styles.statusPillText, { color }]}>{status}</Text>
                                    </View>
                                </View>
                            )
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#121212" },
    center: { flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center" },
    scrollContent: { padding: 24, paddingBottom: 30 },
    pageTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
    pageSubtitle: { color: "rgba(255,255,255,0.54)", fontSize: 14, marginTop: 8 },

    statsRow: { flexDirection: "row", gap: 10, marginTop: 24 },
    statChip: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    statCount: { fontSize: 18, fontWeight: "900" },
    statLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "600", marginTop: 2 },

    ticketCard: {
        marginTop: 16,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: "rgba(255,95,162,0.7)",
        backgroundColor: "#FFDCEC",
        padding: 18,
    },
    ticketTopRow: { flexDirection: "row", alignItems: "center" },
    ticketTitle: { color: "#7B0F40", fontSize: 16, fontWeight: "800" },
    ticketActiveChip: {
        marginLeft: "auto",
        borderRadius: 999,
        backgroundColor: "#B3155B",
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    ticketActiveText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
    ticketId: { color: "#7B0F40", marginTop: 12, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    ticketReasonRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
    ticketBadgeIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(179,21,91,0.4)",
        backgroundColor: "rgba(179,21,91,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    ticketBadgeIconText: { color: "#B3155B", fontSize: 32, fontWeight: "900" },
    ticketReason: { flex: 1, color: "#5A0D30", fontSize: 14, fontWeight: "700" },

    ticketMetaRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    ticketMetaCard: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(179,21,91,0.35)",
        backgroundColor: "rgba(179,21,91,0.15)",
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    ticketMetaLabel: { color: "#9D3D69", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    ticketMetaValue: { color: "#5A0D30", fontSize: 12, fontWeight: "700", marginTop: 4 },
    ticketRemark: {
        marginTop: 10,
        color: "#7E3458",
        fontStyle: "italic",
        fontSize: 12,
        fontWeight: "600",
    },

    formCard: {
        marginTop: 16,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#333333",
        backgroundColor: "#1E1E1E",
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowOffset: { width: 4, height: 4 },
        shadowRadius: 0,
        elevation: 3,
        gap: 14,
    },
    input: {
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#333333",
        backgroundColor: "#1E1E1E",
        color: "#fff",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    reasonInput: { minHeight: 90, textAlignVertical: "top" },
    dateRow: { flexDirection: "row", gap: 12 },
    dateInput: { flex: 1 },
    submitBtn: {
        minHeight: 50,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#121212",
        backgroundColor: "#4ade80",
        alignItems: "center",
        justifyContent: "center",
    },
    submitBtnText: { color: "#121212", fontSize: 16, fontWeight: "900", letterSpacing: 1 },

    historyTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 28, marginBottom: 14 },
    emptyState: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 18,
    },
    emptyText: { color: "rgba(255,255,255,0.6)" },

    historyList: { gap: 12 },
    historyCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    historyIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    historyIcon: { fontSize: 24, fontWeight: "900" },
    historyBody: { flex: 1 },
    historyTicket: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
    historyReason: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 4 },
    historyDates: { color: "rgba(255,255,255,0.54)", fontSize: 13, marginTop: 4 },
    historyUpdated: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 },
    historyRemark: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontStyle: "italic", marginTop: 8 },
    statusPill: {
        marginLeft: 10,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "center",
    },
    statusPillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
})
