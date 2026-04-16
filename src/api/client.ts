import axios from "axios"
import { API_BASE_URL, STORAGE_KEYS } from "../config/constants"
import { readSecureValueSafe } from "../utils/secureStorage"

export const api = axios.create({
    baseURL: API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`,
    timeout: 12000,
})

api.interceptors.request.use(async (config) => {
    const token = await readSecureValueSafe(STORAGE_KEYS.token)
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    if (__DEV__) {
        const method = (config.method ?? "GET").toUpperCase()
        const url = `${config.baseURL ?? ""}${config.url ?? ""}`
        console.log(`API ${method} ${url}`)
    }

    return config
})
