import React from "react";
import { StyleSheet, Platform, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  WalletCards,
  Tag,
  QrCode,
  BarChart3,
  Settings,
} from "lucide-react-native";
import { MainTabParamList } from "./types";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { CouponsListScreen } from "@/screens/coupons/CouponsListScreen";
import { BarcodeScannerScreen } from "@/screens/scanner/BarcodeScannerScreen";
import { StatisticsScreen } from "@/screens/statistics/StatisticsScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { useAppTheme } from "@/contexts/ThemeContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: "ארנק",
          tabBarIcon: ({ color, size }) => (
            <WalletCards color={color} size={size || 22} />
          ),
        }}
      />
      <Tab.Screen
        name="CouponsTab"
        component={CouponsListScreen}
        options={{
          tabBarLabel: "קופונים",
          tabBarIcon: ({ color, size }) => (
            <Tag color={color} size={size || 22} />
          ),
        }}
      />
      <Tab.Screen
        name="ScannerTab"
        component={BarcodeScannerScreen}
        options={{
          tabBarLabel: "סריקה",
          tabBarIcon: ({ color, size }) => (
            <View
              style={[
                styles.scannerTabIcon,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <QrCode color={theme.primary} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="StatisticsTab"
        component={StatisticsScreen}
        options={{
          tabBarLabel: "דוחות",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size || 22} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: "הגדרות",
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size || 22} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scannerTabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
