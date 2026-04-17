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
        if (!latest) return "Wait for GPS..."
        return `GPS Ready (${Math.max(1, Math.round(latest.accuracy))}m accuracy)`
    }, [isProcessing, isResultModalVisible])

    const resultTone = useMemo(() => {
        if (!lastResult) return APP_THEME.muted
        if (lastResult.badge === "GREEN") return APP_THEME.accent
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
                <Pressable style={styles.permissionButton} onPress={requestCameraPermission}>
                    <Text style={styles.permissionButtonText}>Allow Camera</Text>
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

            <View style={styles.backdropShade} />

            <View style={styles.overlay}>
                <View style={styles.topBar}>
                    <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("Dashboard")}>
                        <Text style={styles.iconBtnText}>‹</Text>
                    </Pressable>
                    <Pressable
                        style={styles.iconBtn}
                        onPress={() => setTorchEnabled((prev) => !prev)}
                    >
                        <Text style={styles.iconBtnText}>{torchEnabled ? "☼" : "⚡"}</Text>
                    </Pressable>
                </View>

                <View style={styles.midSpacer} />

                {lastSyncedOfflineCount > 0 ? (
                    <View style={styles.syncBanner}>
                        <Text style={styles.syncBannerText}>Offline sync done: {lastSyncedOfflineCount} scan(s)</Text>
                    </View>
                ) : null}

                <View style={styles.frameWrap}>
                    <View style={styles.scanFrame} />
                </View>

                <View style={styles.bottomPanel}>
                    <View style={styles.gpsRow}>
                        <Text style={styles.gpsIcon}>{lastLocationRef.current ? "◎" : "◌"}</Text>
                        <Text style={styles.gpsText}>{gpsStatusText}</Text>
                    </View>

                    <View style={styles.modeCard}>
                        <View>
                            <Text style={styles.modeLabel}>Scanning Mode</Text>
                            <View style={styles.modeValueRow}>
                                <Text style={[styles.modeValue, mode === "ENTRY" ? styles.modeValueEntry : styles.modeValueExit]}>{mode}</Text>
                                <View style={styles.autoChip}>
                                    <Text style={styles.autoChipText}>AUTO</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.lockedChip}>
                            <Text style={styles.lockedChipText}>AUTO-LOCKED</Text>
                        </View>
                    </View>
                </View>
            </View>

            {isProcessing ? (
                <View style={styles.processingOverlay}>
                    <ActivityIndicator color={APP_THEME.accent} size="large" />
                    <Text style={styles.processingText}>Validating access...</Text>
                </View>
            ) : null}

            {showPermissionPrompt ? (
                <View style={styles.permissionOverlay}>
                    <View style={styles.permissionCard}>
                        <Text style={styles.permissionCardTitle}>Permissions Required</Text>
                        <Text style={styles.permissionCardDesc}>Location permission is required for scan.</Text>
                        <Pressable
                            style={styles.permissionPrimary}
                            onPress={async () => {
                                setShowPermissionPrompt(false)
                                await Location.requestForegroundPermissionsAsync()
                            }}
                        >
                            <Text style={styles.permissionPrimaryText}>Retry Permission</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            <Modal visible={isResultModalVisible} animationType="fade" transparent onRequestClose={closeResultModal}>
                <View style={[styles.modalBackdrop, { backgroundColor: resultTone }]}>
                    <View style={styles.modalSurface}>
                        <View style={styles.modalTop}>
                            <View style={styles.modalIconShell}>
                                <Text style={styles.modalIconText}>{resultIcon}</Text>
                            </View>
                            <Text style={styles.modalTitle}>{resultTitle}</Text>
                            <Text style={styles.modalResultCode}>{lastResult?.result ?? "-"}</Text>
                            {dayBadgeText ? (
                                <View style={styles.dayBadge}>
                                    <Text style={styles.dayBadgeText}>{dayBadgeText}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.modalMessage}>{lastResult?.message ?? "No message"}</Text>
                        </View>

                        {lastResult?.student ? (
                            <View style={styles.studentCard}>
                                {lastResult.student.photoUrl ? (
                                    <Image source={{ uri: lastResult.student.photoUrl }} style={styles.studentPhoto} />
                                ) : (
                                    <View style={styles.studentPhotoFallback}>
                                        <Text style={styles.studentPhotoFallbackText}>ID</Text>
                                    </View>
                                )}
                                <Text style={styles.studentName}>{lastResult.student.name}</Text>
                                <Text style={styles.studentEnrollment}>{lastResult.student.enrollmentNo}</Text>
                            </View>
                        ) : null}

                        <Pressable style={styles.modalActionBtn} onPress={closeResultModal}>
                            <Text style={[styles.modalActionBtnText, { color: resultTone }]}>Done</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

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
        borderRadius: 12,
        minHeight: 44,
        minWidth: 140,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: APP_THEME.accent,
    },
    permissionButtonText: { color: APP_THEME.bg, fontWeight: "800" },
    backdropShade: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.2)",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
        paddingTop: 18,
    },
    topBar: {
        paddingHorizontal: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    iconBtn: {
        width: 46,
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    iconBtnText: { color: "#fff", fontSize: 22, fontWeight: "900" },
    midSpacer: { height: 24 },
    syncBanner: {
        marginHorizontal: 24,
        marginBottom: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(74,222,128,0.45)",
        backgroundColor: "rgba(74,222,128,0.18)",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    syncBannerText: { color: "#fff", textAlign: "center", fontSize: 12, fontWeight: "700" },
    frameWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: "#4ade80",
        shadowColor: "#4ade80",
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
    bottomPanel: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 22,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderTopWidth: 2,
        borderTopColor: "#333333",
        backgroundColor: "rgba(18,18,18,0.95)",
        gap: 18,
    },
    gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    gpsIcon: { color: "#4ade80", fontSize: 18, fontWeight: "900" },
    gpsText: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
    modeCard: {
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "#333333",
        backgroundColor: "#1E1E1E",
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    modeLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
    modeValueRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
    modeValue: { fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
    modeValueEntry: { color: "#4ade80" },
    modeValueExit: { color: "#facc15" },
    autoChip: {
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.1)",
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    autoChipText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "800" },
    lockedChip: {
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    lockedChipText: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 11 },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(18,18,18,0.8)",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
    },
    processingText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
    permissionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(7,18,38,0.8)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    permissionCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 16,
        backgroundColor: APP_THEME.card,
        borderWidth: 1,
        borderColor: APP_THEME.border,
        padding: 18,
        gap: 10,
    },
    permissionCardTitle: { color: APP_THEME.text, fontSize: 17, fontWeight: "800" },
    permissionCardDesc: { color: APP_THEME.muted, fontSize: 13, lineHeight: 20 },
    permissionPrimary: {
        marginTop: 8,
        borderRadius: 10,
        backgroundColor: APP_THEME.accent,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    permissionPrimaryText: { color: APP_THEME.bg, fontWeight: "800" },
    modalBackdrop: {
        flex: 1,
        padding: 22,
    },
    modalSurface: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 24,
    },
    modalTop: {
        width: "100%",
        alignItems: "center",
    },
    modalIconShell: {
        width: 110,
        height: 110,
        borderRadius: 28,
        backgroundColor: "#10203a",
        borderWidth: 4,
        borderColor: "#071226",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#071226",
        shadowOpacity: 0.5,
        shadowOffset: { width: 8, height: 8 },
        shadowRadius: 0,
        elevation: 12,
    },
    modalIconText: { color: "#fff", fontSize: 44, fontWeight: "900", lineHeight: 48 },
    modalTitle: {
        color: "#071226",
        fontSize: 36,
        fontWeight: "900",
        marginTop: 22,
        letterSpacing: 0.6,
        textAlign: "center",
    },
    modalResultCode: {
        color: "#071226",
        fontSize: 28,
        fontWeight: "800",
        marginTop: 10,
        textAlign: "center",
    },
    dayBadge: {
        marginTop: 10,
        borderRadius: 999,
        backgroundColor: "#071226",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
    },
    dayBadgeText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    modalMessage: {
        color: "#071226",
        fontSize: 19,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 10,
        maxWidth: 360,
    },
    studentCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: 22,
        backgroundColor: "#10203a",
        borderWidth: 4,
        borderColor: "#071226",
        alignItems: "center",
        paddingVertical: 18,
        paddingHorizontal: 14,
        shadowColor: "#071226",
        shadowOpacity: 0.45,
        shadowOffset: { width: 8, height: 8 },
        shadowRadius: 0,
        elevation: 10,
    },
    studentPhoto: {
        width: 84,
        height: 84,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.24)",
    },
    studentPhotoFallback: {
        width: 84,
        height: 84,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.24)",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    studentPhotoFallbackText: { color: "#d9e5ff", fontSize: 20, fontWeight: "800" },
    studentName: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 12, textAlign: "center" },
    studentEnrollment: { color: "#d9e5ff", fontSize: 15, fontWeight: "600", marginTop: 4 },
    modalActionBtn: {
        width: "100%",
        maxWidth: 380,
        minHeight: 64,
        borderRadius: 16,
        backgroundColor: "#071226",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.2)",
    },
    modalActionBtnText: { fontSize: 20, fontWeight: "900", letterSpacing: 0.4 },
})
