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
import { LinearGradient } from "expo-linear-gradient"
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
    if (status === "APPROVED") return APP_THEME.success
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
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    // ══════════════════════════════════════════════════════════════
    // ADMIN VIEW
    // ══════════════════════════════════════════════════════════════
    if (adminMode) {
        return (
            <View style={styles.root}>
                <LinearGradient
                    colors={["#0A0E21", "#0F1535", "#0A0E21"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                {/* Glass App Bar */}
                <View style={styles.glassAppBar}>
                    <View style={{ width: 48 }} />
                    <Text style={styles.appBarTitle}>Pink Slip Management</Text>
                    <View style={{ width: 48 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
                >
                    {adminItems.length === 0 ? (
                        <View style={styles.adminEmptyWrap}>
                            <View style={styles.adminEmptyIcon}>
                                <Text style={styles.adminEmptyIconText}>✓</Text>
                            </View>
                            <Text style={styles.adminEmptyTitle}>No Pending Requests</Text>
                            <Text style={styles.adminEmptySub}>All caught up! New requests will appear here.</Text>
                        </View>
                    ) : (
                        adminItems.map((item, index) => {
                            const studentName = String(item.student?.fullName ?? "Unknown Student")
                            const initial = studentName.charAt(0).toUpperCase() || "?"
                            const enrollment = String(item.student?.enrollmentNo ?? "N/A")
                            const department = String(item.student?.department ?? "")
                            const reasonText = hideBackendIds(item.reason?.trim()) || "No reason provided"
                            const fromDateStr = formatDateFull(item.fromDate)
                            const toDateStr = formatDateFull(item.toDate)

                            return (
                                <View key={String(item.id ?? index)} style={styles.adminCard}>
                                    {/* Student Header */}
                                    <View style={styles.adminCardHeader}>
                                        <LinearGradient
                                            colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                            style={styles.adminAvatar}
                                        >
                                            <Text style={styles.adminAvatarText}>{initial}</Text>
                                        </LinearGradient>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.adminStudentName}>{studentName}</Text>
                                            <Text style={styles.adminStudentMeta}>
                                                {enrollment}
                                                {department ? ` • ${department}` : ""}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.adminDivider} />

                                    {/* Reason */}
                                    <View style={{ gap: 4 }}>
                                        <Text style={styles.adminReasonLabel}>Reason:</Text>
                                        <Text style={styles.adminReasonValue}>{reasonText}</Text>
                                    </View>

                                    {/* Dates */}
                                    <View style={styles.adminDateRow}>
                                        <View style={styles.adminDateChip}>
                                            <Text style={styles.adminDateLabel}>From</Text>
                                            <View style={styles.adminDateValueRow}>
                                                <Text style={styles.adminDateIcon}>📅</Text>
                                                <Text style={styles.adminDateValue}>{fromDateStr}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.adminDateChip}>
                                            <Text style={styles.adminDateLabel}>To</Text>
                                            <View style={styles.adminDateValueRow}>
                                                <Text style={styles.adminDateIcon}>📅</Text>
                                                <Text style={styles.adminDateValue}>{toDateStr}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Actions */}
                                    <View style={styles.adminActionRow}>
                                        <Pressable
                                            style={styles.adminDenyBtn}
                                            onPress={() => openAdminActionModal(item, "REJECTED")}
                                        >
                                            <Text style={styles.adminDenyText}>DENY</Text>
                                        </Pressable>
                                        <Pressable
                                            style={styles.adminApproveBtnWrap}
                                            onPress={() => openAdminActionModal(item, "APPROVED")}
                                        >
                                            <LinearGradient
                                                colors={[APP_THEME.success, "#00C853"]}
                                                style={styles.adminApproveBtn}
                                            >
                                                <Text style={styles.adminApproveText}>APPROVE</Text>
                                            </LinearGradient>
                                        </Pressable>
                                    </View>
                                </View>
                            )
                        })
                    )}
                </ScrollView>

                {/* Admin Action Modal */}
                <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={closeAdminActionModal}>
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>
                                {actionStatus === "APPROVED" ? "Approve Request?" : "Deny Request?"}
                            </Text>
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
                                <Pressable onPress={onConfirmAdminAction} disabled={actionLoading}>
                                    <LinearGradient
                                        colors={
                                            actionStatus === "APPROVED"
                                                ? [APP_THEME.success, "#00C853"]
                                                : [APP_THEME.danger, "#D50000"]
                                        }
                                        style={styles.modalConfirmBtn}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <Text style={styles.modalConfirmText}>
                                                {actionStatus === "APPROVED" ? "Confirm Approval" : "Confirm Denial"}
                                            </Text>
                                        )}
                                    </LinearGradient>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        )
    }

    // ══════════════════════════════════════════════════════════════
    // STUDENT VIEW
    // ══════════════════════════════════════════════════════════════
    return (
        <View style={styles.root}>
            <LinearGradient
                colors={["#0A0E21", "#0F1535", "#0A0E21"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Glass App Bar */}
            <View style={styles.glassAppBar}>
                <View style={{ width: 48 }} />
                <Text style={styles.appBarTitle}>Pink Slip</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
            >
                <Text style={styles.pageTitle}>Request Leave</Text>
                <Text style={styles.pageSubtitle}>Submit a pink slip request to your warden for approval.</Text>

                {/* Stat Chips */}
                <View style={styles.statsRow}>
                    <View style={[styles.statChip, { borderColor: APP_THEME.success + "33", backgroundColor: APP_THEME.success + "14" }]}>
                        <Text style={[styles.statCount, { color: APP_THEME.success }]}>{approvedCount}</Text>
                        <Text style={styles.statLabel}>Approved</Text>
                    </View>
                    <View style={[styles.statChip, { borderColor: APP_THEME.warning + "33", backgroundColor: APP_THEME.warning + "14" }]}>
                        <Text style={[styles.statCount, { color: APP_THEME.warning }]}>{pendingCount}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={[styles.statChip, { borderColor: APP_THEME.danger + "33", backgroundColor: APP_THEME.danger + "14" }]}>
                        <Text style={[styles.statCount, { color: APP_THEME.danger }]}>{rejectedCount}</Text>
                        <Text style={styles.statLabel}>Rejected</Text>
                    </View>
                </View>

                {/* Active Ticket Card */}
                {latestApprovedSlip ? (
                    <View style={styles.ticketCard}>
                        <LinearGradient
                            colors={[APP_THEME.accent + "26", APP_THEME.accentPurple + "14"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.ticketCardInner}>
                            <View style={styles.ticketTopRow}>
                                <Text style={styles.ticketIcon}>🎫</Text>
                                <Text style={styles.ticketTitle}>Pink Slip Ticket</Text>
                                <LinearGradient
                                    colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                    style={styles.ticketActiveChip}
                                >
                                    <Text style={styles.ticketActiveText}>ACTIVE</Text>
                                </LinearGradient>
                            </View>

                            <View style={styles.ticketDivider} />

                            <Text style={styles.ticketId}>Ticket ID: {resolveTicketId(latestApprovedSlip)}</Text>

                            <View style={styles.ticketReasonRow}>
                                <LinearGradient
                                    colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                    style={styles.ticketBadgeIcon}
                                >
                                    <Text style={styles.ticketBadgeIconText}>✓</Text>
                                </LinearGradient>
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
                    </View>
                ) : null}

                {/* Form Card */}
                <View style={styles.formCard}>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                        multiline
                        placeholder="Reason for leave"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                    />

                    <View style={styles.dateRow}>
                        <View style={styles.dateSelector}>
                            <Text style={styles.dateSelectorLabel}>From</Text>
                            <TextInput
                                value={fromDate}
                                onChangeText={setFromDate}
                                style={styles.dateSelectorInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />
                        </View>
                        <View style={styles.dateSelector}>
                            <Text style={styles.dateSelectorLabel}>To</Text>
                            <TextInput
                                value={toDate}
                                onChangeText={setToDate}
                                style={styles.dateSelectorInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />
                        </View>
                    </View>

                    <Pressable onPress={onCreate} disabled={submitLoading}>
                        <LinearGradient
                            colors={submitLoading ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : [APP_THEME.accent, APP_THEME.accentPurple]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.submitBtn}
                        >
                            {submitLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>
                            )}
                        </LinearGradient>
                    </Pressable>
                </View>

                {/* History */}
                <Text style={styles.historyTitle}>Request History</Text>

                {studentItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No pink slips yet. Create your first request above.</Text>
                    </View>
                ) : (
                    <View style={{ gap: 10 }}>
                        {studentItems.map((item, index) => {
                            const status = String(item.status ?? "PENDING").toUpperCase()
                            const color = statusColor(status)
                            const remarks = hideBackendIds(item.remarks?.trim())
                            const safeReason = hideBackendIds(item.reason?.trim()) || "No reason provided"

                            return (
                                <View key={String(item.id ?? index)} style={[styles.historyCard, { borderColor: color + "1A" }]}>
                                    <View style={[styles.historyIconWrap, { backgroundColor: color + "1A" }]}>
                                        <Text style={[styles.historyIcon, { color }]}>
                                            {status === "APPROVED" ? "✓" : status === "REJECTED" ? "✕" : "⌛"}
                                        </Text>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.historyTicket}>Ticket: {resolveTicketId(item)}</Text>
                                        <Text style={styles.historyReason}>{safeReason}</Text>
                                        <Text style={styles.historyDates}>
                                            {formatDateShort(item.fromDate)} - {formatDateShort(item.toDate)}
                                        </Text>
                                        {item.updatedAt ? (
                                            <Text style={styles.historyUpdated}>Updated {formatDateTime(item.updatedAt)}</Text>
                                        ) : null}
                                        {remarks ? (
                                            <Text style={styles.historyRemark}>Remark: {remarks}</Text>
                                        ) : null}
                                    </View>

                                    <View style={[styles.historyStatusPill, { backgroundColor: color + "1A", borderColor: color + "40" }]}>
                                        <Text style={[styles.historyStatusText, { color }]}>{status}</Text>
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
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    center: { flex: 1, backgroundColor: APP_THEME.bg, alignItems: "center", justifyContent: "center" },

    // ── Glass App Bar ──
    glassAppBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
    },
    appBarTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
    },

    scrollContent: { padding: 20, paddingBottom: 120 },

    pageTitle: { color: APP_THEME.text, fontSize: 24, fontWeight: "800" },
    pageSubtitle: { color: APP_THEME.muted, fontSize: 13, marginTop: 6 },

    // ── Stats ──
    statsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    statChip: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    statCount: { fontSize: 20, fontWeight: "800" },
    statLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", marginTop: 2 },

    // ── Ticket Card ──
    ticketCard: {
        marginTop: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: APP_THEME.accent + "40",
        overflow: "hidden",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    ticketCardInner: { padding: 18 },
    ticketTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    ticketIcon: { fontSize: 18 },
    ticketTitle: { color: APP_THEME.text, fontSize: 15, fontWeight: "700", flex: 1 },
    ticketActiveChip: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    ticketActiveText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    ticketDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 12 },
    ticketId: { color: APP_THEME.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    ticketReasonRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
    ticketBadgeIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    ticketBadgeIconText: { color: "#fff", fontSize: 28, fontWeight: "900" },
    ticketReason: { flex: 1, color: APP_THEME.text, fontSize: 14, fontWeight: "600" },
    ticketMetaRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    ticketMetaCard: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    ticketMetaLabel: { color: APP_THEME.accent + "B3", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    ticketMetaValue: { color: APP_THEME.text, fontSize: 12, fontWeight: "600", marginTop: 4 },
    ticketRemark: {
        marginTop: 10,
        color: "rgba(255,255,255,0.5)",
        fontStyle: "italic",
        fontSize: 12,
    },

    // ── Form Card ──
    formCard: {
        marginTop: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 22,
        gap: 20,
    },
    input: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: "rgba(255,255,255,0.05)",
        color: APP_THEME.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dateRow: { flexDirection: "row", gap: 14 },
    dateSelector: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    dateSelectorLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600", marginBottom: 6 },
    dateSelectorInput: {
        color: APP_THEME.text,
        fontSize: 13,
        fontWeight: "600",
        padding: 0,
    },
    submitBtn: {
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },

    // ── History ──
    historyTitle: { color: APP_THEME.text, fontSize: 18, fontWeight: "700", marginTop: 32, marginBottom: 14 },
    emptyState: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 18,
    },
    emptyText: { color: "rgba(255,255,255,0.4)" },

    historyCard: {
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    historyIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    historyIcon: { fontSize: 20, fontWeight: "900" },
    historyTicket: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },
    historyReason: { color: APP_THEME.text, fontSize: 15, fontWeight: "600", marginTop: 3 },
    historyDates: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3 },
    historyUpdated: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3 },
    historyRemark: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontStyle: "italic", marginTop: 6 },
    historyStatusPill: {
        marginLeft: 10,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "center",
    },
    historyStatusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

    // ── Admin ──
    adminEmptyWrap: { marginTop: 70, alignItems: "center", paddingHorizontal: 20 },
    adminEmptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: APP_THEME.success + "14",
        alignItems: "center",
        justifyContent: "center",
    },
    adminEmptyIconText: { color: APP_THEME.success + "4D", fontSize: 40, fontWeight: "900" },
    adminEmptyTitle: { color: APP_THEME.text, fontSize: 20, fontWeight: "700", marginTop: 24 },
    adminEmptySub: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 8 },

    adminCard: {
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 18,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    adminCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    adminAvatar: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    adminAvatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
    adminStudentName: { color: APP_THEME.text, fontWeight: "600", fontSize: 15 },
    adminStudentMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
    adminDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 14 },
    adminReasonLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700" },
    adminReasonValue: { color: "rgba(255,255,255,0.85)", fontSize: 14 },

    adminDateRow: { flexDirection: "row", gap: 12, marginTop: 14 },
    adminDateChip: {
        flex: 1,
        gap: 4,
    },
    adminDateLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "700" },
    adminDateValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 10,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    adminDateIcon: { fontSize: 12 },
    adminDateValue: { color: APP_THEME.text, fontSize: 12, fontWeight: "600" },

    adminActionRow: { flexDirection: "row", gap: 12, marginTop: 18 },
    adminDenyBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: APP_THEME.danger + "66",
    },
    adminDenyText: { color: APP_THEME.danger, fontWeight: "700", fontSize: 13 },
    adminApproveBtnWrap: {
        flex: 1,
        borderRadius: 14,
        overflow: "hidden",
        shadowColor: APP_THEME.success,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    adminApproveBtn: {
        height: 46,
        alignItems: "center",
        justifyContent: "center",
    },
    adminApproveText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    // ── Modals ──
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: APP_THEME.surfaceDark,
        padding: 20,
        gap: 12,
    },
    modalTitle: { color: APP_THEME.text, fontSize: 18, fontWeight: "700" },
    modalInput: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: "rgba(255,255,255,0.05)",
        color: APP_THEME.text,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 78,
        textAlignVertical: "top",
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    modalCancelBtn: {
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelText: { color: "rgba(255,255,255,0.5)", fontWeight: "700" },
    modalConfirmBtn: {
        height: 44,
        borderRadius: 14,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    modalConfirmText: { color: "#fff", fontWeight: "700" },
})
