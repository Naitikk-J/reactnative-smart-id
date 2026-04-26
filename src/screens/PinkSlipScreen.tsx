import React, { useCallback, useEffect, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { PinkSlip, createPinkSlip, getMyPinkSlips } from "../services/pinkSlipService"
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker"

function formatDate(raw?: string): string {
    if (!raw) return "—"
    try {
        const d = new Date(raw)
        if (isNaN(d.getTime())) return raw
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    } catch {
        return raw
    }
}

function statusColor(status: string): string {
    switch (status.toUpperCase()) {
        case "APPROVED":
            return APP_THEME.success
        case "REJECTED":
            return APP_THEME.danger
        default:
            return APP_THEME.warning
    }
}

function statusIcon(status: string): string {
    switch (status.toUpperCase()) {
        case "APPROVED":
            return "✓"
        case "REJECTED":
            return "✕"
        default:
            return "⏳"
    }
}

export default function PinkSlipScreen() {
    const { user } = useAuth()
    const [slips, setSlips] = useState<PinkSlip[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Create modal state
    const [showCreate, setShowCreate] = useState(false)
    const [reason, setReason] = useState("")
    const [fromDate, setFromDate] = useState<Date | null>(null)
    const [toDate, setToDate] = useState<Date | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [showFromPicker, setShowFromPicker] = useState(false)
    const [showToPicker, setShowToPicker] = useState(false)

    // Ticket modal state
    const [ticketSlip, setTicketSlip] = useState<PinkSlip | null>(null)

    const loadSlips = useCallback(async () => {
        setError(null)
        const data = await getMyPinkSlips()
        setSlips(data)
    }, [])

    useEffect(() => {
        loadSlips().finally(() => setLoading(false))
    }, [loadSlips])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadSlips()
        setRefreshing(false)
    }

    const handleSubmit = async () => {
        if (reason.trim().length < 5) {
            Alert.alert("Invalid", "Reason must be at least 5 characters")
            return
        }
        if (!fromDate || !toDate) {
            Alert.alert("Invalid", "Please select both dates")
            return
        }
        if (toDate < fromDate) {
            Alert.alert("Invalid", "To date must be after from date")
            return
        }

        setSubmitting(true)
        const result = await createPinkSlip({
            reason: reason.trim(),
            fromDate: fromDate.toISOString(),
            toDate: toDate.toISOString(),
        })
        setSubmitting(false)

        if (!result.ok) {
            Alert.alert("Failed", result.error ?? "Unable to submit request")
            return
        }

        setShowCreate(false)
        setReason("")
        setFromDate(null)
        setToDate(null)
        Alert.alert("✓ Submitted", "Leave request submitted to the warden panel.")
        loadSlips()
    }

    const renderSlip = ({ item }: { item: PinkSlip }) => {
        const color = statusColor(item.status)

        return (
            <Pressable
                style={styles.slipCard}
                onPress={item.status === "APPROVED" ? () => setTicketSlip(item) : undefined}
            >
                <LinearGradient
                    colors={[color + "0A", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header */}
                <View style={styles.slipHeaderRow}>
                    <Text style={[styles.slipTicketId, { color: APP_THEME.accent }]}>
                        {item.ticketId}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: color + "1A" }]}>
                        <Text style={[styles.statusBadgeIcon, { color }]}>{statusIcon(item.status)}</Text>
                        <Text style={[styles.statusBadgeText, { color }]}>{item.status}</Text>
                    </View>
                </View>

                {/* Reason */}
                <Text style={styles.slipReason} numberOfLines={3}>
                    {item.reason}
                </Text>

                {/* Date Range */}
                <View style={styles.slipDateRow}>
                    <Text style={styles.slipDateIcon}>📅</Text>
                    <Text style={styles.slipDateText}>
                        {formatDate(item.fromDate)}  →  {formatDate(item.toDate)}
                    </Text>
                </View>

                {/* Admin Remarks */}
                {item.remarks ? (
                    <View style={styles.remarksBox}>
                        <Text style={styles.remarksText}>
                            Admin: {item.remarks}
                        </Text>
                    </View>
                ) : null}
            </Pressable>
        )
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    return (
        <View style={styles.root}>
            <LinearGradient
                colors={["#0A0E21", "#0F1535", "#0A0E21"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {slips.length === 0 && !error ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>No leave requests yet</Text>
                    <Text style={styles.emptyDesc}>Tap + to submit your first request</Text>
                </View>
            ) : (
                <FlatList
                    data={slips}
                    keyExtractor={(item) => item.id || item.ticketId}
                    renderItem={renderSlip}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />
                    }
                />
            )}

            {/* FAB */}
            <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
                <LinearGradient
                    colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fabGradient}
                >
                    <Text style={styles.fabIcon}>+</Text>
                </LinearGradient>
            </Pressable>

            {/* Create Modal */}
            <Modal visible={showCreate} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Request Leave (Pink Slip)</Text>

                        <TextInput
                            value={reason}
                            onChangeText={setReason}
                            style={[styles.modalInput, { height: 100, textAlignVertical: "top" }]}
                            placeholder="Reason for leave"
                            placeholderTextColor={APP_THEME.muted}
                            multiline
                        />

                        {/* From Date */}
                        <Pressable style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
                            <Text style={fromDate ? styles.dateBtnTextActive : styles.dateBtnText}>
                                {fromDate ? formatDate(fromDate.toISOString()) : "From Date"}
                            </Text>
                            <Text style={styles.dateBtnIcon}>📅</Text>
                        </Pressable>

                        {/* To Date */}
                        <Pressable style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
                            <Text style={toDate ? styles.dateBtnTextActive : styles.dateBtnText}>
                                {toDate ? formatDate(toDate.toISOString()) : "To Date"}
                            </Text>
                            <Text style={styles.dateBtnIcon}>📅</Text>
                        </Pressable>

                        {showFromPicker && (
                            <DateTimePicker
                                value={fromDate ?? new Date()}
                                mode="date"
                                display={Platform.OS === "ios" ? "spinner" : "default"}
                                minimumDate={new Date(Date.now() - 86400000)}
                                maximumDate={new Date(Date.now() + 90 * 86400000)}
                                onChange={(_: DateTimePickerEvent, date?: Date) => {
                                    setShowFromPicker(Platform.OS === "ios")
                                    if (date) setFromDate(date)
                                }}
                            />
                        )}

                        {showToPicker && (
                            <DateTimePicker
                                value={toDate ?? new Date()}
                                mode="date"
                                display={Platform.OS === "ios" ? "spinner" : "default"}
                                minimumDate={new Date(Date.now() - 86400000)}
                                maximumDate={new Date(Date.now() + 90 * 86400000)}
                                onChange={(_: DateTimePickerEvent, date?: Date) => {
                                    setShowToPicker(Platform.OS === "ios")
                                    if (date) setToDate(date)
                                }}
                            />
                        )}

                        <View style={styles.modalActions}>
                            <Pressable
                                style={styles.modalCancelBtn}
                                onPress={() => setShowCreate(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleSubmit} disabled={submitting}>
                                <LinearGradient
                                    colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.modalSubmitBtn}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalSubmitText}>Submit</Text>
                                    )}
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Approved Ticket Modal */}
            <Modal visible={!!ticketSlip} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <LinearGradient
                        colors={["#FFB6C1", "#FF69B4"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ticketCard}
                    >
                        <Text style={styles.ticketCheckIcon}>✓</Text>
                        <Text style={styles.ticketTitle}>APPROVED LEAVE</Text>

                        <View style={styles.ticketDetailsWrap}>
                            <TicketRow label="TICKET ID" value={ticketSlip?.ticketId ?? "-"} />
                            <View style={styles.ticketDivider} />
                            <TicketRow label="STUDENT" value={user?.name ?? "Student"} />
                            <View style={styles.ticketDivider} />
                            <TicketRow label="VALID FROM" value={formatDate(ticketSlip?.fromDate)} />
                            <View style={styles.ticketDivider} />
                            <TicketRow label="VALID TO" value={formatDate(ticketSlip?.toDate)} />
                            <View style={styles.ticketDivider} />
                            <TicketRow
                                label="APPROVED BY"
                                value={ticketSlip?.approvedBy?.name ?? "Admin"}
                            />
                        </View>

                        <Pressable style={styles.ticketCloseBtn} onPress={() => setTicketSlip(null)}>
                            <Text style={styles.ticketCloseText}>Close</Text>
                        </Pressable>
                    </LinearGradient>
                </View>
            </Modal>
        </View>
    )
}

function TicketRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.ticketRow}>
            <Text style={styles.ticketRowLabel}>{label}</Text>
            <Text style={styles.ticketRowValue}>{value}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: APP_THEME.bg,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },

    // ── Empty State ──
    emptyWrap: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
    },
    emptyDesc: {
        color: APP_THEME.muted,
        fontSize: 14,
        marginTop: 6,
    },

    // ── Slip Card ──
    slipCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: APP_THEME.glassBg,
        padding: 18,
        marginBottom: 14,
        overflow: "hidden",
    },
    slipHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    slipTicketId: {
        fontSize: 16,
        fontWeight: "800",
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusBadgeIcon: {
        fontSize: 12,
        fontWeight: "900",
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    slipReason: {
        color: APP_THEME.text,
        fontSize: 14,
        fontWeight: "500",
        lineHeight: 20,
        marginBottom: 10,
    },
    slipDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    slipDateIcon: { fontSize: 12 },
    slipDateText: {
        color: APP_THEME.muted,
        fontSize: 12,
        fontWeight: "600",
    },
    remarksBox: {
        marginTop: 10,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    remarksText: {
        color: APP_THEME.muted,
        fontSize: 12,
        fontStyle: "italic",
    },

    // ── FAB ──
    fab: {
        position: "absolute",
        bottom: 100,
        right: 20,
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    fabGradient: {
        width: 60,
        height: 60,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    fabIcon: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "300",
        marginTop: -2,
    },

    // ── Create Modal ──
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: APP_THEME.surfaceDark,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        padding: 20,
        gap: 12,
    },
    modalTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
    },
    modalInput: {
        borderColor: APP_THEME.glassBorder,
        borderWidth: 1,
        borderRadius: 14,
        color: APP_THEME.text,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dateBtn: {
        borderColor: APP_THEME.glassBorder,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    dateBtnText: {
        color: APP_THEME.muted,
        fontSize: 14,
    },
    dateBtnTextActive: {
        color: APP_THEME.text,
        fontSize: 14,
        fontWeight: "600",
    },
    dateBtnIcon: { fontSize: 14 },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 4,
    },
    modalCancelBtn: {
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        paddingHorizontal: 16,
    },
    modalCancelText: {
        color: "rgba(255,255,255,0.5)",
        fontWeight: "700",
    },
    modalSubmitBtn: {
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        paddingHorizontal: 20,
    },
    modalSubmitText: {
        color: "#fff",
        fontWeight: "700",
    },

    // ── Approved Ticket Modal ──
    ticketCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: "center",
        shadowColor: "#FF69B4",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
    ticketCheckIcon: {
        fontSize: 56,
        color: "rgba(255,255,255,0.9)",
        fontWeight: "900",
        marginBottom: 8,
    },
    ticketTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: 2,
        marginBottom: 20,
    },
    ticketDetailsWrap: {
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 16,
        padding: 16,
    },
    ticketRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    ticketRowLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "rgba(255,255,255,0.8)",
        letterSpacing: 1,
    },
    ticketRowValue: {
        fontSize: 14,
        fontWeight: "800",
        color: "#fff",
    },
    ticketDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.3)",
        marginVertical: 10,
    },
    ticketCloseBtn: {
        marginTop: 20,
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 32,
        paddingVertical: 12,
    },
    ticketCloseText: {
        color: "#FF69B4",
        fontWeight: "800",
        fontSize: 15,
    },
})
