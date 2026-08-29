import { AdminMfaGate } from "@/components/admin/AdminMfaGate";
import { AdminDashboardScreen } from "@/screens/admin/AdminDashboardScreen";

/**
 * The second factor is asked for here and nowhere else: only the admin panel
 * is behind it, the regular coupon app is not.
 */
export default function AdminRoute() {
  return (
    <AdminMfaGate>
      <AdminDashboardScreen />
    </AdminMfaGate>
  );
}
