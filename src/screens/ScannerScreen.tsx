import React, { useMemo, useRef, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useNavigation } from "@react-navigation/native"
import * as Location from "expo-location"
import { LinearGradient } from "expo-linear-gradient"
import { APP_THEME } from "../config/constants"
import { accessScan, confirmEventMeal } from "../services/scanService"
import { ScanResult } from "../types/ScanResult"

const SCAN_DEBOUNCE_MS = 900
const LOCATION_CACHE_MAX_AGE_MS = 20_000
const LOCATION_TIMEOUT_MS = 3_500

type CachedLocation = {
    latitude: number
    longitude: number
    accuracy: number
    timestamp: number
}

export default function ScannerScreen() {
    const navigation = useNavigation<any>()
    const [cameraPermission, requestCameraPermission] = useCameraPermissions()
    const [mode, setMode] = useState<"ENTRY" | "EXIT">("ENTRY")
    const [isProcessing, setIsProcessing] = useState(false)
    const [lastResult, setLastResult] = useState<ScanResult | null>(null)
    const [isResultModalVisible, setIsResultModalVisible] = useState(false)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
    const [lastSyncedOfflineCount] = useState(0)

    const lastScanAtRef = useRef<number>(0)
    const locationPermissionGrantedRef = useRef<boolean | null>(null)
    const lastLocationRef = useRef<CachedLocation | null>(null)

    const isEntry = mode === "ENTRY"
    const modeColor = isEntry ? APP_THEME.accent : APP_THEME.warning

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
        return await new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), timeoutMs)
            promise
                .then((value) => {
                    clearTimeout(timeout)
                    resolve(value)
                })
                .catch((error) => {
                    clearTimeout(timeout)
                    reject(error)
                })
        })
    }

    const cacheLocation = (coords: Location.LocationObjectCoords, timestamp?: number): CachedLocation => {
        const next = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? 0,
            timestamp: timestamp ?? Date.now(),
        }
        lastLocationRef.current = next
        return next
    }

    const resolveScanLocation = async (): Promise<CachedLocation> => {
        if (locationPermissionGrantedRef.current !== true) {
            let permission = await Location.getForegroundPermissionsAsync()
            if (permission.status !== "granted") {
                permission = await Location.requestForegroundPermissionsAsync()
            }

            const granted = permission.status === "granted"
            locationPermissionGrantedRef.current = granted

            if (!granted) {
                throw new Error("LOCATION_PERMISSION_DENIED")
            }
        }

        const now = Date.now()
        const cached = lastLocationRef.current
        if (cached && now - cached.timestamp <= LOCATION_CACHE_MAX_AGE_MS) {
            return cached
        }

        const lastKnown = await Location.getLastKnownPositionAsync()
        if (lastKnown && now - lastKnown.timestamp <= LOCATION_CACHE_MAX_AGE_MS) {
            return cacheLocation(lastKnown.coords, lastKnown.timestamp)
        }

        try {
            const current = await withTimeout(
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                LOCATION_TIMEOUT_MS,
            )
            return cacheLocation(current.coords, current.timestamp)
        } catch {
            if (lastKnown) {
                return cacheLocation(lastKnown.coords, lastKnown.timestamp)
            }

            if (lastLocationRef.current) {
                return lastLocationRef.current
            }

            throw new Error("LOCATION_UNAVAILABLE")
        }
    }

    const canScan = useMemo(
        () => cameraPermission?.granted === true && !isProcessing && !isResultModalVisible,
        [cameraPermission?.granted, isProcessing, isResultModalVisible],
    )

    const gpsStatusText = useMemo(() => {
        const latest = lastLocationRef.current
        if (!latest) return "Waiting for GPS..."
        return `GPS Ready (${Math.max(1, Math.round(latest.accuracy))}m)`
    }, [isProcessing, isResultModalVisible])

    const resultTone = useMemo(() => {
        if (!lastResult) return APP_THEME.muted
        if (lastResult.badge === "GREEN") return APP_THEME.success
        if (lastResult.badge === "AMBER") return APP_THEME.warning
        return APP_THEME.danger
    }, [lastResult])

    const resultTitle = useMemo(() => {
        if (!lastResult) return "SCAN RESULT"
        if (lastResult.badge === "GREEN") return "VERIFIED"
        if (lastResult.badge === "AMBER") return "WARNING"
        return "UNVERIFIED"
    }, [lastResult])

    const resultIcon = useMemo(() => {
        if (!lastResult) return "?"
        if (lastResult.badge === "GREEN") return "✓"
        if (lastResult.badge === "AMBER") return "!"
        return "✕"
    }, [lastResult])

    const dayBadgeText = useMemo(() => {
        const dayNumberRaw = Number(lastResult?.meta?.dayNumber)
        if (Number.isFinite(dayNumberRaw) && dayNumberRaw > 0) {
            return `Day ${Math.trunc(dayNumberRaw)}`
        }

        const dayLabel = String(lastResult?.meta?.dayLabel || "").trim()
        if (dayLabel) {
            return dayLabel
        }

        return ""
    }, [lastResult])

    const handleScanned = async (value: string) => {
        const now = Date.now()
        if (!value || now - lastScanAtRef.current < SCAN_DEBOUNCE_MS || !canScan) return

        lastScanAtRef.current = now
        setIsProcessing(true)

        try {
            const position = await resolveScanLocation()
            const payload = {
                qrToken: value,
                eventType: mode,
                latitude: position.latitude,
                longitude: position.longitude,
                accuracy: position.accuracy,
                timestamp: new Date().toISOString(),
                isMockLocation: false,
            }

            let result = await accessScan(payload)

            if (result.result === "MEAL_CONFIRMATION_REQUIRED") {
                const mealNumber = result.meta?.mealNumber
                const mealLabel = result.meta?.mealLabel

                await new Promise<void>((resolve) => {
                    Alert.alert(
                        "Confirm Meal Scan",
                        mealNumber ? `Confirm Meal #${mealNumber}${mealLabel ? ` (${mealLabel})` : ""}?` : "Confirm this meal scan?",
                        [
                            { text: "Cancel", style: "cancel", onPress: () => resolve() },
                            {
                                text: "Confirm",
                                onPress: async () => {
                                    result = await confirmEventMeal({
                                        qrToken: value,
                                        eventType: mode,
                                        latitude: payload.latitude,
                                        longitude: payload.longitude,
                                        accuracy: payload.accuracy,
                                        timestamp: payload.timestamp,
                                    })
                                    resolve()
                                },
                            },
                        ],
                    )
                })
            }

            setLastResult(result)
            setIsResultModalVisible(true)
        } catch (err) {
            if (err instanceof Error && err.message === "LOCATION_PERMISSION_DENIED") {
                setShowPermissionPrompt(true)
                return
            }

            setLastResult({
                success: false,
                result: "ERROR",
                badge: "RED",
                message: String(err),
                meta: {},
            })
            setIsResultModalVisible(true)
        } finally {
            setIsProcessing(false)
        }
    }

    const closeResultModal = () => {
        setIsResultModalVisible(false)
    }

    if (!cameraPermission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={APP_THEME.accent} />
            </View>
        )
    }

    if (!cameraPermission.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.permissionTitle}>Camera permission required</Text>
                <Pressable onPress={requestCameraPermission}>
                    <LinearGradient
                        colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.permissionButton}
                    >
                        <Text style={styles.permissionButtonText}>Allow Camera</Text>
                    </LinearGradient>
                </Pressable>
            </View>
        )
    }

    return (
        <View style={styles.root}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={canScan ? (event) => handleScanned(event.data) : undefined}
                enableTorch={torchEnabled}
            />

            <View style={styles.overlay}>
                {/* Top Bar */}
                <View style={styles.topBar}>
                    <Pressable style={styles.glassIconBtn} onPress={() => navigation.navigate("Dashboard")}>
                        <Text style={styles.glassIconBtnText}>‹</Text>
                    </Pressable>
                    <Pressable
                        style={styles.glassIconBtn}
                        onPress={() => setTorchEnabled((prev) => !prev)}
                    >
                        <Text style={styles.glassIconBtnText}>{torchEnabled ? "☼" : "⚡"}</Text>
                    </Pressable>
                </View>

                <View style={{ flex: 1 }} />

                {lastSyncedOfflineCount > 0 ? (
                    <View style={styles.syncBanner}>
                        <Text style={styles.syncBannerText}>Offline sync done: {lastSyncedOfflineCount} scan(s)</Text>
                    </View>
                ) : null}

                {/* Scan Frame */}
                <View style={styles.frameWrap}>
                    <View style={[styles.scanFrame, { borderColor: modeColor, shadowColor: modeColor }]}>
                        {/* Corner accents */}
                        <View style={[styles.cornerTL_H, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerTL_V, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerTR_H, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerTR_V, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerBL_H, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerBL_V, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerBR_H, { backgroundColor: modeColor }]} />
                        <View style={[styles.cornerBR_V, { backgroundColor: modeColor }]} />
                    </View>
                </View>

                <View style={{ flex: 1 }} />

                {/* Bottom Panel */}
                <View style={styles.bottomPanel}>
                    {/* GPS Status */}
                    <View style={styles.gpsRow}>
                        <View
                            style={[
                                styles.gpsDot,
                                {
                                    backgroundColor: lastLocationRef.current
                                        ? APP_THEME.success
                                        : APP_THEME.danger,
                                    shadowColor: lastLocationRef.current
                                        ? APP_THEME.success
                                        : APP_THEME.danger,
                                },
                            ]}
                        />
                        <Text style={styles.gpsText}>{gpsStatusText}</Text>
                    </View>

                    {/* Mode Card */}
                    <View style={[styles.modeCard, { borderColor: modeColor + "26" }]}>
                        <View>
                            <Text style={styles.modeLabel}>Scanning Mode</Text>
                            <View style={styles.modeValueRow}>
                                <Text style={[styles.modeValue, { color: modeColor }]}>{mode}</Text>
                                <View style={styles.autoChip}>
                                    <Text style={styles.autoChipText}>AUTO</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.lockedChip}>
                            <Text style={styles.lockedChipIcon}>🔒</Text>
                            <Text style={styles.lockedChipText}>AUTO-LOCKED</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Processing Overlay */}
            {isProcessing ? (
                <View style={styles.processingOverlay}>
                    <LinearGradient
                        colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                        style={styles.processingIcon}
                    >
                        <ActivityIndicator color="#fff" size="large" />
                    </LinearGradient>
                    <Text style={styles.processingText}>Validating access...</Text>
                </View>
            ) : null}

            {/* Permission Prompt */}
            {showPermissionPrompt ? (
                <View style={styles.permissionOverlay}>
                    <View style={styles.permissionCard}>
                        <Text style={styles.permissionCardTitle}>Permissions Required</Text>
                        <Text style={styles.permissionCardDesc}>
                            Location permission is required for scan. If iOS is not showing the prompt, open Settings and allow Camera + Location for this app.
                        </Text>
                        <Pressable
                            onPress={async () => {
                                setShowPermissionPrompt(false)
                                await Location.requestForegroundPermissionsAsync()
                            }}
                        >
                            <LinearGradient
                                colors={[APP_THEME.accent, APP_THEME.accentPurple]}
                                style={styles.permissionPrimary}
                            >
                                <Text style={styles.permissionPrimaryText}>Retry Permission</Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            {/* Result Modal */}
            <Modal visible={isResultModalVisible} animationType="fade" transparent onRequestClose={closeResultModal}>
                <View style={styles.resultModalBg}>
                    <LinearGradient
                        colors={[resultTone, resultTone + "CC", APP_THEME.bg]}
                        locations={[0, 0.4, 1]}
                        style={styles.resultGradient}
                    >
                        <View style={styles.resultContent}>
                            {/* Icon */}
                            <View style={styles.resultIconShell}>
                                <Text style={styles.resultIconText}>{resultIcon}</Text>
                            </View>

                            <Text style={styles.resultTitle}>{resultTitle}</Text>
                            <Text style={styles.resultCode}>{lastResult?.result ?? "-"}</Text>

                            {dayBadgeText ? (
                                <View style={styles.dayBadge}>
                                    <Text style={styles.dayBadgeText}>{dayBadgeText}</Text>
                                </View>
                            ) : null}

                            <Text style={styles.resultMessage}>{lastResult?.message ?? "No message"}</Text>

                            {lastResult?.student ? (
                                <View style={styles.studentCard}>
                                    {lastResult.student.photoUrl ? (
                                        <Image
                                            source={{ uri: lastResult.student.photoUrl }}
                                            style={styles.studentPhoto}
                                        />
                                    ) : (
                                        <View style={styles.studentPhotoFallback}>
                                            <Text style={styles.studentPhotoFallbackText}>ID</Text>
                                        </View>
                                    )}
                                    <Text style={styles.studentName}>{lastResult.student.name}</Text>
                                    <Text style={styles.studentEnrollment}>{lastResult.student.enrollmentNo}</Text>
                                </View>
                            ) : null}

                            <View style={{ flex: 1 }} />

                            <Pressable style={styles.resultActionBtn} onPress={closeResultModal}>
                                <Text style={[styles.resultActionText, { color: resultTone }]}>
                                    DONE / NEXT SCAN
                                </Text>
                            </Pressable>
                        </View>
                    </LinearGradient>
                </View>
            </Modal>
        </View>
    )
}

const CORNER_SIZE = 20
const CORNER_THICK = 3

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: APP_THEME.bg,
        gap: 14,
        padding: 20,
    },
    permissionTitle: { color: APP_THEME.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    permissionButton: {
        marginTop: 10,
        borderRadius: 16,
        height: 48,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    permissionButtonText: { color: "#fff", fontWeight: "800" },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
    },
    topBar: {
        paddingHorizontal: 16,
        paddingTop: 56,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    glassIconBtn: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    glassIconBtnText: { color: "#fff", fontSize: 22, fontWeight: "900" },

    syncBanner: {
        marginHorizontal: 24,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: APP_THEME.success + "4D",
        backgroundColor: APP_THEME.success + "26",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    syncBannerText: { color: "#fff", textAlign: "center", fontSize: 12, fontWeight: "600" },

    frameWrap: {
        alignItems: "center",
        justifyContent: "center",
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderRadius: 28,
        borderWidth: 3,
        shadowOpacity: 0.3,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },

    // Corner accents
    cornerTL_H: { position: "absolute", top: 0, left: 0, width: CORNER_SIZE, height: CORNER_THICK, borderTopLeftRadius: 28 },
    cornerTL_V: { position: "absolute", top: 0, left: 0, width: CORNER_THICK, height: CORNER_SIZE, borderTopLeftRadius: 28 },
    cornerTR_H: { position: "absolute", top: 0, right: 0, width: CORNER_SIZE, height: CORNER_THICK, borderTopRightRadius: 28 },
    cornerTR_V: { position: "absolute", top: 0, right: 0, width: CORNER_THICK, height: CORNER_SIZE, borderTopRightRadius: 28 },
    cornerBL_H: { position: "absolute", bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_THICK, borderBottomLeftRadius: 28 },
    cornerBL_V: { position: "absolute", bottom: 0, left: 0, width: CORNER_THICK, height: CORNER_SIZE, borderBottomLeftRadius: 28 },
    cornerBR_H: { position: "absolute", bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_THICK, borderBottomRightRadius: 28 },
    cornerBR_V: { position: "absolute", bottom: 0, right: 0, width: CORNER_THICK, height: CORNER_SIZE, borderBottomRightRadius: 28 },

    bottomPanel: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
        backgroundColor: APP_THEME.bg + "D9",
        gap: 20,
    },
    gpsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    gpsDot: {
        width: 8,
        height: 8,
        borderRadius: 999,
        shadowOpacity: 0.5,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
    },
    gpsText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "500" },

    modeCard: {
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    modeLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "500" },
    modeValueRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
    modeValue: { fontSize: 20, fontWeight: "800" },
    autoChip: {
        borderRadius: 6,
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    autoChipText: { color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "700" },
    lockedChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    lockedChipIcon: { fontSize: 12 },
    lockedChipText: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 10 },

    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: APP_THEME.bg + "D9",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
    },
    processingIcon: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: APP_THEME.accent,
        shadowOpacity: 0.4,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
    },
    processingText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 1,
    },

    permissionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: APP_THEME.bg + "CC",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    permissionCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 24,
        backgroundColor: APP_THEME.surfaceDark,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        padding: 20,
        gap: 12,
    },
    permissionCardTitle: { color: APP_THEME.text, fontSize: 17, fontWeight: "700" },
    permissionCardDesc: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 20 },
    permissionPrimary: {
        marginTop: 8,
        borderRadius: 14,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    permissionPrimaryText: { color: "#fff", fontWeight: "800" },

    // ── Result Modal ──
    resultModalBg: { flex: 1 },
    resultGradient: { flex: 1 },
    resultContent: {
        flex: 1,
        alignItems: "center",
        paddingTop: 80,
        paddingBottom: 32,
        paddingHorizontal: 24,
    },
    resultIconShell: {
        width: 110,
        height: 110,
        borderRadius: 32,
        backgroundColor: APP_THEME.bg,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
    resultIconText: { color: "#fff", fontSize: 48, fontWeight: "900" },
    resultTitle: {
        color: APP_THEME.bg,
        fontSize: 30,
        fontWeight: "800",
        marginTop: 28,
        letterSpacing: -0.5,
        textAlign: "center",
    },
    resultCode: {
        color: APP_THEME.bg,
        fontSize: 22,
        fontWeight: "800",
        marginTop: 10,
        textAlign: "center",
    },
    dayBadge: {
        marginTop: 10,
        borderRadius: 999,
        backgroundColor: APP_THEME.bg,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
    },
    dayBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
    resultMessage: {
        color: "rgba(10,14,33,0.87)",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 10,
        maxWidth: 360,
    },

    studentCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 24,
        backgroundColor: APP_THEME.bg + "D9",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 20,
        marginTop: 24,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    studentPhoto: {
        width: 80,
        height: 80,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.24)",
    },
    studentPhotoFallback: {
        width: 80,
        height: 80,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.24)",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    studentPhotoFallbackText: { color: "rgba(255,255,255,0.7)", fontSize: 20, fontWeight: "800" },
    studentName: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 16, textAlign: "center" },
    studentEnrollment: { color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: "500", marginTop: 4 },

    resultActionBtn: {
        width: "100%",
        maxWidth: 380,
        height: 56,
        borderRadius: 16,
        backgroundColor: APP_THEME.bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    resultActionText: { fontSize: 16, fontWeight: "800", letterSpacing: 1 },
})
