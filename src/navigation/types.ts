import { NavigatorScreenParams } from "@react-navigation/native";
import { DecryptedCoupon } from "@/hooks/useCoupons";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  CouponsTab: { initialFilterTag?: string; initialCompany?: string } | undefined;
  ScannerTab: undefined;
  StatisticsTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  CouponDetail: { couponId: number };
  AddCoupon: { initialCompany?: string; initialCode?: string; initialValue?: number };
  EditCoupon: { coupon: DecryptedCoupon };
  BulkImport: undefined;
  Sharing: undefined;
  Notifications: undefined;
  Profile: undefined;
  AdminDashboard: undefined;
  About: undefined;
  Faq: undefined;
  Privacy: undefined;
  Issues: undefined;
};
