import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { AuthNavigator } from "./AuthNavigator";
import { TabNavigator } from "./TabNavigator";
import { CouponDetailScreen } from "@/screens/coupons/CouponDetailScreen";
import { AddEditCouponScreen } from "@/screens/coupons/AddEditCouponScreen";
import { BulkImportScreen } from "@/screens/coupons/BulkImportScreen";
import { SharingScreen } from "@/screens/sharing/SharingScreen";
import { NotificationsScreen } from "@/screens/notifications/NotificationsScreen";
import { ProfileScreen } from "@/screens/settings/ProfileScreen";
import { AdminDashboardScreen } from "@/screens/admin/AdminDashboardScreen";
import { AboutScreen } from "@/screens/content/AboutScreen";
import { FaqScreen } from "@/screens/content/FaqScreen";
import { PrivacyScreen } from "@/screens/content/PrivacyScreen";
import { IssuesScreen } from "@/screens/content/IssuesScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { theme } = useAppTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {!session ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="CouponDetail" component={CouponDetailScreen} />
          <Stack.Screen name="AddCoupon" component={AddEditCouponScreen} />
          <Stack.Screen name="EditCoupon" component={AddEditCouponScreen} />
          <Stack.Screen name="BulkImport" component={BulkImportScreen} />
          <Stack.Screen name="Sharing" component={SharingScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="Faq" component={FaqScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="Issues" component={IssuesScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
