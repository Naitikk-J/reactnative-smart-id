import React from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native"
import { useAuth } from "../context/AuthContext"
import { APP_THEME } from "../config/constants"
import LoginScreen from "../screens/LoginScreen"
import DashboardScreen from "../screens/DashboardScreen"
import ScannerScreen from "../screens/ScannerScreen"
import LogsScreen from "../screens/LogsScreen"
import PinkSlipScreen from "../screens/PinkSlipScreen"
import AlertsScreen from "../screens/AlertsScreen"

const Stack = createNativeStackNavigator()
const Tabs = createBottomTabNavigator()

const TAB_META: Record<string, { icon: string; title: string }> = {
    Dashboard: { icon: "⌂", title: "Home" },
    Scanner: { icon: "◎", title: "Scanner" },
    Logs: { icon: "≣", title: "Logs" },
    "Pink Slip": { icon: "▣", title: "Slips" },
    Alerts: { icon: "⚑", title: "Alerts" },
}

function AppTabs() {
    return (
        <Tabs.Navigator
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: APP_THEME.card, shadowColor: "transparent" },
                headerTitleStyle: { color: APP_THEME.text, fontWeight: "700" },
                headerTintColor: APP_THEME.text,
                sceneStyle: { backgroundColor: APP_THEME.bg },
                tabBarStyle: styles.tabBar,
                tabBarItemStyle: styles.tabItem,
                tabBarLabelStyle: styles.tabLabel,
                tabBarActiveTintColor: APP_THEME.accent,
                tabBarInactiveTintColor: APP_THEME.muted,
                tabBarIcon: ({ color, focused }) => {
                    const tab = TAB_META[route.name] ?? { icon: "•", title: route.name }
                    return (
                        <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                            <Text style={[styles.iconText, { color }]}>{tab.icon}</Text>
                        </View>
                    )
                },
                tabBarLabel: TAB_META[route.name]?.title ?? route.name,
            })}
        >
            <Tabs.Screen name="Dashboard" component={DashboardScreen} />
            <Tabs.Screen name="Scanner" component={ScannerScreen} />
            <Tabs.Screen name="Logs" component={LogsScreen} />
            <Tabs.Screen name="Pink Slip" component={PinkSlipScreen} />
            <Tabs.Screen name="Alerts" component={AlertsScreen} />
        </Tabs.Navigator>
    )
}

function LoadingScreen() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: APP_THEME.bg }}>
            <ActivityIndicator color={APP_THEME.accent} size="large" />
            <Text style={{ color: APP_THEME.muted, marginTop: 12 }}>Loading session...</Text>
        </View>
    )
}

export default function AppNavigator() {
    const { user, loading } = useAuth()

    if (loading) return <LoadingScreen />

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <Stack.Screen name="App" component={AppTabs} />
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    )
}

const styles = StyleSheet.create({
    tabBar: {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        height: 70,
        borderTopColor: "transparent",
        borderRadius: 22,
        paddingTop: 6,
        paddingBottom: Platform.select({ ios: 12, default: 8 }),
        backgroundColor: APP_THEME.card,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 16,
    },
    tabItem: {
        marginHorizontal: 2,
        borderRadius: 14,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: "700",
        marginBottom: 2,
    },
    iconWrap: {
        width: 30,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
    },
    iconWrapActive: {
        backgroundColor: "rgba(22,214,163,0.14)",
    },
    iconText: {
        fontSize: 16,
        fontWeight: "700",
    },
})
