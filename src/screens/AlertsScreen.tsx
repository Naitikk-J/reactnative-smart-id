import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { APP_THEME } from "../config/constants"
import { getMyAlerts } from "../services/alertService"

function formatTime(time: any): string {
    if (!time) return ""
    const dt = new Date(time)
    if (isNaN(dt.getTime())) return ""
    return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" }) +
        ", " +
        dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })
}

function alertAccent(title?: string): string {
    const t = String(title ?? "").toUpperCase()
    if (t.includes("WARN") || t.includes("LATE") || t.includes("OVERDUE")) return APP_THEME.warning
    if (t.includes("DENIED") || t.includes("REJECT") || t.includes("FAIL")) return APP_THEME.danger
    if (t.includes("APPROVE") || t.includes("SUCCESS")) return APP_THEME.success
    return APP_THEME.accent
}

export default function AlertsScreen() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadItems = useCallback(async () => {
        const alerts = await getMyAlerts(50)
        setItems(alerts)
    }, [])

    useEffect(() => {
        loadItems().finally(() => setLoading(false))
    }, [loadItems])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadItems()
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
                        <Text style={styles.emptyIcon}>⚑</Text>
                        <Text style={styles.emptyTitle}>No alerts yet</Text>
                        <Text style={styles.emptySub}>You're all caught up!</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const color = alertAccent(item?.title)
                    return (
                        <View style={[styles.alertTile, { borderLeftColor: color }]}>
                            <View style={[styles.alertDot, { backgroundColor: color, shadowColor: color }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.alertTitle}>{String(item?.title ?? "Alert")}</Text>
                                <Text style={styles.alertBody}>{String(item?.message ?? item?.body ?? "")}</Text>
                                <Text style={styles.alertTime}>{formatTime(item?.createdAt)}</Text>
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
    center: { flex: 1, backgroundColor: APP_THEME.bg, justifyContent: "center", alignItems: "center" },
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
        color: "rgba(255,255,255,0.5)",
        fontSize: 18,
        fontWeight: "700",
    },
    emptySub: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 13,
        marginTop: 4,
    },

    alertTile: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        borderLeftWidth: 3,
        padding: 18,
    },
    alertDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        marginTop: 4,
        shadowOpacity: 0.6,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
    },
    alertTitle: {
        color: APP_THEME.text,
        fontWeight: "600",
        fontSize: 15,
    },
    alertBody: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 13,
        marginTop: 4,
        lineHeight: 18,
    },
    alertTime: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 11,
        marginTop: 6,
    },
})
