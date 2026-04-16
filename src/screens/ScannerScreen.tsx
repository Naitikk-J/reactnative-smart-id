import React, { useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
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
    const lastScanAtRef = useRef<number>(0)

    const canScan = useMemo(() => cameraPermission?.granted === true && !isProcessing, [cameraPermission?.granted, isProcessing])

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
        } catch (err) {
            setLastResult({
                success: false,
                result: "ERROR",
                badge: "RED",
                message: String(err),
                meta: {},
            })
        } finally {
            setIsProcessing(false)
        }
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
            </View>

            <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Last Result</Text>
                {isProcessing ? <ActivityIndicator color={APP_THEME.accent} /> : null}
                {lastResult ? (
                    <>
                        <Text style={styles.resultLine}>Result: {lastResult.result}</Text>
                        <Text style={styles.resultLine}>Badge: {lastResult.badge}</Text>
                        <Text style={styles.resultMessage}>{lastResult.message ?? "-"}</Text>
                    </>
                ) : (
                    <Text style={styles.resultMessage}>Scan a QR to verify</Text>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 12, gap: 12 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: APP_THEME.bg, gap: 12 },
    title: { color: APP_THEME.text, fontSize: 18, fontWeight: "700" },
    modeRow: { flexDirection: "row", gap: 10 },
    modeBtn: {
        flex: 1,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 42,
        backgroundColor: APP_THEME.card,
    },
    modeBtnActive: { backgroundColor: APP_THEME.accent },
    modeText: { color: APP_THEME.text, fontWeight: "700" },
    modeTextActive: { color: APP_THEME.bg },
    cameraWrap: {
        flex: 1,
        borderRadius: 14,
        overflow: "hidden",
        borderColor: APP_THEME.border,
        borderWidth: 1,
    },
    resultCard: {
        backgroundColor: APP_THEME.card,
        borderColor: APP_THEME.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        minHeight: 120,
    },
    resultTitle: { color: APP_THEME.text, fontSize: 16, fontWeight: "700" },
    resultLine: { color: APP_THEME.text, fontSize: 14 },
    resultMessage: { color: APP_THEME.muted, fontSize: 13 },
    primaryBtn: {
        backgroundColor: APP_THEME.accent,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        paddingHorizontal: 14,
    },
    primaryBtnText: { color: APP_THEME.bg, fontWeight: "700" },
})
