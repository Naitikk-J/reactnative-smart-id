import { api } from "../api/client"

export async function getMyAlerts(limit = 20): Promise<any[]> {
    try {
        const response = await api.get("alerts/me", { params: { limit } })
        if (response.data?.success === true && Array.isArray(response.data?.data)) {
            return response.data.data
        }
        return []
    } catch {
        return []
    }
}
