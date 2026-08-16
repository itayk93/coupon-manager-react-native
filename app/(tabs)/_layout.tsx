import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { BarChart3, QrCode, Settings, Tag, WalletCards } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";

export default function TabsLayout() {
  const { theme } = useAppTheme();

  return (
    <Tabs
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
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "ארנק",
          tabBarIcon: ({ color, size }) => <WalletCards color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="coupons"
        options={{
          tabBarLabel: "קופונים",
          tabBarIcon: ({ color, size }) => <Tag color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          tabBarLabel: "סריקה",
          tabBarIcon: () => (
            <View style={[styles.scannerTabIcon, { backgroundColor: theme.primaryMuted }]}>
              <QrCode color={theme.primary} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          tabBarLabel: "דוחות",
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "הגדרות",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size || 22} />,
        }}
      />
    </Tabs>
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
