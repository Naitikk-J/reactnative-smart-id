import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native"
import * as Location from "expo-location"
import { LinearGradient } from "expo-linear-gradient"
import { useNavigation } from "@react-navigation/native"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { getMyAlerts } from "../services/alertService"
import { submitLateReturnRequest } from "../services/lateReturnService"
import { getPersonalLogs } from "../services/scanService"

const MEAL_NUMBER_REGEX = /meal\s*#?\s*(\d+)/i

function isMealLog(item: any): boolean {
    const type = String(item?.type ?? item?.scanType ?? "").toUpperCase()
    const result = String(item?.result ?? "").toUpperCase()
    const gate = String(item?.gateLabel ?? item?.gate ?? "")
    return type === "EVENT_MEAL" || result === "MEAL_CONFIRMED" || MEAL_NUMBER_REGEX.test(gate)
}

function extractMealNo(item: any): number | null {
    const direct = Number(item?.mealNumber ?? item?.meta?.mealNumber)
    if (Number.isFinite(direct) && direct > 0) return direct

    const gate = String(item?.gateLabel ?? item?.gate ?? "")
    const matched = gate.match(MEAL_NUMBER_REGEX)
    if (!matched) return null

    const parsed = Number(matched[1])
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatTime(stamp: any): string {
    if (!stamp) return "-"
    const dt = new Date(stamp)
    if (isNaN(dt.getTime())) return "-"
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })
}

function formatGateLabel(gate?: string): string {
    if (!gate) return "-"
    return gate.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function DashboardScreen() {
    const { user, logout } = useAuth()
    const navigation = useNavigation<any>()
    const [logs, setLogs] = useState<any[]>([])
    const [alertsCount, setAlertsCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const [showLateModal, setShowLateModal] = useState(false)
    const [etaMinutes, setEtaMinutes] = useState("30")
    const [lateReason, setLateReason] = useState("")
    const [lateLoading, setLateLoading] = useState(false)

    const isStudent = useMemo(() => String(user?.role ?? "").toUpperCase() === "STUDENT", [user?.role])

    const loadData = useCallback(async () => {
        const [nextLogs, nextAlerts] = await Promise.all([
            getPersonalLogs(3),
            getMyAlerts(20),
        ])

        setLogs(nextLogs)
        setAlertsCount(nextAlerts.length)
    }, [])

    useEffect(() => {
        loadData().finally(() => setLoading(false))
    }, [loadData])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

    const lastDirectionalLog = useMemo(
        () =>
            logs.find((log) => {
                if (isMealLog(log)) return false
                const direction = String(log?.direction ?? "").toUpperCase()
                return direction === "ENTRY" || direction === "EXIT"
            }) ?? null,
        [logs],
    )

    const statusText = useMemo(() => {
        if (!lastDirectionalLog) return "INSIDE HOSTEL"
        return String(lastDirectionalLog.direction).toUpperCase() === "ENTRY"
            ? "INSIDE HOSTEL"
            : "OUTSIDE HOSTEL"
    }, [lastDirectionalLog])

    const isInsideHostel = statusText === "INSIDE HOSTEL"
    const recentLogItems = logs.slice(0, 3)

    const lastGateLabel = lastDirectionalLog ? formatGateLabel(lastDirectionalLog.gate ?? lastDirectionalLog.gateLabel) : null
    const lastScanTime = lastDirectionalLog
        ? `Last scan at ${lastGateLabel} • ${formatTime(lastDirectionalLog.time ?? lastDirectionalLog.scannedAt)}`
        : "No recent scans found"

    const onPrimaryQuickAction = () => {
        navigation.navigate("Scanner")
    }

    const onSecondaryQuickAction = () => {
        navigation.navigate("Logs")
    }

    const onSubmitLateReturn = async () => {
        setLateLoading(true)

        const minutes = Number(etaMinutes)
        if (!Number.isFinite(minutes) || minutes <= 0) {
            setLateLoading(false)
            Alert.alert("Invalid", "ETA minutes should be > 0")
            return
        }

        if (lateReason.trim().length < 5) {
            setLateLoading(false)
            Alert.alert("Invalid", "Please enter a valid reason (min 5 chars).")
            return
        }

        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status !== "granted") {
            setLateLoading(false)
            Alert.alert("Permission required", "Location permission is required")
            return
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        const eta = new Date(Date.now() + minutes * 60 * 1000)

        const outcome = await submitLateReturnRequest({
            eta: eta.toISOString(),
            reason: lateReason,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        })

        setLateLoading(false)

        if (!outcome.ok) {
            Alert.alert("Failed", outcome.error ?? "Unable to submit late return request")
            return
        }

        setShowLateModal(false)
        setLateReason("")
        Alert.alert("Submitted", "Late return request sent to warden panel.")
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.root}>
                <LinearGradient
                    colors={["#0A0E21", "#0F1535", "#0A0E21"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={Keyboard.dismiss}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />
                    }
                >
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.welcomeText}>Welcome back,</Text>
                            <Text style={styles.userName}>{user?.name ?? "Student"}</Text>
                        </View>
                        <Pressable onPress={logout} style={styles.logoutBtn}>
                            <Text style={styles.logoutIcon}>⎋</Text>
                        </Pressable>
                    </View>

                    {/* Status Card */}
                    <View
                        style={[
                            styles.statusCard,
                            {
                                borderColor: (isStudent
                                    ? isInsideHostel
                                        ? APP_THEME.accent
                                        : APP_THEME.warning
                                    : APP_THEME.accentPurple
                                ) + "33",
                            },
                        ]}
                    >
                        <LinearGradient
                            colors={[
                                (isStudent
                                    ? isInsideHostel
                                        ? APP_THEME.accent
                                        : APP_THEME.warning
                                    : APP_THEME.accentPurple) + "14",
                                "rgba(255,255,255,0.03)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.statusCardInner}>
                            <View style={styles.statusIconRow}>
                                <View
                                    style={[
                                        styles.statusIconWrap,
                                        {
                                            backgroundColor: (isStudent
                                                ? isInsideHostel
                                                    ? APP_THEME.accent
                                                    : APP_THEME.warning
                                                : APP_THEME.accentPurple) + "1F",
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusIconText,
                                            {
                                                color: isStudent
                                                    ? isInsideHostel
                                                        ? APP_THEME.accent
                                                        : APP_THEME.warning
                                                    : APP_THEME.accentPurple,
                                            },
                                        ]}
                                    >
                                        {isStudent ? "◎" : "⬡"}
                                    </Text>
                                </View>
                                <Text style={styles.statusLabel}>
                                    {isStudent ? "Current Status" : "Panel Role"}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.statusValue,
                                    {
                                        color: isStudent
                                            ? isInsideHostel
                                                ? APP_THEME.accent
                                                : APP_THEME.warning
                                            : APP_THEME.accent,
                                    },
                                ]}
                            >
                                {isStudent ? statusText : (user?.role ?? "ADMIN")}
                            </Text>
                            <Text style={styles.statusMeta}>
                                {isStudent ? lastScanTime : "MITS Hostel Management System"}
                            </Text>
                        </View>
                    </View>

                    {/* Quick Actions */}
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionRow}>
                        <Pressable style={styles.actionCardGradientWrap} onPress={onPrimaryQuickAction}>
                            <LinearGradient
                                colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.actionCardGradient}
                            >
                                <Text style={styles.actionCardIcon}>
                                    ◎
                                </Text>
                                <Text style={styles.actionCardTitle}>
                                    Scan QR
                                </Text>
                            </LinearGradient>
                        </Pressable>
                        <Pressable style={styles.actionCardGlass} onPress={onSecondaryQuickAction}>
                            <Text style={styles.actionCardIcon}>≣</Text>
                            <Text style={styles.actionCardTitle}>
                                Activity Logs
                            </Text>
                        </Pressable>
                    </View>

                    {/* Secondary Quick Actions */}
                    <View style={styles.actionRow}>
                        <Pressable
                            style={styles.actionCardGlass}
                            onPress={() => navigation.navigate("EIdCard")}
                        >
                            <Text style={styles.actionCardIcon}>⊡</Text>
                            <Text style={styles.actionCardTitle}>E-ID Card</Text>
                        </Pressable>
                        <Pressable
                            style={styles.actionCardGlass}
                            onPress={() => navigation.navigate("PinkSlip")}
                        >
                            <Text style={[styles.actionCardIcon, { color: APP_THEME.accentPink }]}>📋</Text>
                            <Text style={styles.actionCardTitle}>Pink Slip</Text>
                        </Pressable>
                    </View>

                    {/* Late Return Button (Students Only) */}
                    {isStudent && (
                        <Pressable style={styles.lateReturnBtn} onPress={() => setShowLateModal(true)}>
                            <Text style={styles.lateReturnIcon}>⏱</Text>
                            <Text style={styles.lateReturnText}>I'll Be Late (ETA + Location)</Text>
                        </Pressable>
                    )}

                    {/* Recent Activity */}
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <Pressable onPress={() => navigation.navigate("Logs")}>
                            <Text style={styles.viewAllText}>View All</Text>
                        </Pressable>
                    </View>

                    {recentLogItems.length === 0 ? (
                        <Text style={styles.emptyText}>No recent activity today.</Text>
                    ) : (
                        recentLogItems.map((item: any, idx: number) => {
                            const stamp = item?.time ?? item?.scannedAt ?? item?.timestamp
                            const mealLog = isMealLog(item)
                            const direction = String(item?.direction ?? "SCAN").toUpperCase()
                            const mealNo = extractMealNo(item)
                            const isEntry = direction === "ENTRY"
                            const accentColor = mealLog
                                ? APP_THEME.accent
                                : isEntry
                                    ? APP_THEME.success
                                    : APP_THEME.warning

                            return (
                                <View key={String(item?.id ?? idx)} style={styles.logTile}>
                                    <View
                                        style={[
                                            styles.logIconWrap,
                                            { backgroundColor: accentColor + "1A" },
                                        ]}
                                    >
                                        <Text style={[styles.logIconText, { color: accentColor }]}>
                                            {mealLog ? "🍽" : isEntry ? "→" : "←"}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.logTitle}>
                                            {mealLog
                                                ? `Meal availed no. ${mealNo ?? "-"}`
                                                : isEntry
                                                    ? `Entry — ${formatGateLabel(item?.gate ?? item?.gateLabel)}`
                                                    : `Exit — ${formatGateLabel(item?.gate ?? item?.gateLabel)}`}
                                        </Text>
                                        <Text style={styles.logMeta}>
                                            {formatTime(stamp)}
                                        </Text>
                                    </View>
                                    <View style={styles.passBadge}>
                                        <Text style={styles.passBadgeText}>PASS</Text>
                                    </View>
                                </View>
                            )
                        })
                    )}
                </ScrollView>

                {/* Late Return Modal */}
                <Modal visible={showLateModal} transparent animationType="fade">
                    <View style={styles.modalBackdrop}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                            <View style={styles.modalCard}>
                                <Text style={styles.modalTitle}>I'll Be Late</Text>

                                <TextInput
                                    value={etaMinutes}
                                    onChangeText={setEtaMinutes}
                                    keyboardType="number-pad"
                                    style={styles.modalInput}
                                    placeholder="ETA in minutes (e.g. 30)"
                                    placeholderTextColor={APP_THEME.muted}
                                />
                                <TextInput
                                    value={lateReason}
                                    onChangeText={setLateReason}
                                    style={[styles.modalInput, { height: 88, textAlignVertical: "top" }]}
                                    placeholder="Reason (min 5 chars)"
                                    placeholderTextColor={APP_THEME.muted}
                                    multiline
                                />

                                <View style={styles.locationNote}>
                                    <Text style={styles.locationNoteIcon}>📍</Text>
                                    <Text style={styles.locationNoteText}>Your current location will be shared.</Text>
                                </View>

                                <View style={styles.modalActions}>
                                    <Pressable
                                        style={styles.modalCancelBtn}
                                        onPress={() => setShowLateModal(false)}
                                    >
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </Pressable>
                                    <Pressable onPress={onSubmitLateReturn} disabled={lateLoading}>
                                        <LinearGradient
                                            colors={[APP_THEME.warning, "#FF9100"]}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                            style={styles.modalSubmitBtn}
                                        >
                                            {lateLoading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.modalSubmitText}>Send Request</Text>
                                            )}
                                        </LinearGradient>
                                    </Pressable>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </Modal>
            </View>
        </TouchableWithoutFeedback>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    content: { padding: 20, paddingBottom: 120 },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: APP_THEME.bg,
    },

    // ── Header ──
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
    },
    welcomeText: {
        color: APP_THEME.muted,
        fontSize: 14,
        fontWeight: "400",
    },
    userName: {
        color: APP_THEME.text,
        fontSize: 28,
        fontWeight: "800",
        letterSpacing: -0.5,
        marginTop: 4,
    },
    logoutBtn: {
        backgroundColor: APP_THEME.glassBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    logoutIcon: {
        fontSize: 18,
        color: APP_THEME.danger,
        fontWeight: "900",
    },

    // ── Status Card ──
    statusCard: {
        borderRadius: 22,
        borderWidth: 1,
        overflow: "hidden",
        marginBottom: 20,
    },
    statusCardInner: {
        padding: 22,
    },
    statusIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    statusIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    statusIconText: { fontSize: 20, fontWeight: "900" },
    statusLabel: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        fontWeight: "500",
    },
    statusValue: {
        fontSize: 26,
        fontWeight: "800",
        letterSpacing: 1,
        marginTop: 16,
    },
    statusMeta: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 13,
        marginTop: 6,
    },

    statusMeta: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 13,
        marginTop: 6,
    },

    // ── Quick Actions ──
    sectionTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 14,
    },
    actionRow: {
        flexDirection: "row",
        gap: 14,
        marginBottom: 12,
    },
    actionCardGradientWrap: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    actionCardGradient: {
        height: 120,
        padding: 16,
        justifyContent: "space-between",
    },
    actionCardGlass: {
        flex: 1,
        height: 120,
        padding: 16,
        justifyContent: "space-between",
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    actionCardIcon: { fontSize: 30, color: APP_THEME.text },
    actionCardTitle: {
        color: APP_THEME.text,
        fontSize: 15,
        fontWeight: "700",
    },

    // ── Late Return ──
    lateReturnBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: APP_THEME.warning + "66",
        paddingVertical: 14,
        marginBottom: 28,
    },
    lateReturnIcon: { fontSize: 16, color: APP_THEME.warning },
    lateReturnText: {
        color: APP_THEME.warning,
        fontWeight: "600",
        fontSize: 13,
    },

    // ── Recent Activity ──
    sectionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    viewAllText: {
        color: APP_THEME.accent,
        fontWeight: "600",
        fontSize: 13,
    },
    emptyText: {
        color: "rgba(255,255,255,0.35)",
        textAlign: "center",
        paddingVertical: 24,
    },

    logTile: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        padding: 14,
        marginBottom: 10,
    },
    logIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    logIconText: { fontSize: 18, fontWeight: "900" },
    logTitle: {
        color: APP_THEME.text,
        fontWeight: "600",
        fontSize: 14,
    },
    logMeta: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 12,
        marginTop: 2,
    },
    passBadge: {
        backgroundColor: APP_THEME.success + "1A",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    passBadgeText: {
        color: APP_THEME.success,
        fontSize: 10,
        fontWeight: "800",
    },

    // ── Modal ──
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
    locationNote: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: APP_THEME.warning + "14",
        borderWidth: 1,
        borderColor: APP_THEME.warning + "33",
    },
    locationNoteIcon: { fontSize: 16 },
    locationNoteText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        flex: 1,
    },
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
        color: APP_THEME.bg,
        fontWeight: "700",
    },
})
