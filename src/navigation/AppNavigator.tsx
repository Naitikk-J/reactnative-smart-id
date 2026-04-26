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
import AlertsScreen from "../screens/AlertsScreen"
import EIdCardScreen from "../screens/EIdCardScreen"
import PinkSlipScreen from "../screens/PinkSlipScreen"
import ProfileScreen from "../screens/ProfileScreen"

const Stack = createNativeStackNavigator()
const Tabs = createBottomTabNavigator()

const TAB_META: Record<string, { icon: string; title: string }> = {
    Dashboard: { icon: "⌂", title: "Home" },
    Scanner: { icon: "◎", title: "Scanner" },
    EIdCard: { icon: "⊡", title: "ID Card" },
    Logs: { icon: "≣", title: "Logs" },
    Alerts: { icon: "⚑", title: "Alerts" },
}

function AppTabs() {
    return (
        <Tabs.Navigator
            screenOptions={({ route }) => ({
                headerStyle: {
                    backgroundColor: APP_THEME.surfaceDark,
                    shadowColor: "transparent",
                    borderBottomWidth: 1,
                    borderBottomColor: APP_THEME.glassBorder,
                },
                headerTitleStyle: { color: APP_THEME.text, fontWeight: "700", fontSize: 17 },
                headerTintColor: APP_THEME.text,
                sceneStyle: { backgroundColor: APP_THEME.bg },
                tabBarStyle: styles.tabBar,
                tabBarItemStyle: styles.tabItem,
                tabBarLabelStyle: styles.tabLabel,
                tabBarActiveTintColor: APP_THEME.accent,
                tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
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
            <Tabs.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
            <Tabs.Screen
                name="EIdCard"
                component={EIdCardScreen}
                options={{ title: "Digital ID Card" }}
            />
            <Tabs.Screen name="Logs" component={LogsScreen} />
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
                    <>
                        <Stack.Screen name="App" component={AppTabs} />
                        <Stack.Screen
                            name="PinkSlip"
                            component={PinkSlipScreen}
                            options={{
                                headerShown: true,
                                title: "Pink Slip",
                                headerStyle: {
                                    backgroundColor: APP_THEME.surfaceDark,
                                },
                                headerTitleStyle: {
                                    color: APP_THEME.text,
                                    fontWeight: "700",
                                },
                                headerTintColor: APP_THEME.text,
                            }}
                        />
                        <Stack.Screen
                            name="Profile"
                            component={ProfileScreen}
                            options={{
                                headerShown: true,
                                title: "Edit Profile",
                                headerStyle: {
                                    backgroundColor: APP_THEME.surfaceDark,
                                },
                                headerTitleStyle: {
                                    color: APP_THEME.text,
                                    fontWeight: "700",
                                },
                                headerTintColor: APP_THEME.text,
                            }}
                        />
                    </>
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
        height: 72,
        borderTopColor: "transparent",
        borderRadius: 22,
        paddingTop: 6,
        paddingBottom: Platform.select({ ios: 12, default: 8 }),
        backgroundColor: APP_THEME.surfaceDark,
        borderWidth: 1,
        borderColor: APP_THEME.glassBorder,
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 20,
    },
    tabItem: {
        marginHorizontal: 2,
        borderRadius: 14,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: "700",
        marginBottom: 2,
    },
    iconWrap: {
        width: 32,
        height: 26,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
    },
    iconWrapActive: {
        backgroundColor: "rgba(0,212,255,0.14)",
    },
    iconText: {
        fontSize: 16,
        fontWeight: "700",
    },
})
