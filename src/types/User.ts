export interface User {
    id: string
    name: string
    email: string
    role: string
    gateId?: string | null
}

export function parseUser(raw: any): User {
    return {
        id: String(raw?.id ?? ""),
        name: String(raw?.name ?? raw?.fullName ?? ""),
        email: String(raw?.email ?? ""),
        role: String(raw?.role ?? ""),
        gateId: raw?.gateId != null ? String(raw.gateId) : null,
    }
}
