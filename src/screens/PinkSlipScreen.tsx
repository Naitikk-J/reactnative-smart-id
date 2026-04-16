import React, { useCallback, useEffect, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import { APP_THEME } from "../config/constants"
import { createPinkSlip, getMyPinkSlips } from "../services/pinkSlipService"

export default function PinkSlipScreen() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [reason, setReason] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [submitLoading, setSubmitLoading] = useState(false)

    const loadItems = useCallback(async () => {
        const slips = await getMyPinkSlips()
        setItems(slips)
    }, [])

    useEffect(() => {
        loadItems().finally(() => setLoading(false))
    }, [loadItems])

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
        Alert.alert("Success", "Pink slip created")
        await loadItems()
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.formCard}>
                <Text style={styles.formTitle}>Create Pink Slip</Text>
                <TextInput
                    value={reason}
                    onChangeText={setReason}
                    style={[styles.input, { height: 72, textAlignVertical: "top" }]}
                    multiline
                    placeholder="Reason"
                    placeholderTextColor={APP_THEME.muted}
                />
                <TextInput
                    value={fromDate}
                    onChangeText={setFromDate}
                    style={styles.input}
                    placeholder="From Date (YYYY-MM-DD)"
                    placeholderTextColor={APP_THEME.muted}
                />
                <TextInput
                    value={toDate}
                    onChangeText={setToDate}
                    style={styles.input}
                    placeholder="To Date (YYYY-MM-DD)"
                    placeholderTextColor={APP_THEME.muted}
                />
                <Pressable style={styles.primaryBtn} onPress={onCreate} disabled={submitLoading}>
                    {submitLoading ? <ActivityIndicator color={APP_THEME.bg} /> : <Text style={styles.primaryBtnText}>Submit</Text>}
                </Pressable>
            </View>

            <FlatList
                data={items}
                keyExtractor={(item, index) => String(item?.id ?? index)}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />}
                ListEmptyComponent={<Text style={styles.empty}>No pink slips</Text>}
                renderItem={({ item }) => (
                    <View style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{String(item?.status ?? "PENDING")}</Text>
                        <Text style={styles.itemLine}>Reason: {String(item?.reason ?? "-")}</Text>
                        <Text style={styles.itemLine}>From: {item?.fromDate ? new Date(item.fromDate).toLocaleDateString() : "-"}</Text>
                        <Text style={styles.itemLine}>To: {item?.toDate ? new Date(item.toDate).toLocaleDateString() : "-"}</Text>
                    </View>
                )}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_THEME.bg },
    center: { flex: 1, backgroundColor: APP_THEME.bg, justifyContent: "center", alignItems: "center" },
    formCard: {
        margin: 12,
        backgroundColor: APP_THEME.card,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    formTitle: { color: APP_THEME.text, fontSize: 16, fontWeight: "700" },
    input: {
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        color: APP_THEME.text,
        backgroundColor: "#0d1a30",
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "700" },
    listContent: { paddingHorizontal: 12, paddingBottom: 20, gap: 10 },
    itemCard: {
        backgroundColor: APP_THEME.card,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        gap: 4,
    },
    itemTitle: { color: APP_THEME.text, fontWeight: "700" },
    itemLine: { color: APP_THEME.muted, fontSize: 13 },
    empty: { color: APP_THEME.muted, textAlign: "center", marginTop: 20 },
})
