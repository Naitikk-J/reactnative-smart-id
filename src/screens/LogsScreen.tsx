import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
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
    if (!gate.includes("•")) return gate
    return gate.split("•")[0].trim() || gate
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
        <FlatList
            style={styles.container}
            contentContainerStyle={styles.content}
            data={items}
            keyExtractor={(item, index) => String(item?.id ?? index)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
            ListEmptyComponent={<Text style={styles.empty}>No logs found</Text>}
            renderItem={({ item }) => {
                const timestamp = item?.time ?? item?.scannedAt ?? item?.timestamp
                const mealLog = isMealLog(item)
                const mealNo = extractMealNo(item)
                const title = mealLog
                    ? `Meal availed no. ${mealNo ?? "-"}`
                    : String(item?.direction ?? item?.scanType ?? "SCAN")

                return (
                    <View style={styles.card}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.line}>
                            {mealLog
                                ? `Event: ${extractEventName(item)}`
                                : `Gate: ${String(item?.gateLabel ?? item?.gate ?? "-")}`}
                        </Text>
                        <Text style={styles.line}>Time: {timestamp ? new Date(timestamp).toLocaleString() : "-"}</Text>
                        <Text style={styles.line}>Result: {String(item?.result ?? "-")}</Text>
                    </View>
                )
            }}
        />
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_THEME.bg },
    content: { padding: 14, gap: 10 },
    center: { flex: 1, backgroundColor: APP_THEME.bg, justifyContent: "center", alignItems: "center" },
    card: {
        backgroundColor: APP_THEME.card,
        borderWidth: 1,
        borderColor: APP_THEME.border,
        borderRadius: 12,
        padding: 12,
        gap: 4,
    },
    title: { color: APP_THEME.text, fontWeight: "700" },
    line: { color: APP_THEME.muted, fontSize: 13 },
    empty: { color: APP_THEME.muted, textAlign: "center", marginTop: 50 },
})
