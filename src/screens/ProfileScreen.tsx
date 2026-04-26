import React, { useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useNavigation } from "@react-navigation/native"
import { APP_THEME } from "../config/constants"
import { ProfileUpdatePayload, updateProfile } from "../services/profileService"

interface ProfileScreenProps {
    route: {
        params: {
            initialData: Record<string, any>
        }
    }
}

export default function ProfileScreen({ route }: ProfileScreenProps) {
    const navigation = useNavigation()
    const data = route.params.initialData ?? {}

    const [phone, setPhone] = useState(String(data.phone ?? ""))
    const [fatherName, setFatherName] = useState(String(data.fatherName ?? ""))
    const [bloodGroup, setBloodGroup] = useState(String(data.bloodGroup ?? ""))
    const [department, setDepartment] = useState(String(data.department ?? ""))
    const [year, setYear] = useState(data.year != null ? String(data.year) : "")
    const [section, setSection] = useState(String(data.section ?? ""))
    const [photoUrl, setPhotoUrl] = useState(String(data.photoUrl ?? ""))
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        Keyboard.dismiss()
        setSaving(true)

        const payload: ProfileUpdatePayload = {
            phone,
            fatherName,
            bloodGroup,
            department,
            section,
            photoUrl,
        }

        const yearNum = parseInt(year, 10)
        if (!isNaN(yearNum) && yearNum > 0) {
            payload.year = yearNum
        }

        const result = await updateProfile(payload)
        setSaving(false)

        if (result.ok) {
            Alert.alert("✓ Saved", "Profile updated successfully!")
            navigation.goBack()
        } else {
            Alert.alert("Failed", result.error ?? "Unable to update profile")
        }
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.root}>
                <LinearGradient
                    colors={["#0A0E21", "#0F1535", "#0A0E21"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <KeyboardAvoidingView
                    behavior={Platform.select({ ios: "padding", default: undefined })}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={styles.sectionTitle}>Personal Details</Text>
                        <Field label="Photo URL (Optional)" value={photoUrl} onChange={setPhotoUrl} />
                        <Field label="Father's Name" value={fatherName} onChange={setFatherName} />
                        <Field label="Phone Number" value={phone} onChange={setPhone} keyboard="phone-pad" />
                        <Field label="Blood Group (e.g. O+)" value={bloodGroup} onChange={setBloodGroup} />

                        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Academic Details</Text>
                        <Field label="Department (e.g. CSE)" value={department} onChange={setDepartment} />
                        <Field label="Year (1-4)" value={year} onChange={setYear} keyboard="number-pad" />
                        <Field label="Section (e.g. A)" value={section} onChange={setSection} />

                        <View style={{ height: 32 }} />

                        <Pressable onPress={handleSave} disabled={saving}>
                            <LinearGradient
                                colors={saving ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)"] : [APP_THEME.accent, APP_THEME.accentPurple]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.saveBtn}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                )}
                            </LinearGradient>
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    )
}

function Field({
    label,
    value,
    onChange,
    keyboard,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    keyboard?: "default" | "phone-pad" | "number-pad"
}) {
    return (
        <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                style={styles.fieldInput}
                placeholderTextColor={APP_THEME.muted}
                keyboardType={keyboard ?? "default"}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: APP_THEME.bg },
    content: {
        padding: 20,
        paddingBottom: 80,
    },
    sectionTitle: {
        color: APP_THEME.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
    },
    fieldWrap: {
        marginBottom: 14,
    },
    fieldLabel: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
    },
    fieldInput: {
        borderColor: APP_THEME.glassBorder,
        borderWidth: 1,
        borderRadius: 14,
        color: APP_THEME.text,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
    },
    saveBtn: {
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
    saveBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
})
