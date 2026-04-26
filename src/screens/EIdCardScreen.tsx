import React, { useCallback, useEffect, useRef, useState } from "react"
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useNavigation } from "@react-navigation/native"
import { APP_THEME } from "../config/constants"
import { useAuth } from "../context/AuthContext"
import { getEIdCardData, getDynamicQrToken } from "../services/profileService"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_MAX_WIDTH = 340

/** Maps the Prisma StudentType enum to a human-readable label */
function mapStudentType(raw: string): string {
    switch (raw.toUpperCase()) {
        case "DAY_SCHOLAR":
            return "Day Scholar"
        case "HOSTELLER_BOYS":
            return "Hosteller (Boys)"
        case "HOSTELLER_GIRLS":
            return "Hosteller (Girls)"
        default:
            return raw || "N/A"
    }
}

/** Extract a field from cardDetails first, then fallback to top-level data */
function field(data: Record<string, any> | null, key: string, fallback = "N/A"): string {
    if (!data) return fallback
    const details = data.cardDetails
    if (details && typeof details === "object" && details[key] != null && String(details[key]).trim()) {
        return String(details[key])
    }
    if (data[key] != null && String(data[key]).trim()) {
        return String(data[key])
    }
    return fallback
}

export default function EIdCardScreen() {
    const { user } = useAuth()
    const navigation = useNavigation<any>()
    const [cardData, setCardData] = useState<Record<string, any> | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    // Dynamic QR token state
    const [dynamicToken, setDynamicToken] = useState<string | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const loadCardData = useCallback(async () => {
        setError(null)
        try {
            const data = await getEIdCardData()
            setCardData(data)
            if (!data) setError("Failed to load ID card")
        } catch {
            setError("Failed to load ID card")
        }
    }, [])

    // Fetch dynamic QR token
    const fetchDynamicToken = useCallback(async () => {
        try {
            const token = await getDynamicQrToken()
            if (token) setDynamicToken(token)
        } catch {
            // Silent fail for QR rotation
        }
    }, [])

    // Start dynamic QR rotation every 5 seconds (matching Flutter)
    const startQrRotation = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        fetchDynamicToken() // Initial fetch
        timerRef.current = setInterval(fetchDynamicToken, 5000)
    }, [fetchDynamicToken])

    useEffect(() => {
        loadCardData().finally(() => {
            setLoading(false)
            startQrRotation()
        })
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [loadCardData, startQrRotation])

    const onRefresh = async () => {
        setRefreshing(true)
        await loadCardData()
        fetchDynamicToken()
        setRefreshing(false)
    }

    // Parse display values
    let rawName = field(cardData, "fullName", field(cardData, "name", user?.name ?? "Unknown"))
    let enrollmentNo = field(cardData, "enrollmentNo", user?.enrollmentNo ?? "N/A")

    // Fix Google Auth names like "24IR10NA46 Naitik" where enrollment is prepended
    if (rawName.includes(" ")) {
        const parts = rawName.split(" ")
        if (parts[0].length >= 9 && /[0-9]/.test(parts[0])) {
            if (enrollmentNo === "N/A" || !enrollmentNo) {
                enrollmentNo = parts[0].toUpperCase()
            }
            rawName = parts.slice(1).join(" ")
        }
    }

    if (enrollmentNo === "N/A" && user?.email) {
        enrollmentNo = user.email.split("@")[0].toUpperCase()
    }

    const displayName = rawName.toUpperCase()
    const fatherName = field(cardData, "fatherName", "—")
    const studentType = field(cardData, "studentType", "B.Tech.")
    const department = field(cardData, "department", user?.department ?? "N/A")
    const phone = field(cardData, "phone", field(cardData, "fatherMobile", "—"))
    const photoUrl = field(cardData, "photoUrl", user?.photoUrl ?? "")
    const courseLabel = mapStudentType(studentType)

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} size="large" />
            </View>
        )
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => { setLoading(true); loadCardData().finally(() => setLoading(false)) }}>
                    <LinearGradient
                        colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                        style={styles.retryBtn}
                    >
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </LinearGradient>
                </Pressable>
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

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.accent} />
                }
            >
                {/* ═════ Physical ID Card ═════ */}
                <View style={styles.cardOuter}>
                    {/* Red Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.logoCircle}>
                                <Text style={styles.logoCircleText}>🎓</Text>
                            </View>
                            <View style={styles.logoCircle}>
                                <Text style={styles.logoCircleText}>🏛</Text>
                            </View>
                        </View>
                        <Text style={styles.collegeName}>
                            MADHAV INSTITUTE OF TECHNOLOGY & SCIENCE, GWALIOR
                        </Text>
                        <Text style={styles.collegeSubtitle}>DEEMED UNIVERSITY</Text>
                        <Text style={styles.collegeAccr}>NAAC ACCREDITED WITH A++ GRADE</Text>
                    </View>

                    {/* Body */}
                    <View style={styles.cardBody}>
                        {/* Photo */}
                        <View style={styles.photoWrap}>
                            {photoUrl && photoUrl.startsWith("http") ? (
                                <Image source={{ uri: photoUrl }} style={styles.photo} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Text style={styles.photoPlaceholderText}>
                                        {(user?.name ?? "?").charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Name */}
                        <Text style={styles.cardName}>{displayName}</Text>

                        {/* Detail rows */}
                        <CardDetailRow label="Father's Name" value={`: ${fatherName}`} />
                        <CardDetailRow label="Enrollment No." value={`: ${enrollmentNo}`} highlight />
                        <CardDetailRow label="Course" value={`: ${courseLabel}`} />
                        <CardDetailRow label="Branch" value={`: ${department}`} />
                        <CardDetailRow label="Mobile No." value={`: ${phone}`} />
                    </View>

                    {/* Signatures */}
                    <View style={styles.signaturesRow}>
                        <Text style={styles.validText}>Valid upto- June 2028</Text>
                        <View style={styles.signatureLine}>
                            <View style={styles.signatureDivider} />
                            <Text style={styles.signatureLabel}>Dean Student Welfare</Text>
                        </View>
                    </View>

                    {/* Red Footer */}
                    <View style={styles.cardFooter}>
                        <Text style={styles.cardFooterText}>IDENTITY CARD</Text>
                    </View>
                </View>

                {/* ═════ Additional Info + QR ═════ */}
                <View style={styles.additionalCard}>
                    <View style={styles.additionalHeader}>
                        <Text style={styles.additionalTitle}>Additional Information</Text>
                        <Pressable
                            style={styles.editBtn}
                            onPress={() => navigation.navigate("Profile", { initialData: cardData })}
                        >
                            <Text style={styles.editBtnText}>✎ Edit</Text>
                        </Pressable>
                    </View>

                    <InfoRow label="Email" value={field(cardData, "email", user?.email ?? "N/A")} />
                    <InfoRow label="Student Type" value={mapStudentType(field(cardData, "studentType"))} />
                    <InfoRow label="Blood Group" value={field(cardData, "bloodGroup")} />
                    <InfoRow label="Room No" value={field(cardData, "roomNo")} />
                    <InfoRow label="Category" value={field(cardData, "category")} />
                    <InfoRow label="Section" value={field(cardData, "section")} />
                    <InfoRow label="Year" value={field(cardData, "year")} />
                    <InfoRow label="Father's Mobile" value={field(cardData, "fatherMobile")} />
                    <InfoRow label="Emergency Contact" value={field(cardData, "emergencyPhone")} />

                    {/* QR Code Section */}
                    <View style={styles.qrSection}>
                        <View style={styles.qrContainer}>
                            {dynamicToken ? (
                                <View style={styles.qrTokenWrap}>
                                    <Text style={styles.qrTokenText} numberOfLines={4}>
                                        {dynamicToken}
                                    </Text>
                                    <View style={styles.qrRotateBadge}>
                                        <Text style={styles.qrRotateText}>🔄 Rotates every 5s</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.qrPlaceholder}>
                                    <Text style={styles.qrPlaceholderIcon}>⊞</Text>
                                    <Text style={styles.qrPlaceholderText}>QR Loading...</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.qrLabel}>Verification QR</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    )
}

function CardDetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
                {value}
            </Text>
        </View>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    if (!value || value === "N/A" || value === "—") return null

    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: APP_THEME.bg,
        gap: 12,
    },
    errorIcon: { fontSize: 40, color: APP_THEME.muted },
    errorText: { color: APP_THEME.muted, fontSize: 15 },
    retryBtn: {
        borderRadius: 14,
        paddingHorizontal: 24,
        paddingVertical: 12,
        marginTop: 8,
    },
    retryBtnText: { color: "#fff", fontWeight: "700" },
    content: {
        padding: 20,
        paddingBottom: 120,
        alignItems: "center",
    },

    // ═════ Physical Card ═════
    cardOuter: {
        width: "100%",
        maxWidth: CARD_MAX_WIDTH,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        marginBottom: 28,
    },
    cardHeader: {
        backgroundColor: "#D32F2F",
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 8,
    },
    logoCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    logoCircleText: { fontSize: 18 },
    collegeName: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
        letterSpacing: 0.5,
    },
    collegeSubtitle: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 10,
        marginTop: 2,
    },
    collegeAccr: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 9,
        letterSpacing: 0.5,
    },

    cardBody: {
        padding: 16,
        alignItems: "center",
        backgroundColor: "#fff",
    },
    photoWrap: {
        marginBottom: 12,
    },
    photo: {
        width: 100,
        height: 110,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#1565C0",
    },
    photoPlaceholder: {
        width: 100,
        height: 110,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#1565C0",
        backgroundColor: "#f5f5f5",
        alignItems: "center",
        justifyContent: "center",
    },
    photoPlaceholderText: {
        fontSize: 40,
        fontWeight: "700",
        color: "#999",
    },
    cardName: {
        color: "#1565C0",
        fontSize: 17,
        fontWeight: "700",
        textAlign: "center",
        letterSpacing: 1,
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: "row",
        width: "100%",
        marginBottom: 5,
    },
    detailLabel: {
        width: 110,
        fontSize: 12,
        color: "#666",
        fontWeight: "600",
    },
    detailValue: {
        flex: 1,
        fontSize: 12,
        color: "#333",
        fontWeight: "500",
    },
    detailValueHighlight: {
        color: "#1565C0",
        fontWeight: "700",
    },

    signaturesRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    validText: {
        color: "#D32F2F",
        fontSize: 10,
        fontWeight: "600",
    },
    signatureLine: {
        alignItems: "center",
    },
    signatureDivider: {
        width: 100,
        height: 1,
        backgroundColor: "#ccc",
        marginBottom: 4,
        marginTop: 20,
    },
    signatureLabel: {
        color: "#999",
        fontSize: 10,
    },

    cardFooter: {
        backgroundColor: "#D32F2F",
        paddingVertical: 8,
        alignItems: "center",
    },
    cardFooterText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 2,
    },

    // ═════ Additional Info ═════
    additionalCard: {
        width: "100%",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: APP_THEME.glassBg,
        padding: 20,
    },
    additionalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    additionalTitle: {
        color: APP_THEME.text,
        fontSize: 16,
        fontWeight: "700",
    },
    editBtn: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: APP_THEME.accent + "66",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    editBtnText: {
        color: APP_THEME.accent,
        fontSize: 12,
        fontWeight: "700",
    },

    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    infoLabel: {
        color: APP_THEME.muted,
        fontSize: 14,
    },
    infoValue: {
        color: APP_THEME.text,
        fontSize: 14,
        fontWeight: "600",
        maxWidth: "60%",
        textAlign: "right",
    },

    // ═════ QR Section ═════
    qrSection: {
        alignItems: "center",
        marginTop: 24,
    },
    qrContainer: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        backgroundColor: "rgba(255,255,255,0.04)",
        padding: 16,
        alignItems: "center",
        width: "100%",
        maxWidth: 220,
    },
    qrTokenWrap: {
        alignItems: "center",
        gap: 10,
    },
    qrTokenText: {
        color: APP_THEME.accent,
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
        fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
        letterSpacing: 0.5,
    },
    qrRotateBadge: {
        borderRadius: 8,
        backgroundColor: APP_THEME.accent + "1A",
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    qrRotateText: {
        color: APP_THEME.accent,
        fontSize: 10,
        fontWeight: "700",
    },
    qrPlaceholder: {
        alignItems: "center",
        gap: 8,
        paddingVertical: 16,
    },
    qrPlaceholderIcon: {
        fontSize: 48,
        color: APP_THEME.muted,
    },
    qrPlaceholderText: {
        color: APP_THEME.muted,
        fontSize: 12,
    },
    qrLabel: {
        color: APP_THEME.muted,
        fontSize: 12,
        marginTop: 8,
    },
})
