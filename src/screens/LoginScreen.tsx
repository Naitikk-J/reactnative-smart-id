import React, { useState } from "react"
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"

export default function LoginScreen() {
    const { login, submitRebindRequest } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [showRebind, setShowRebind] = useState(false)
    const [rebindEmail, setRebindEmail] = useState("")
    const [rebindReason, setRebindReason] = useState("")
    const [rebindLoading, setRebindLoading] = useState(false)

    const onLogin = async () => {
        setIsLoading(true)
        setError(null)

        const outcome = await login(email, password)
        setIsLoading(false)

        if (!outcome.ok) {
            setError(outcome.error ?? "Login failed")
        }
    }

    const onSubmitRebind = async () => {
        setRebindLoading(true)
        const outcome = await submitRebindRequest(rebindEmail, rebindReason)
        setRebindLoading(false)

        if (outcome) {
            Alert.alert("Failed", outcome)
            return
        }

        setShowRebind(false)
        setRebindReason("")
        Alert.alert("Submitted", "Rebind request sent to admin")
    }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", default: undefined })} style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.title}>SMART ID</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>

                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="Email"
                        placeholderTextColor={APP_THEME.muted}
                        style={styles.input}
                    />

                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="Password"
                        placeholderTextColor={APP_THEME.muted}
                        style={styles.input}
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <Pressable onPress={onLogin} style={styles.primaryBtn} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={APP_THEME.bg} /> : <Text style={styles.primaryBtnText}>Login</Text>}
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            setRebindEmail(email)
                            setShowRebind(true)
                        }}
                        style={styles.secondaryBtn}
                    >
                        <Text style={styles.secondaryBtnText}>Request Device Rebind</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showRebind} animationType="slide" transparent>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Rebind Request</Text>
                        <TextInput
                            value={rebindEmail}
                            onChangeText={setRebindEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholder="Email"
                            placeholderTextColor={APP_THEME.muted}
                            style={styles.input}
                        />
                        <TextInput
                            value={rebindReason}
                            onChangeText={setRebindReason}
                            placeholder="Reason"
                            placeholderTextColor={APP_THEME.muted}
                            multiline
                            numberOfLines={3}
                            style={[styles.input, { height: 88, textAlignVertical: "top" }]}
                        />

                        <View style={styles.modalActions}>
                            <Pressable onPress={() => setShowRebind(false)} style={styles.secondaryBtn}>
                                <Text style={styles.secondaryBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={onSubmitRebind} style={styles.primaryBtn} disabled={rebindLoading}>
                                {rebindLoading ? <ActivityIndicator color={APP_THEME.bg} /> : <Text style={styles.primaryBtnText}>Submit</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: APP_THEME.bg },
    container: { flex: 1, justifyContent: "center", padding: 20 },
    card: {
        backgroundColor: APP_THEME.card,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 18,
        gap: 10,
    },
    title: { color: APP_THEME.text, fontSize: 28, fontWeight: "700", textAlign: "center" },
    subtitle: { color: APP_THEME.muted, textAlign: "center", marginBottom: 8 },
    input: {
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: APP_THEME.text,
        backgroundColor: "#0d1a30",
    },
    error: { color: APP_THEME.danger, fontSize: 13 },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 14,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "700" },
    secondaryBtn: {
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 14,
    },
    secondaryBtnText: { color: APP_THEME.text, fontWeight: "600" },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: APP_THEME.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: APP_THEME.border,
        padding: 16,
        gap: 10,
    },
    modalTitle: { color: APP_THEME.text, fontSize: 18, fontWeight: "700" },
    modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
})
