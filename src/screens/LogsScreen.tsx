import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { APP_THEME } from "../config/constants"
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

function extractEventName(item: any): string {
    const gate = String(item?.gateLabel ?? item?.gate ?? "").trim()
    if (!gate) return "-"
    if (!gate.includes("•")) return formatGateLabel(gate)
    return formatGateLabel(gate.split("•")[0].trim()) || gate
}

function formatGateLabel(gate?: string): string {
    if (!gate) return "-"
    return gate.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTime(time: any): string {
    if (!time) return "-"
    const dt = new Date(time)
    if (isNaN(dt.getTime())) return "-"
    return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" }) +
        ", " +
        dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })
}

function hideBackendIds(value?: string): string {
    if (!value) return ""
    return value.replace(/\b[a-fA-F0-9]{24}\b/g, "[hidden]")
}

export default function LogsScreen() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadLogs = useCallback(async () => {
        const logs = await getPersonalLogs(50)
        setItems(logs)
    }, [])

    useEffect(() => {
        loadLogs().finally(() => setLoading(false))
    }, [loadLogs])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadLogs()
        setRefreshing(false)
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
            <FlatList
                contentContainerStyle={styles.content}
                data={items}
                keyExtractor={(item, index) => String(item?.id ?? index)}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyIcon}>▤</Text>
                        <Text style={styles.emptyTitle}>No recent activity found.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const timestamp = item?.time ?? item?.scannedAt ?? item?.timestamp
                    const mealLog = isMealLog(item)
                    const mealNo = extractMealNo(item)
                    const isEntry = String(item?.direction ?? "").toUpperCase() === "ENTRY"
                    const resultCode = String(item?.result ?? "VERIFIED").toUpperCase()
                    const isSuccess =
                        resultCode === "VERIFIED" || resultCode === "SUCCESS" || resultCode === "MEAL_CONFIRMED"

                    const accentColor = mealLog
                        ? APP_THEME.accent
                        : isEntry
                          ? APP_THEME.success
                          : APP_THEME.warning

                    const title = mealLog
                        ? `Meal availed no. ${mealNo ?? "-"}`
                        : isEntry
                          ? "Hostel Entry"
                          : "Hostel Exit"

                    const subtitle = mealLog
                        ? `Event: ${extractEventName(item)}`
                        : formatGateLabel(item?.gate ?? item?.gateLabel)

                    return (
                        <View style={styles.logTile}>
                            <View style={[styles.logIconWrap, { backgroundColor: accentColor + "1A" }]}>
                                <Text style={[styles.logIconText, { color: accentColor }]}>
                                    {mealLog ? "🍽" : isEntry ? "→" : "←"}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.logTitle}>{title}</Text>
                                <Text style={styles.logSubtitle}>{subtitle}</Text>
                            </View>
                            <View style={styles.logRight}>
                                <Text style={styles.logTime}>{formatTime(timestamp)}</Text>
                                <View
                                    style={[
                                        styles.resultBadge,
                                        {
                                            backgroundColor: isSuccess
                                                ? APP_THEME.success + "1A"
                                                : APP_THEME.danger + "1A",
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.resultBadgeText,
                                            { color: isSuccess ? APP_THEME.success : APP_THEME.danger },
                                        ]}
                                    >
                                        {hideBackendIds(String(item?.result ?? "VERIFIED"))}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )
                }}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    center: {
        flex: 1,
        backgroundColor: APP_THEME.bg,
        justifyContent: "center",
        alignItems: "center",
    },
    content: { padding: 20, paddingBottom: 100, gap: 12 },

    emptyWrap: {
        alignItems: "center",
        marginTop: 80,
    },
    emptyIcon: {
        fontSize: 48,
        color: "rgba(255,255,255,0.1)",
        marginBottom: 16,
    },
    emptyTitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 15,
    },

    logTile: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        padding: 18,
    },
    logIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    logIconText: { fontSize: 20, fontWeight: "900" },
    logTitle: {
        color: APP_THEME.text,
        fontSize: 15,
        fontWeight: "600",
    },
    logSubtitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginTop: 3,
    },
    logRight: {
        alignItems: "flex-end",
        gap: 6,
    },
    logTime: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontWeight: "500",
    },
    resultBadge: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    resultBadgeText: {
        fontSize: 10,
        fontWeight: "800",
    },
})
