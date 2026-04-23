import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { api } from '../api/client'
import { parseUser, User } from '../types/User'

GoogleSignin.configure({
    webClientId: '370233274408-ubv6hi020gqc8r8uarqikcnbcbeb78i3.apps.googleusercontent.com',
    scopes: ['email', 'profile'],
})

export class GoogleAuthService {
    private static instance: GoogleAuthService
    private currentUser: User | null = null

    static getInstance(): GoogleAuthService {
        if (!GoogleAuthService.instance) {
            GoogleAuthService.instance = new GoogleAuthService()
        }
        return GoogleAuthService.instance
    }

    async signIn(): Promise<{ success: boolean; user?: User; error?: string }> {
        try {
            await GoogleSignin.hasPlayServices()
            const userInfo = await GoogleSignin.signIn()

            if (!userInfo.idToken) {
                return { success: false, error: 'Failed to get Google ID token' }
            }

            // Send ID token to backend
            const response = await api.post('/auth/google', {
                idToken: userInfo.idToken,
            })

            if (response.data?.success) {
                const token = response.data.data.accessToken
                const userData = response.data.data.user

                // Store token
                await this.setToken(token)
                this.currentUser = parseUser(userData)

                return { success: true, user: this.currentUser }
            }

            return {
                success: false,
                error: response.data?.error || 'Authentication failed',
            }
        } catch (error: any) {
            console.error('Google Sign-In error:', error)
            return {
                success: false,
                error: error.message || 'Google sign-in failed',
            }
        }
    }

    async signOut(): Promise<void> {
        try {
            await GoogleSignin.signOut()
            await GoogleSignin.revokeAccess()
        } catch (_) {
            // Ignore errors during sign out
        }

        try {
            await api.post('/auth/logout')
        } catch (_) {
            // Ignore backend errors
        }

        await this.removeToken()
        this.currentUser = null
    }

    async trySilentSignIn(): Promise<{ success: boolean; user?: User }> {
        try {
            const isSignedIn = await GoogleSignin.isSignedIn()
            if (!isSignedIn) return { success: false }

            const userInfo = await GoogleSignin.getCurrentUser()
            if (!userInfo?.idToken) return { success: false }

            const response = await api.post('/auth/google', {
                idToken: userInfo.idToken,
            })

            if (response.data?.success) {
                const token = response.data.data.accessToken
                const userData = response.data.data.user

                await this.setToken(token)
                this.currentUser = parseUser(userData)

                return { success: true, user: this.currentUser }
            }

            return { success: false }
        } catch (error) {
            console.error('Silent sign-in error:', error)
            return { success: false }
        }
    }

    getCurrentUser(): User | null {
        return this.currentUser
    }

    private async setToken(token: string): Promise<void> {
        // Store token in AsyncStorage or secure storage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        await AsyncStorage.setItem('accessToken', token)
        api.defaults.headers.common.Authorization = `Bearer ${token}`
    }

    private async removeToken(): Promise<void> {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        await AsyncStorage.removeItem('accessToken')
        delete api.defaults.headers.common.Authorization
    }

    // Get E-ID Card data
    async getEIdCard(): Promise<any | null> {
        try {
            const response = await api.get('/auth/me')
            if (response.data?.success) {
                return response.data.data.user
            }
            return null
        } catch (error) {
            console.error('Failed to fetch E-ID card:', error)
            return null
        }
    }

    // Get student profile by enrollment number
    async getStudentProfile(enrollmentNo: string): Promise<any | null> {
        try {
            const response = await api.get('/students', {
                params: { search: enrollmentNo, limit: 1 },
            })
            if (response.data?.success && response.data.data.students.length > 0) {
                return response.data.data.students[0]
            }
            return null
        } catch (error) {
            console.error('Failed to fetch student profile:', error)
            return null
        }
    }
}

export const googleAuthService = GoogleAuthService.getInstance()
