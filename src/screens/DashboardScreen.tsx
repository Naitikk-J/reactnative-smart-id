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
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.welcome}>Welcome back</Text>
                    <Text style={styles.userName}>{user?.name ?? "Student"}</Text>
                    <Text style={styles.userMeta}>{user?.email}</Text>
                    <Text style={styles.userMeta}>Role: {user?.role}</Text>
                </View>
                <Pressable onPress={logout} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>Logout</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Status</Text>
                <Text style={styles.statusText}>{statusText}</Text>
                <Text style={styles.mutedText}>Recent logs: {logs.length}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Quick Summary</Text>
                <Text style={styles.mutedText}>Unread alerts: {alertsCount}</Text>
                <Text style={styles.mutedText}>
                    Latest pink slip: {latestPinkSlip ? String(latestPinkSlip.status ?? "PENDING") : "None"}
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Late Return</Text>
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
    content: { padding: 16, gap: 12 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: APP_THEME.bg },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    welcome: { color: APP_THEME.muted, fontSize: 13 },
    userName: { color: APP_THEME.text, fontSize: 24, fontWeight: "700" },
    userMeta: { color: APP_THEME.muted, fontSize: 12 },
    card: {
        backgroundColor: APP_THEME.card,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    cardTitle: { color: APP_THEME.text, fontWeight: "700", fontSize: 16 },
    statusText: { color: APP_THEME.accent, fontWeight: "700", fontSize: 18 },
    mutedText: { color: APP_THEME.muted },
    input: {
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        color: APP_THEME.text,
        backgroundColor: "#0d1a30",
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        paddingHorizontal: 14,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "700" },
    secondaryBtn: {
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        paddingHorizontal: 14,
    },
    secondaryBtnText: { color: APP_THEME.text, fontWeight: "600" },
})
