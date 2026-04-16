import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { User } from "../types/User"
import * as authService from "../services/authService"

interface AuthContextValue {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
    logout: () => Promise<void>
    submitRebindRequest: (email: string, reason: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        authService
            .tryAutoLogin()
            .then((nextUser) => {
                if (mounted) setUser(nextUser)
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })

        return () => {
            mounted = false
        }
    }, [])

    const login = useCallback(async (email: string, password: string) => {
        const outcome = await authService.login(email, password)
        if (outcome.ok && outcome.user) {
            setUser(outcome.user)
            return { ok: true as const }
        }

        return { ok: false as const, error: outcome.error ?? "Login failed" }
    }, [])

    const logout = useCallback(async () => {
        await authService.logout()
        setUser(null)
    }, [])

    const submitRebindRequest = useCallback(async (email: string, reason: string) => {
        return authService.submitRebindRequestFromLogin(email, reason)
    }, [])

    const value = useMemo(
        () => ({ user, loading, login, logout, submitRebindRequest }),
        [user, loading, login, logout, submitRebindRequest],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error("useAuth must be used inside AuthProvider")
    }
    return ctx
}
