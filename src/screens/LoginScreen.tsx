import React, { useEffect, useRef, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { LinearGradient } from "expo-linear-gradient"

export default function LoginScreen() {
    const { login, googleSignIn: loginGoogle, submitRebindRequest } = useAuth()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [obscurePassword, setObscurePassword] = useState(true)

    const [showRebind, setShowRebind] = useState(false)
    const [rebindEmail, setRebindEmail] = useState("")
    const [rebindReason, setRebindReason] = useState("")
    const [rebindLoading, setRebindLoading] = useState(false)

    const fadeAnim = useRef(new Animated.Value(0)).current
    const slideAnim = useRef(new Animated.Value(30)).current

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]).start()
    }, [])

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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.root}>
                <LinearGradient
                    colors={["#0A0E21", "#0F1535", "#141A3A", "#0A0E21"]}
                    locations={[0, 0.3, 0.7, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Decorative gradient orbs */}
                <View style={styles.orbCyan} />
                <View style={styles.orbPurple} />

                <SafeAreaView style={styles.safe}>
                    <KeyboardAvoidingView
                        behavior={Platform.select({ ios: "padding", default: undefined })}
                        style={styles.container}
                    >
                        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                            {/* Logo */}
                            <View style={styles.logoWrap}>
                                <LinearGradient
                                    colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.logoGradient}
                                >
                                    <Text style={styles.logoIcon}>⊡</Text>
                                </LinearGradient>
                            </View>

                            {/* Titles */}
                            <Text style={styles.title}>Smart ID</Text>
                            <Text style={styles.subtitle}>Sign in to access your portal</Text>

                            {/* Login Card — Glass */}
                            <View style={styles.glassCard}>
                                <Text style={styles.fieldLabel}>Email</Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    placeholder="student@mits.local"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    style={styles.input}
                                />

                                <View style={{ height: 20 }} />

                                <Text style={styles.fieldLabel}>Password</Text>
                                <View style={styles.passwordRow}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={obscurePassword}
                                        placeholder="••••••••"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        style={[styles.input, { flex: 1 }]}
                                    />
                                    <Pressable
                                        onPress={() => setObscurePassword(!obscurePassword)}
                                        style={styles.eyeBtn}
                                    >
                                        <Text style={styles.eyeIcon}>{obscurePassword ? "◌" : "◉"}</Text>
                                    </Pressable>
                                </View>

                                {error ? (
                                    <View style={styles.errorBox}>
                                        <Text style={styles.errorIcon}>!</Text>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                ) : null}

                                <View style={{ height: 28 }} />

                                {/* Gradient Login Button */}
                                <Pressable onPress={onLogin} disabled={isLoading}>
                                    <LinearGradient
                                        colors={isLoading ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : [APP_THEME.accent, APP_THEME.accentPurple]}
                                        start={{ x: 0, y: 0.5 }}
                                        end={{ x: 1, y: 0.5 }}
                                        style={styles.gradientBtn}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.gradientBtnText}>Login</Text>
                                        )}
                                    </LinearGradient>
                                </Pressable>

                                <View style={{ height: 12 }} />

                                {/* Google Sign-In Button */}
                                <Pressable onPress={async () => {
                                    setIsLoading(true)
                                    setError(null)
                                    const outcome = await loginGoogle()
                                    setIsLoading(false)
                                    if (!outcome.ok) {
                                        setError(outcome.error ?? "Google login failed")
                                    }
                                }} disabled={isLoading}>
                                    <LinearGradient
                                        colors={isLoading ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : ["#DB4437", "#C53829"]}
                                        start={{ x: 0, y: 0.5 }}
                                        end={{ x: 1, y: 0.5 }}
                                        style={styles.gradientBtn}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.gradientBtnText}>Sign in with Google</Text>
                                        )}
                                    </LinearGradient>
                                </Pressable>

                                <View style={{ height: 12 }} />

                                {/* Rebind Request Button */}
                                <Pressable
                                    onPress={() => {
                                        setRebindEmail(email)
                                        setShowRebind(true)
                                    }}
                                    style={styles.rebindBtn}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.rebindBtnText}>Rebind Request</Text>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </SafeAreaView>

                {/* Rebind Modal */}
                <Modal visible={showRebind} animationType="slide" transparent>
                    <View style={styles.modalBackdrop}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                                    <Pressable onPress={() => setShowRebind(false)} style={styles.modalCancelBtn}>
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </Pressable>
                                    <Pressable onPress={onSubmitRebind} disabled={rebindLoading}>
                                        <LinearGradient
                                            colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                            style={styles.modalSubmitBtn}
                                        >
                                            {rebindLoading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.modalSubmitText}>Submit</Text>
                                            )}
                                        </LinearGradient>
                                    </Pressable>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </Modal>
            </View>
        </TouchableWithoutFeedback>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    safe: { flex: 1 },
    container: { flex: 1, justifyContent: "center", padding: 24 },

    orbCyan: {
        position: "absolute",
        width: 250,
        height: 250,
        borderRadius: 999,
        backgroundColor: "rgba(0,212,255,0.15)",
        top: -80,
        right: -60,
    },
    orbPurple: {
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: 999,
        backgroundColor: "rgba(123,97,255,0.12)",
        bottom: -100,
        left: -80,
    },

    logoWrap: {
        alignSelf: "center",
        marginBottom: 32,
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.4,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
    },
    logoGradient: {
        width: 88,
        height: 88,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    logoIcon: {
        fontSize: 44,
        color: "#fff",
        fontWeight: "900",
    },

    title: {
        color: APP_THEME.text,
        fontSize: 36,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: -1,
    },
    subtitle: {
        color: APP_THEME.muted,
        fontSize: 15,
        textAlign: "center",
        marginTop: 8,
        marginBottom: 40,
    },

    glassCard: {
        backgroundColor: APP_THEME.glassBg,
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },

    fieldLabel: {
        color: "rgba(255,255,255,0.6)",
        fontWeight: "600",
        fontSize: 13,
        marginBottom: 8,
    },

    input: {
        borderColor: APP_THEME.glassBorder,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: APP_THEME.text,
        backgroundColor: "rgba(255,255,255,0.05)",
        fontSize: 15,
        fontWeight: "500",
    },

    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    eyeBtn: {
        position: "absolute",
        right: 14,
        padding: 4,
    },
    eyeIcon: {
        color: "rgba(255,255,255,0.38)",
        fontSize: 18,
    },

    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "rgba(255,82,82,0.1)",
        borderColor: "rgba(255,82,82,0.3)",
        borderWidth: 1,
    },
    errorIcon: {
        color: APP_THEME.danger,
        fontSize: 16,
        fontWeight: "900",
        marginRight: 8,
    },
    errorText: {
        color: APP_THEME.danger,
        fontSize: 13,
        flex: 1,
    },

    gradientBtn: {
        borderRadius: 16,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    gradientBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    rebindBtn: {
        borderColor: "rgba(123,97,255,0.5)",
        borderWidth: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        height: 50,
    },
    rebindBtnText: {
        color: APP_THEME.accentPurple,
        fontWeight: "600",
        fontSize: 14,
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: APP_THEME.surfaceDark,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        padding: 20,
        gap: 12,
    },
    modalTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
    },
    modalActions: {
        flexDirection: "row",
        gap: 10,
        justifyContent: "flex-end",
        marginTop: 4,
    },
    modalCancelBtn: {
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        paddingHorizontal: 16,
    },
    modalCancelText: {
        color: "rgba(255,255,255,0.5)",
        fontWeight: "700",
    },
    modalSubmitBtn: {
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        paddingHorizontal: 20,
    },
    modalSubmitText: {
        color: "#fff",
        fontWeight: "700",
    },
})
