import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { createPinkSlip, getMyPinkSlips, getPendingPinkSlips, updatePinkSlipStatus } from "../services/pinkSlipService"

type PinkSlipItem = {
    id?: string
    ticketId?: string
    reason?: string
    fromDate?: string
    toDate?: string
    updatedAt?: string
    remarks?: string
    status?: "APPROVED" | "PENDING" | "REJECTED" | string
    student?: {
        fullName?: string
        enrollmentNo?: string
        department?: string
    }
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

function isAdminRole(role?: string): boolean {
    const normalized = String(role ?? "").toUpperCase()
    return normalized === "SUPER_ADMIN" || normalized === "HOD" || normalized === "WARDEN"
}

export default function PinkSlipScreen() {
    const { user } = useAuth()
    const adminMode = useMemo(() => isAdminRole(user?.role), [user?.role])

    const [studentItems, setStudentItems] = useState<PinkSlipItem[]>([])
    const [adminItems, setAdminItems] = useState<PinkSlipItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const [reason, setReason] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [submitLoading, setSubmitLoading] = useState(false)

    const [actionModalVisible, setActionModalVisible] = useState(false)
    const [actionTarget, setActionTarget] = useState<PinkSlipItem | null>(null)
    const [actionStatus, setActionStatus] = useState<"APPROVED" | "REJECTED">("APPROVED")
    const [adminRemark, setAdminRemark] = useState("")
    const [actionLoading, setActionLoading] = useState(false)

    const loadStudentItems = useCallback(async () => {
        const slips = await getMyPinkSlips()
        const normalized = slips
            .filter((item) => typeof item === "object" && item !== null)
            .map((item) => ({ ...(item as PinkSlipItem) }))
        setStudentItems(normalized)
    }, [])

    const loadAdminItems = useCallback(async () => {
        const slips = await getPendingPinkSlips()
        const normalized = slips
            .filter((item) => typeof item === "object" && item !== null)
            .map((item) => ({ ...(item as PinkSlipItem) }))
        setAdminItems(normalized)
    }, [])

    const loadItems = useCallback(async () => {
        if (adminMode) {
            await loadAdminItems()
        } else {
            await loadStudentItems()
        }
    }, [adminMode, loadAdminItems, loadStudentItems])

    useEffect(() => {
        loadItems().finally(() => setLoading(false))
    }, [loadItems])

    const approvedCount = useMemo(() => studentItems.filter((s) => s.status === "APPROVED").length, [studentItems])
    const pendingCount = useMemo(() => studentItems.filter((s) => s.status === "PENDING").length, [studentItems])
    const rejectedCount = useMemo(() => studentItems.filter((s) => s.status === "REJECTED").length, [studentItems])
    const latestApprovedSlip = useMemo(() => studentItems.find((s) => s.status === "APPROVED") ?? null, [studentItems])

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
        await loadStudentItems()
    }

    const openAdminActionModal = (item: PinkSlipItem, status: "APPROVED" | "REJECTED") => {
        setActionTarget(item)
        setActionStatus(status)
        setAdminRemark("")
        setActionModalVisible(true)
    }

    const closeAdminActionModal = () => {
        if (actionLoading) return
        setActionModalVisible(false)
        setActionTarget(null)
        setAdminRemark("")
    }

    const onConfirmAdminAction = async () => {
        if (!actionTarget?.id) {
            closeAdminActionModal()
            return
        }

        setActionLoading(true)
        const success = await updatePinkSlipStatus(
            actionTarget.id,
            actionStatus,
            adminRemark.trim() ? adminRemark.trim() : undefined,
        )
        setActionLoading(false)

        if (!success) {
            Alert.alert("Failed", "Unable to update pink slip status")
            return
        }

        closeAdminActionModal()
        Alert.alert("Updated", `Request ${actionStatus.toLowerCase()} successfully`)
        await loadAdminItems()
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#4ade80" size="large" />
            </View>
        )
    }

    if (adminMode) {
        return (
            <View style={styles.root}>
                <ScrollView
                    contentContainerStyle={styles.adminScrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
                >
                    <Text style={styles.adminTitle}>Pink Slip Management</Text>

                    {adminItems.length === 0 ? (
                        <View style={styles.adminEmptyWrap}>
                            <Text style={styles.adminEmptyIcon}>◉</Text>
                            <Text style={styles.adminEmptyTitle}>No Pending Requests</Text>
                            <Text style={styles.adminEmptySub}>All caught up! New requests will appear here.</Text>
                        </View>
                    ) : (
                        <View style={styles.adminList}>
                            {adminItems.map((item, index) => {
                                const studentName = String(item.student?.fullName ?? "Unknown Student")
                                const initial = studentName.charAt(0).toUpperCase() || "?"
                                const enrollment = String(item.student?.enrollmentNo ?? "N/A")
                                const department = String(item.student?.department ?? "")
                                const reasonText = hideBackendIds(item.reason?.trim()) || "No reason provided"
                                const fromDate = formatDateFull(item.fromDate)
                                const toDate = formatDateFull(item.toDate)

                                return (
                                    <View key={String(item.id ?? index)} style={styles.adminCard}>
                                        <View style={styles.adminCardHeader}>
                                            <View style={styles.adminAvatar}>
                                                <Text style={styles.adminAvatarText}>{initial}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.adminStudentName}>{studentName}</Text>
                                                <Text style={styles.adminStudentMeta}>{enrollment}{department ? ` • ${department}` : ""}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.adminDivider} />

                                        <View style={styles.adminReasonWrap}>
                                            <Text style={styles.adminReasonLabel}>Reason:</Text>
                                            <Text style={styles.adminReasonValue}>{reasonText}</Text>
                                        </View>

                                        <View style={styles.adminDateRow}>
                                            <View style={styles.adminDateChip}>
                                                <Text style={styles.adminDateLabel}>From</Text>
                                                <Text style={styles.adminDateValue}>{fromDate}</Text>
                                            </View>
                                            <View style={styles.adminDateChip}>
                                                <Text style={styles.adminDateLabel}>To</Text>
                                                <Text style={styles.adminDateValue}>{toDate}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.adminActionRow}>
                                            <Pressable
                                                style={[styles.adminActionBtn, styles.adminDenyBtn]}
                                                onPress={() => openAdminActionModal(item, "REJECTED")}
                                            >
                                                <Text style={styles.adminDenyText}>DENY</Text>
                                            </Pressable>
                                            <Pressable
                                                style={[styles.adminActionBtn, styles.adminApproveBtn]}
                                                onPress={() => openAdminActionModal(item, "APPROVED")}
                                            >
                                                <Text style={styles.adminApproveText}>APPROVE</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                )
                            })}
                        </View>
                    )}
                </ScrollView>

                <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={closeAdminActionModal}>
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>{actionStatus === "APPROVED" ? "Approve Request?" : "Deny Request?"}</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={adminRemark}
                                onChangeText={setAdminRemark}
                                placeholder="Add remarks (optional)"
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                multiline
                            />
                            <View style={styles.modalActions}>
                                <Pressable style={styles.modalCancelBtn} onPress={closeAdminActionModal}>
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.modalConfirmBtn,
                                        actionStatus === "APPROVED" ? styles.modalConfirmApprove : styles.modalConfirmDeny,
                                    ]}
                                    onPress={onConfirmAdminAction}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.modalConfirmText}>
                                            {actionStatus === "APPROVED" ? "Confirm Approval" : "Confirm Denial"}
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
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

                {studentItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No pink slips yet. Create your first request above.</Text>
                    </View>
                ) : (
                    <View style={styles.historyList}>
                        {studentItems.map((item, index) => {
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

    adminScrollContent: { padding: 16, paddingBottom: 28 },
    adminTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 0.8,
        textAlign: "center",
        marginBottom: 16,
    },
    adminEmptyWrap: {
        marginTop: 70,
        alignItems: "center",
        paddingHorizontal: 20,
    },
    adminEmptyIcon: { color: "rgba(255,255,255,0.1)", fontSize: 78, fontWeight: "900" },
    adminEmptyTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 8 },
    adminEmptySub: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 8 },

    adminList: { gap: 16 },
    adminCard: {
        backgroundColor: "#1E1E1E",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#333333",
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowOffset: { width: 4, height: 4 },
        shadowRadius: 0,
        elevation: 4,
    },
    adminCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    adminAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(74,222,128,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    adminAvatarText: { color: "#4ade80", fontWeight: "800", fontSize: 18 },
    adminStudentName: { color: "#fff", fontWeight: "800", fontSize: 16 },
    adminStudentMeta: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
    adminDivider: { height: 1, backgroundColor: "#333333", marginVertical: 14 },
    adminReasonWrap: { gap: 4 },
    adminReasonLabel: { color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: "700" },
    adminReasonValue: { color: "#fff", fontSize: 14, lineHeight: 20 },

    adminDateRow: { flexDirection: "row", gap: 12, marginTop: 14 },
    adminDateChip: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 8,
        gap: 4,
    },
    adminDateLabel: { color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "700" },
    adminDateValue: { color: "#fff", fontSize: 12, fontWeight: "800" },

    adminActionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    adminActionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    adminDenyBtn: { borderColor: APP_THEME.danger, backgroundColor: "rgba(239,71,111,0.08)" },
    adminApproveBtn: { borderColor: "#4ade80", backgroundColor: "#4ade80" },
    adminDenyText: { color: APP_THEME.danger, fontWeight: "800", letterSpacing: 0.6 },
    adminApproveText: { color: "#fff", fontWeight: "800", letterSpacing: 0.6 },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#333333",
        backgroundColor: "#1E1E1E",
        padding: 16,
        gap: 12,
    },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
    modalInput: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.06)",
        color: "#fff",
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 78,
        textAlignVertical: "top",
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    modalCancelBtn: {
        minHeight: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelText: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },
    modalConfirmBtn: {
        minHeight: 40,
        borderRadius: 10,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    modalConfirmApprove: { backgroundColor: "#4ade80" },
    modalConfirmDeny: { backgroundColor: APP_THEME.danger },
    modalConfirmText: { color: "#fff", fontWeight: "800" },
})
