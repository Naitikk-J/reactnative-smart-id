import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
import { APP_THEME } from "../config/constants"
import { getPersonalLogs } from "../services/scanService"

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
                return (
                    <View style={styles.card}>
                        <Text style={styles.title}>{String(item?.direction ?? item?.scanType ?? "SCAN")}</Text>
                        <Text style={styles.line}>Gate: {String(item?.gateLabel ?? item?.gate ?? "-")}</Text>
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
