import React, { useEffect, useState } from 'react'
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { googleAuthService } from '../services/googleAuthService'
import { User, isEventOnly, isExternalUser } from '../types/User'

const { width } = Dimensions.get('window')

export const EIdCardScreen: React.FC = () => {
    const { user } = useAuth()
    const [cardData, setCardData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadCardData()
    }, [])

    const loadCardData = async () => {
        try {
            const data = await googleAuthService.getEIdCard()
            setCardData(data)
        } catch (error) {
            console.error('Failed to load card data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getUserTypeLabel = (user: User | null) => {
        if (!user) return 'Student'
        if (isExternalUser(user)) return 'External (Event Only)'
        if (isEventOnly(user)) return 'Event Only'
        return 'College Student'
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>E-ID Card</Text>

                {/* ID Card */}
                <View style={styles.cardContainer}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.headerText}>MITS GWALIOR</Text>
                        <Text style={styles.subHeaderText}>Smart ID Card</Text>
                    </View>

                    {/* Photo & Info */}
                    <View style={styles.cardBody}>
                        <View style={styles.photoContainer}>
                            {user?.photoUrl ? (
                                <Image
                                    source={{ uri: user.photoUrl }}
                                    style={styles.photo}
                                />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Text style={styles.photoPlaceholderText}>
                                        {user?.name?.charAt(0) || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.infoContainer}>
                            <Text style={styles.nameText}>{user?.name || 'Unknown'}</Text>
                            <Text style={styles.enrollmentText}>
                                {user?.enrollmentNo || 'N/A'}
                            </Text>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Department:</Text>
                                <Text style={styles.infoValue}>
                                    {user?.department || 'N/A'}
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Year:</Text>
                                <Text style={styles.infoValue}>
                                    {user?.year || 'N/A'}
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Type:</Text>
                                <Text style={styles.infoValue}>
                                    {getUserTypeLabel(user)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* QR Code Placeholder */}
                    <View style={styles.qrContainer}>
                        <View style={styles.qrPlaceholder}>
                            <Text style={styles.qrText}>QR CODE</Text>
                        </View>
                        <Text style={styles.qrLabel}>Scan for verification</Text>
                    </View>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                        <Text style={styles.footerText}>Verified Digital ID</Text>
                    </View>
                </View>

                {/* Additional Info */}
                <View style={styles.additionalInfoContainer}>
                    <Text style={styles.sectionTitle}>Additional Information</Text>

                    <InfoRow label="Email" value={user?.email || 'N/A'} />
                    <InfoRow
                        label="Student Type"
                        value={cardData?.studentType || 'N/A'}
                    />
                    <InfoRow
                        label="Blood Group"
                        value={cardData?.bloodGroup || 'N/A'}
                    />
                    <InfoRow label="Room No" value={cardData?.roomNo || 'N/A'} />
                    <InfoRow
                        label="Category"
                        value={cardData?.category || 'N/A'}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const InfoRow: React.FC<{ label: string; value: string }> = ({
    label,
    value,
}) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View>
)

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    scrollContent: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    cardContainer: {
        backgroundColor: '#4a4e69',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    cardHeader: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    subHeaderText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    cardBody: {
        flexDirection: 'row',
        padding: 20,
    },
    photoContainer: {
        marginRight: 16,
    },
    photo: {
        width: 100,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    photoPlaceholder: {
        width: 100,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPlaceholderText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#666',
    },
    infoContainer: {
        flex: 1,
    },
    nameText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    enrollmentText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    infoLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginRight: 4,
    },
    infoValue: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    qrContainer: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    qrPlaceholder: {
        width: 120,
        height: 120,
        borderWidth: 2,
        borderColor: '#4a4e69',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    qrText: {
        fontSize: 14,
        color: '#4a4e69',
        fontWeight: 'bold',
    },
    qrLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
    },
    cardFooter: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 12,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    additionalInfoContainer: {
        backgroundColor: '#16213e',
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    detailLabel: {
        fontSize: 14,
        color: '#999',
    },
    detailValue: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },
})
