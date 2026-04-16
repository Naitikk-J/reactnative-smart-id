import React from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { ActivityIndicator, Text, View } from "react-native"
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

function AppTabs() {
    return (
        <Tabs.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: APP_THEME.card },
                headerTintColor: APP_THEME.text,
                tabBarStyle: { backgroundColor: APP_THEME.card, borderTopColor: APP_THEME.border },
                tabBarActiveTintColor: APP_THEME.accent,
                tabBarInactiveTintColor: APP_THEME.muted,
            }}
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
