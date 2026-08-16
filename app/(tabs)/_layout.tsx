import { Platform, StyleSheet } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { BarChart3, Home, Share2, Ticket, User } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

/**
 * Bottom navigation from the redesign: דשבורד / קופונים / סטטיסטיקה / שיתופים / חשבון.
 *
 * The scanner is no longer a tab (the design does not give it one); it stays
 * reachable as a pushed route from the coupons list so the feature is kept.
 */
export default function TabsLayout() {
  const { theme } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 86 : 66,
          paddingBottom: Platform.OS === "ios" ? 26 : 10,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "דשבורד",
          tabBarIcon: ({ color }) => <Home color={color} size={20} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="coupons"
        options={{
          tabBarLabel: "קופונים",
          tabBarIcon: ({ color }) => <Ticket color={color} size={20} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          tabBarLabel: "סטטיסטיקה",
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={20} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="sharing"
        options={{
          tabBarLabel: "שיתופים",
          tabBarIcon: ({ color }) => <Share2 color={color} size={20} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "חשבון",
          tabBarIcon: ({ color }) => <User color={color} size={20} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    fontWeight: "800",
  },
});
