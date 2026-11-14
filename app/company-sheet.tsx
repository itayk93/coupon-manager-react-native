import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { CompanySheetContent } from "@/components/dashboard/CompanySheetContent";
import { useCoupons } from "@/hooks/useCoupons";

/**
 * PILOT: CompanySheet as a native form sheet.
 *
 * The dashboard's company sheet used to be a hand-rolled Modal with a
 * PanResponder drag-to-close. This route presents the same content with the
 * platform's own sheet (react-native-screens formSheet): native grabber,
 * native swipe-to-dismiss, native detents. Only the dashboard (Home) links
 * here while the pilot runs; the companies tab still uses the modal.
 */
export default function CompanySheetRoute() {
  const { company } = useLocalSearchParams<{ company?: string }>();
  const router = useRouter();
  const { data: coupons = [] } = useCoupons();

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          sheetCornerRadius: 16,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      {typeof company === "string" && company.length > 0 ? (
        <CompanySheetContent
          company={company}
          coupons={coupons}
          onClose={() => router.back()}
        />
      ) : null}
    </>
  );
}
