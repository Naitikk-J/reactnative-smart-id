import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"

async function readSecureValue(key: string): Promise<string | null> {
    try {
        const secureValue = await SecureStore.getItemAsync(key)
        if (secureValue != null) return secureValue
    } catch {
        // fall back to AsyncStorage
    }

    try {
        return await AsyncStorage.getItem(key)
    } catch {
        return null
    }
}

async function writeSecureValue(key: string, value: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(key, value)
    } catch {
        await AsyncStorage.setItem(key, value)
    }
}

async function deleteSecureValue(key: string): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(key)
    } catch {
        // ignore
    }

    try {
        await AsyncStorage.removeItem(key)
    } catch {
        // ignore
    }
}

async function clearStorage(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys()
        if (allKeys.length > 0) {
            await Promise.all(allKeys.map((key) => AsyncStorage.removeItem(key)))
        }
    } catch {
        // ignore
    }
}

export {
    readSecureValue as readSecureValueSafe,
    writeSecureValue as writeSecureValueSafe,
    deleteSecureValue as deleteSecureValueSafe,
    clearStorage as clearStorageSafe,
}
