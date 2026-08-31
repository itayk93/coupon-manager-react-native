import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { couponVault } from "@/lib/couponVault";
import { notify } from "@/lib/notify";

export type SaleInput = {
  salePrice: number;
  buyerFirstName: string;
  buyerLastName: string;
  buyerPhone: string;
  buyerEmail?: string;
};

export type CouponSale = {
  id: number;
  coupon_id: number;
  seller_user_id: number;
  buyer_user_id: number | null;
  sale_type: "manual" | "transfer";
  status: "pending" | "completed" | "declined" | "cancelled";
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_phone: string;
  buyer_email: string | null;
  sale_price: number;
  coupon_value_snapshot: number;
  coupon_cost_snapshot: number;
  coupon_used_value_snapshot: number;
  company_snapshot: string;
  expiration_snapshot: string | null;
  sold_at: string | null;
  created_at: string;
};

export function useCouponSales() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coupon_sales", user?.id],
    queryFn: () => couponVault<CouponSale[]>({ action: "list_sales" }),
    enabled: !!user,
  });
}

export function useRecordManualSale() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ couponId, sale }: { couponId: number; sale: SaleInput }) =>
      couponVault<{ id: number }>({ action: "record_manual_sale", couponId, sale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      queryClient.invalidateQueries({ queryKey: ["coupon_sales", user?.id] });
      notify.success("המכירה נשמרה", "הקופון הוסר מהארנק הפעיל");
    },
    onError: (error: Error) => notify.error("שמירת המכירה נכשלה", error.message),
  });
}
