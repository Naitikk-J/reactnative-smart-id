export interface User {
    id: string
    name: string
    email: string
    role: string
    gateId?: string | null
    appAccess?: string | null
    photoUrl?: string | null
    department?: string | null
    enrollmentNo?: string | null
    year?: number | null
    userType?: string | null
}

export function parseUser(raw: any): User {
    return {
        id: String(raw?.id ?? ""),
        name: String(raw?.name ?? raw?.fullName ?? ""),
        email: String(raw?.email ?? ""),
        role: String(raw?.role ?? "STUDENT"),
        gateId: raw?.gateId != null ? String(raw.gateId) : null,
        appAccess: raw?.appAccess != null ? String(raw.appAccess) : null,
        photoUrl: raw?.photoUrl != null ? String(raw.photoUrl) : null,
        department: raw?.department != null ? String(raw.department) : null,
        enrollmentNo: raw?.enrollmentNo != null ? String(raw.enrollmentNo) : null,
        year: raw?.year != null ? Number(raw.year) : null,
        userType: raw?.userType != null ? String(raw.userType) : null,
    }
}

export const isEventOnly = (user: User): boolean => user.appAccess === 'EVENT_ONLY'
export const isCollegeStudent = (user: User): boolean => user.userType === 'COLLEGE_STUDENT'
export const isExternalUser = (user: User): boolean => user.userType === 'EXTERNAL_USER'
