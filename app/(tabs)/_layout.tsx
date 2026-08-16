import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { BarChart3, Home, Share2, Ticket, User } from "lucide-react-native";
import { AppHeader } from "@/components/layout/AppHeader";
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
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      <AppHeader />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 92 : 84,
          paddingBottom: Platform.OS === "ios" ? 28 : 18,
          paddingTop: 10,
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
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    fontWeight: "800",
    // Hebrew descenders were being clipped at the default line height.
    lineHeight: 15,
    marginTop: 3,
    paddingBottom: 2,
  },
});
