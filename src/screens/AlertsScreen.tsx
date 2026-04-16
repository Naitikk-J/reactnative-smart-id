import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
import { APP_THEME } from "../config/constants"
import { getMyAlerts } from "../services/alertService"

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
        <FlatList
            style={styles.container}
            contentContainerStyle={styles.content}
            data={items}
            keyExtractor={(item, index) => String(item?.id ?? index)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
            ListEmptyComponent={<Text style={styles.empty}>No alerts</Text>}
            renderItem={({ item }) => {
                return (
                    <View style={styles.card}>
                        <Text style={styles.title}>{String(item?.title ?? "Alert")}</Text>
                        <Text style={styles.body}>{String(item?.message ?? item?.body ?? "")}</Text>
                        <Text style={styles.time}>{item?.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</Text>
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
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 6,
    },
    title: { color: APP_THEME.text, fontWeight: "700" },
    body: { color: APP_THEME.muted, fontSize: 13 },
    time: { color: APP_THEME.muted, fontSize: 11 },
    empty: { color: APP_THEME.muted, textAlign: "center", marginTop: 20 },
})
