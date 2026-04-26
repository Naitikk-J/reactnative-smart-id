/**
 * Geofencing utility — ported 1:1 from Flutter scan_service.dart
 * Campus coordinates: MITS Gwalior approximate center
 */

export const CAMPUS_CENTER_LAT = 26.2183
export const CAMPUS_CENTER_LNG = 78.1828
export const DEFAULT_GEOFENCE_RADIUS_METERS = 500.0

/** Calculate distance between two coordinates using Haversine formula */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const earthRadius = 6371000 // meters

    const toRad = (deg: number) => deg * (Math.PI / 180)

    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const radLat1 = toRad(lat1)
    const radLat2 = toRad(lat2)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(radLat1) *
            Math.cos(radLat2) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return earthRadius * c
}

/** Validate if user is within geofence */
export function validateGeofence(params: {
    userLat: number
    userLng: number
    centerLat?: number
    centerLng?: number
    radiusMeters?: number
}): boolean {
    const distance = calculateDistance(
        params.userLat,
        params.userLng,
        params.centerLat ?? CAMPUS_CENTER_LAT,
        params.centerLng ?? CAMPUS_CENTER_LNG,
    )
    return distance <= (params.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS)
}
