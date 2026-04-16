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
            <View style={styles.bgOrbOne} />
            <View style={styles.bgOrbTwo} />
            <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", default: undefined })} style={styles.container}>
                <View style={styles.card}>
                    <View style={styles.brandTag}>
                        <Text style={styles.brandTagText}>MITS SMART ID</Text>
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue your hostel access workflow</Text>

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

                    <Pressable onPress={onLogin} style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]} disabled={isLoading}>
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
    bgOrbOne: {
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: "rgba(34,110,255,0.22)",
        top: -40,
        right: -40,
    },
    bgOrbTwo: {
        position: "absolute",
        width: 180,
        height: 180,
        borderRadius: 999,
        backgroundColor: "rgba(22,214,163,0.18)",
        bottom: -30,
        left: -30,
    },
    card: {
        backgroundColor: APP_THEME.card,
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderRadius: 22,
        padding: 20,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 18,
    },
    brandTag: {
        alignSelf: "center",
        borderRadius: 999,
        backgroundColor: "rgba(22,214,163,0.14)",
        borderWidth: 1,
        borderColor: "rgba(22,214,163,0.28)",
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    brandTagText: {
        color: APP_THEME.accent,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.8,
    },
    title: { color: APP_THEME.text, fontSize: 30, fontWeight: "800", textAlign: "center" },
    subtitle: { color: APP_THEME.muted, textAlign: "center", marginBottom: 8, lineHeight: 20 },
    input: {
        borderColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: APP_THEME.text,
        backgroundColor: "rgba(3,10,24,0.55)",
    },
    error: { color: APP_THEME.danger, fontSize: 13, paddingHorizontal: 2 },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        paddingHorizontal: 14,
    },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 15 },
    secondaryBtn: {
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 46,
        paddingHorizontal: 14,
    },
    secondaryBtnText: { color: APP_THEME.text, fontWeight: "700" },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: APP_THEME.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        padding: 16,
        gap: 12,
    },
    modalTitle: { color: APP_THEME.text, fontSize: 18, fontWeight: "800" },
    modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
})
