import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { BarChart3, Home, Share2, Ticket, User } from "lucide-react-native";
import { AppHeader } from "@/components/layout/AppHeader";
import { OnboardingBanner } from "@/components/layout/OnboardingBanner";
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
      <OnboardingBanner />
      <Tabs
      // Declaration order is display order; reversed so דשבורד lands on the
      // right, where Hebrew starts.
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSubtle,
        // The persistent bar lives at the root (BottomNav) so it survives pushed
        // routes; this one would otherwise render a second copy on tab screens.
        tabBarStyle: { display: "none" },
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "חשבון",
          tabBarIcon: ({ color }) => <User color={color} size={20} strokeWidth={1.8} />,
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
        name="statistics"
        options={{
          tabBarLabel: "סטטיסטיקה",
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={20} strokeWidth={1.8} />,
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
        name="index"
        options={{
          tabBarLabel: "דשבורד",
          tabBarIcon: ({ color }) => <Home color={color} size={20} strokeWidth={1.8} />,
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
