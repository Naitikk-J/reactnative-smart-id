import React, { useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Location from "expo-location"
import { APP_THEME } from "../config/constants"
import { accessScan, confirmEventMeal } from "../services/scanService"
import { ScanResult } from "../types/ScanResult"

export default function ScannerScreen() {
    const [cameraPermission, requestCameraPermission] = useCameraPermissions()
    const [mode, setMode] = useState<"ENTRY" | "EXIT">("ENTRY")
    const [isProcessing, setIsProcessing] = useState(false)
    const [lastResult, setLastResult] = useState<ScanResult | null>(null)
    const [isResultModalVisible, setIsResultModalVisible] = useState(false)
    const lastScanAtRef = useRef<number>(0)

    const canScan = useMemo(
        () => cameraPermission?.granted === true && !isProcessing && !isResultModalVisible,
        [cameraPermission?.granted, isProcessing, isResultModalVisible],
    )

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

    const handleScanned = async (value: string) => {
        const now = Date.now()
        if (!value || now - lastScanAtRef.current < 1500 || !canScan) return
        lastScanAtRef.current = now
        setIsProcessing(true)

        try {
            const locationPermission = await Location.requestForegroundPermissionsAsync()
            if (locationPermission.status !== "granted") {
                Alert.alert("Permission", "Location permission is required for scan")
                setIsProcessing(false)
                return
            }

            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
            const payload = {
                qrToken: value,
                eventType: mode,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? 0,
                timestamp: new Date().toISOString(),
                isMockLocation: false,
            }

            let result = await accessScan(payload)

            if (result.result === "MEAL_CONFIRMATION_REQUIRED") {
                const mealNumber = result.meta?.mealNumber
                const mealLabel = result.meta?.mealLabel

                await new Promise<void>((resolve) => {
                    Alert.alert(
                        "Confirm Meal",
                        `Confirm meal ${mealNumber ?? ""} ${mealLabel ?? ""}?`,
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
            const fallbackResult = {
                success: false,
                result: "ERROR",
                badge: "RED",
                message: String(err),
                meta: {},
            }
            setLastResult(fallbackResult)
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
                <Text style={styles.title}>Camera permission required</Text>
                <Pressable style={styles.primaryBtn} onPress={requestCameraPermission}>
                    <Text style={styles.primaryBtnText}>Allow Camera</Text>
                </Pressable>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.screenTitle}>Scan Console</Text>
                    <Text style={styles.screenSubtitle}>Point camera towards access, event or gate QR</Text>
                </View>
                <View style={[styles.scanStateChip, isProcessing && styles.scanStateChipBusy]}>
                    <Text style={[styles.scanStateText, isProcessing && styles.scanStateTextBusy]}>
                        {isProcessing ? "PROCESSING" : "READY"}
                    </Text>
                </View>
            </View>

            <View style={styles.modeRow}>
                <Pressable
                    style={[styles.modeBtn, mode === "ENTRY" && styles.modeBtnActive]}
                    onPress={() => setMode("ENTRY")}
                >
                    <Text style={[styles.modeText, mode === "ENTRY" && styles.modeTextActive]}>ENTRY</Text>
                </Pressable>
                <Pressable
                    style={[styles.modeBtn, mode === "EXIT" && styles.modeBtnActive]}
                    onPress={() => setMode("EXIT")}
                >
                    <Text style={[styles.modeText, mode === "EXIT" && styles.modeTextActive]}>EXIT</Text>
                </Pressable>
            </View>

            <View style={styles.cameraWrap}>
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={canScan ? (event) => handleScanned(event.data) : undefined}
                />
                <View style={styles.overlayCenter}>
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.cornerTopLeft]} />
                        <View style={[styles.corner, styles.cornerTopRight]} />
                        <View style={[styles.corner, styles.cornerBottomLeft]} />
                        <View style={[styles.corner, styles.cornerBottomRight]} />
                    </View>
                    <Text style={styles.overlayHint}>Align QR inside frame</Text>
                </View>
            </View>

            <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Result popup</Text>
                <Text style={styles.resultMessage}>
                    After each scan, a result card will pop up showing the scan result and student details (if available).
                </Text>
            </View>

            <Modal
                visible={isResultModalVisible}
                animationType="fade"
                transparent
                onRequestClose={closeResultModal}
            >
                <View style={[styles.modalBackdrop, { backgroundColor: resultTone }]}>
                    <View style={styles.modalSurface}>
                        <View style={styles.modalTop}>
                            <View style={styles.modalIconShell}>
                                <Text style={styles.modalIconText}>{resultIcon}</Text>
                            </View>

                            <Text style={styles.modalTitle}>{resultTitle}</Text>
                            <Text style={styles.modalResultCode}>{lastResult?.result ?? "-"}</Text>
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
    container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 12, gap: 12 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: APP_THEME.bg, gap: 12 },
    title: { color: APP_THEME.text, fontSize: 18, fontWeight: "700" },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    screenTitle: { color: APP_THEME.text, fontSize: 22, fontWeight: "800" },
    screenSubtitle: { color: APP_THEME.muted, fontSize: 12, marginTop: 2 },
    scanStateChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(22,214,163,0.3)",
        backgroundColor: "rgba(22,214,163,0.15)",
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    scanStateChipBusy: {
        borderColor: "rgba(247,201,72,0.34)",
        backgroundColor: "rgba(247,201,72,0.18)",
    },
    scanStateText: { color: APP_THEME.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
    scanStateTextBusy: { color: APP_THEME.warning },
    modeRow: { flexDirection: "row", gap: 10 },
    modeBtn: {
        flex: 1,
        borderColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 46,
        backgroundColor: APP_THEME.card,
    },
    modeBtnActive: { backgroundColor: APP_THEME.accent },
    modeText: { color: APP_THEME.text, fontWeight: "800", letterSpacing: 0.4 },
    modeTextActive: { color: APP_THEME.bg },
    cameraWrap: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
        borderColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        backgroundColor: "#000",
    },
    overlayCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
    },
    scanFrame: {
        width: "72%",
        aspectRatio: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        position: "relative",
    },
    corner: {
        position: "absolute",
        width: 28,
        height: 28,
        borderColor: APP_THEME.accent,
        borderWidth: 3,
    },
    cornerTopLeft: {
        top: -2,
        left: -2,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 12,
    },
    cornerTopRight: {
        top: -2,
        right: -2,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 12,
    },
    cornerBottomLeft: {
        bottom: -2,
        left: -2,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 12,
    },
    cornerBottomRight: {
        bottom: -2,
        right: -2,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 12,
    },
    overlayHint: {
        marginTop: 12,
        color: "#d9e5ff",
        fontSize: 12,
        backgroundColor: "rgba(0,0,0,0.35)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    resultCard: {
        backgroundColor: APP_THEME.card,
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        gap: 8,
        minHeight: 120,
    },
    resultTitle: { color: APP_THEME.text, fontSize: 16, fontWeight: "800" },
    resultMessage: { color: APP_THEME.muted, fontSize: 13, lineHeight: 19 },
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
    },
    modalResultCode: {
        color: "#071226",
        fontSize: 28,
        fontWeight: "800",
        marginTop: 10,
        textAlign: "center",
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
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 14,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "800" },
})
