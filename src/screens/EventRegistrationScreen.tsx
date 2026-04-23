import React, { useEffect, useState, useCallback } from 'react'
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { isEventOnly } from '../types/User'

interface Event {
    id: string
    name: string
    description: string
    startDate: string
    endDate: string
    venue: string
    maxParticipants?: number
    participantCount: number
}

interface Registration {
    id: string
    eventId: string
    event: Event
    status: string
}

export const EventRegistrationScreen: React.FC = () => {
    const { user } = useAuth()
    const [events, setEvents] = useState<Event[]>([])
    const [registrations, setRegistrations] = useState<Registration[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadEvents = useCallback(async () => {
        try {
            const response = await api.get('/events/upcoming')
            if (response.data?.success) {
                setEvents(response.data.data.events || [])
            }
        } catch (error) {
            console.error('Failed to load events:', error)
        }
    }, [])

    const loadRegistrations = useCallback(async () => {
        try {
            const response = await api.get('/events/my-registrations')
            if (response.data?.success) {
                setRegistrations(response.data.data.registrations || [])
            }
        } catch (error) {
            console.error('Failed to load registrations:', error)
        }
    }, [])

    const loadData = useCallback(async () => {
        setLoading(true)
        await Promise.all([loadEvents(), loadRegistrations()])
        setLoading(false)
    }, [loadEvents, loadRegistrations])

    useEffect(() => {
        loadData()
    }, [loadData])

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        await Promise.all([loadEvents(), loadRegistrations()])
        setRefreshing(false)
    }, [loadEvents, loadRegistrations])

    const handleRegister = async (eventId: string) => {
        try {
            const response = await api.post(`/events/${eventId}/register`)
            if (response.data?.success) {
                Alert.alert('Success', 'Successfully registered for event!')
                loadRegistrations()
                loadEvents()
            } else {
                Alert.alert('Error', response.data?.error || 'Registration failed')
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Registration failed')
        }
    }

    const handleCancel = async (eventId: string) => {
        try {
            const response = await api.post(`/events/${eventId}/cancel`)
            if (response.data?.success) {
                Alert.alert('Success', 'Registration cancelled')
                loadRegistrations()
                loadEvents()
            } else {
                Alert.alert('Error', response.data?.error || 'Cancellation failed')
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Cancellation failed')
        }
    }

    const isRegistered = (eventId: string): boolean => {
        return registrations.some((reg) => reg.eventId === eventId)
    }

    const formatDate = (dateString: string): string => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString()
        } catch {
            return dateString
        }
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={styles.loadingText}>Loading events...</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            {user && isEventOnly(user) && (
                <View style={styles.eventOnlyBanner}>
                    <Text style={styles.eventOnlyText}>Event-Only Access Mode</Text>
                </View>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* My Registrations */}
                {registrations.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>My Registrations</Text>
                        {registrations.map((reg) => (
                            <View key={reg.id} style={styles.registrationCard}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.registeredBadge}>
                                        Registered
                                    </Text>
                                </View>
                                <Text style={styles.eventName}>
                                    {reg.event?.name || 'Unknown Event'}
                                </Text>
                                <Text style={styles.eventDescription}>
                                    {reg.event?.description || 'No description'}
                                </Text>
                                <View style={styles.eventMeta}>
                                    <Text style={styles.metaText}>
                                        {formatDate(reg.event?.startDate)}
                                    </Text>
                                    <Text style={styles.metaText}>
                                        {reg.event?.venue || 'TBA'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => handleCancel(reg.eventId)}
                                >
                                    <Text style={styles.cancelButtonText}>
                                        Cancel Registration
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                )}

                {/* Available Events */}
                <Text style={styles.sectionTitle}>Available Events</Text>

                {events.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            No upcoming events available
                        </Text>
                    </View>
                ) : (
                    events.map((event) => {
                        const registered = isRegistered(event.id)
                        const isFull =
                            event.maxParticipants &&
                            event.participantCount >= event.maxParticipants

                        return (
                            <View key={event.id} style={styles.eventCard}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.eventName}>
                                        {event.name}
                                    </Text>
                                    {isFull && !registered && (
                                        <View style={styles.fullBadge}>
                                            <Text style={styles.fullBadgeText}>
                                                FULL
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.eventDescription}>
                                    {event.description}
                                </Text>

                                <View style={styles.eventMeta}>
                                    <Text style={styles.metaText}>
                                        {formatDate(event.startDate)}
                                    </Text>
                                    <Text style={styles.metaText}>
                                        {event.venue || 'TBA'}
                                    </Text>
                                </View>

                                <Text style={styles.participantText}>
                                    {event.participantCount}
                                    {event.maxParticipants
                                        ? `/${event.maxParticipants}`
                                        : ''}{' '}
                                    registered
                                </Text>

                                <TouchableOpacity
                                    style={[
                                        styles.registerButton,
                                        (registered || isFull)
                                            ? styles.registerButtonDisabled
                                            : undefined,
                                        registered
                                            ? styles.registerButtonSuccess
                                            : undefined,
                                    ]}
                                    onPress={() => handleRegister(event.id)}
                                    disabled={Boolean(registered || isFull)}
                                >
                                    <Text
                                        style={[
                                            styles.registerButtonText,
                                            registered
                                                ? styles.registerButtonTextSuccess
                                                : undefined,
                                        ]}
                                    >
                                        {registered
                                            ? 'Registered'
                                            : isFull
                                                ? 'Event Full'
                                                : 'Register Now'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 16,
    },
    eventOnlyBanner: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        padding: 12,
        alignItems: 'center',
    },
    eventOnlyText: {
        color: '#fbbf24',
        fontWeight: '600',
        fontSize: 12,
    },
    scrollContent: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        marginTop: 8,
    },
    eventCard: {
        backgroundColor: '#16213e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    registrationCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    eventName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
    },
    eventDescription: {
        fontSize: 14,
        color: '#999',
        marginBottom: 12,
    },
    eventMeta: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    metaText: {
        fontSize: 12,
        color: '#666',
        marginRight: 16,
    },
    participantText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 12,
    },
    registeredBadge: {
        backgroundColor: '#10b981',
        color: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 'bold',
    },
    fullBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    fullBadgeText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold',
    },
    registerButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    registerButtonDisabled: {
        backgroundColor: '#374151',
    },
    registerButtonSuccess: {
        backgroundColor: '#10b981',
    },
    registerButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    registerButtonTextSuccess: {
        color: '#fff',
    },
    cancelButton: {
        marginTop: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#ef4444',
        fontSize: 14,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },
})
