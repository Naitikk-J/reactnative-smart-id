import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import * as Location from "expo-location"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { getMyAlerts } from "../services/alertService"
import { submitLateReturnRequest } from "../services/lateReturnService"
import { getMyPinkSlips } from "../services/pinkSlipService"
import { getPersonalLogs } from "../services/scanService"

export default function DashboardScreen() {
    const { user, logout } = useAuth()
    const [logs, setLogs] = useState<any[]>([])
    const [alertsCount, setAlertsCount] = useState(0)
    const [latestPinkSlip, setLatestPinkSlip] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const [showLateReturnForm, setShowLateReturnForm] = useState(false)
    const [etaMinutes, setEtaMinutes] = useState("30")
    const [lateReason, setLateReason] = useState("")
    const [lateLoading, setLateLoading] = useState(false)

    const loadData = useCallback(async () => {
        const [nextLogs, nextAlerts, nextSlips] = await Promise.all([
            getPersonalLogs(3),
            getMyAlerts(20),
            getMyPinkSlips(),
        ])

        setLogs(nextLogs)
        setAlertsCount(nextAlerts.length)
        setLatestPinkSlip(nextSlips.length > 0 ? nextSlips[0] : null)
    }, [])

    useEffect(() => {
        loadData().finally(() => setLoading(false))
    }, [loadData])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

    const statusText = useMemo(() => {
        const last = logs[0]
        if (!last) return "INSIDE HOSTEL"
        return String(last.direction).toUpperCase() === "ENTRY" ? "INSIDE HOSTEL" : "OUTSIDE HOSTEL"
    }, [logs])

    const isInsideHostel = statusText === "INSIDE HOSTEL"
    const recentLogItems = logs.slice(0, 3)

    const onSubmitLateReturn = async () => {
        setLateLoading(true)

        const minutes = Number(etaMinutes)
        if (!Number.isFinite(minutes) || minutes <= 0) {
            setLateLoading(false)
            Alert.alert("Invalid", "ETA minutes should be > 0")
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

        setShowLateReturnForm(false)
        setLateReason("")
        Alert.alert("Submitted", "Late return request sent")
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
        >
            <View style={styles.heroCard}>
                <View style={styles.headerRow}>
                    <View style={styles.headerContent}>
                        <Text style={styles.welcome}>Resident Dashboard</Text>
                        <Text style={styles.userName}>{user?.name ?? "Student"}</Text>
                        <Text style={styles.userMeta}>{user?.email}</Text>
                    </View>
                    <Pressable onPress={logout} style={styles.secondaryBtn}>
                        <Text style={styles.secondaryBtnText}>Logout</Text>
                    </Pressable>
                </View>

                <View style={styles.statusPillWrap}>
                    <View style={[styles.statusDot, isInsideHostel ? styles.statusDotInside : styles.statusDotOutside]} />
                    <Text style={styles.statusPillText}>{statusText}</Text>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statTile}>
                        <Text style={styles.statValue}>{alertsCount}</Text>
                        <Text style={styles.statLabel}>Unread Alerts</Text>
                    </View>
                    <View style={styles.statTile}>
                        <Text style={styles.statValue}>{logs.length}</Text>
                        <Text style={styles.statLabel}>Recent Scans</Text>
                    </View>
                    <View style={styles.statTile}>
                        <Text style={styles.statValue}>{latestPinkSlip ? String(latestPinkSlip.status ?? "PENDING") : "None"}</Text>
                        <Text style={styles.statLabel}>Latest Slip</Text>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent Activity</Text>
                {recentLogItems.length === 0 ? (
                    <Text style={styles.mutedText}>No movement logs yet.</Text>
                ) : (
                    recentLogItems.map((item: any, idx: number) => {
                        const stamp = item?.time ?? item?.scannedAt ?? item?.timestamp
                        const direction = String(item?.direction ?? item?.scanType ?? "SCAN").toUpperCase()
                        return (
                            <View key={String(item?.id ?? idx)} style={styles.activityRow}>
                                <View style={[styles.activityMarker, direction === "ENTRY" ? styles.activityEntry : styles.activityExit]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.activityTitle}>{direction}</Text>
                                    <Text style={styles.activityMeta}>{stamp ? new Date(stamp).toLocaleString() : "-"}</Text>
                                </View>
                            </View>
                        )
                    })
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Late Return</Text>
                <Text style={styles.helperText}>Share ETA and reason so wardens are informed in real-time.</Text>
                {!showLateReturnForm ? (
                    <Pressable style={styles.primaryBtn} onPress={() => setShowLateReturnForm(true)}>
                        <Text style={styles.primaryBtnText}>I will be late</Text>
                    </Pressable>
                ) : (
                    <View style={{ gap: 10 }}>
                        <TextInput
                            value={etaMinutes}
                            onChangeText={setEtaMinutes}
                            keyboardType="number-pad"
                            style={styles.input}
                            placeholder="ETA in minutes"
                            placeholderTextColor={APP_THEME.muted}
                        />
                        <TextInput
                            value={lateReason}
                            onChangeText={setLateReason}
                            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                            placeholder="Reason"
                            placeholderTextColor={APP_THEME.muted}
                            multiline
                        />
                        <View style={styles.buttonRow}>
                            <Pressable style={styles.secondaryBtn} onPress={() => setShowLateReturnForm(false)}>
                                <Text style={styles.secondaryBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.primaryBtn} onPress={onSubmitLateReturn} disabled={lateLoading}>
                                {lateLoading ? <ActivityIndicator color={APP_THEME.bg} /> : <Text style={styles.primaryBtnText}>Send</Text>}
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_THEME.bg },
    content: { padding: 16, gap: 14, paddingBottom: 120 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: APP_THEME.bg },
    heroCard: {
        backgroundColor: APP_THEME.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        padding: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    headerContent: { flex: 1, gap: 2 },
    welcome: { color: APP_THEME.muted, fontSize: 12, letterSpacing: 0.7, textTransform: "uppercase", fontWeight: "700" },
    userName: { color: APP_THEME.text, fontSize: 26, fontWeight: "800", lineHeight: 32 },
    userMeta: { color: APP_THEME.muted, fontSize: 12 },
    statusPillWrap: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: "rgba(7,18,38,0.55)",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    statusDot: { width: 8, height: 8, borderRadius: 999 },
    statusDotInside: { backgroundColor: APP_THEME.accent },
    statusDotOutside: { backgroundColor: APP_THEME.warning },
    statusPillText: { color: APP_THEME.text, fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
    statsGrid: { flexDirection: "row", gap: 10 },
    statTile: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(8,20,44,0.76)",
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 70,
    },
    statValue: { color: APP_THEME.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
    statLabel: { color: APP_THEME.muted, fontSize: 11, marginTop: 3, textAlign: "center" },
    card: {
        backgroundColor: APP_THEME.card,
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        gap: 10,
    },
    cardTitle: { color: APP_THEME.text, fontWeight: "800", fontSize: 16 },
    mutedText: { color: APP_THEME.muted, fontSize: 13 },
    helperText: { color: APP_THEME.muted, fontSize: 12, lineHeight: 18 },
    activityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 12,
        padding: 10,
        backgroundColor: "rgba(4,12,28,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    activityMarker: { width: 10, height: 10, borderRadius: 999 },
    activityEntry: { backgroundColor: APP_THEME.accent },
    activityExit: { backgroundColor: APP_THEME.warning },
    activityTitle: { color: APP_THEME.text, fontWeight: "700", fontSize: 13 },
    activityMeta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2 },
    input: {
        borderColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderRadius: 12,
        color: APP_THEME.text,
        backgroundColor: "rgba(3,10,24,0.55)",
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 16,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "800" },
    secondaryBtn: {
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 16,
    },
    secondaryBtnText: { color: APP_THEME.text, fontWeight: "700" },
})
