import { useSyncExternalStore } from "react";
import {
  getOfflineWalletStatus,
  subscribeOfflineWallet,
} from "@/lib/offlineCoupons";

export function useOfflineWalletStatus() {
  return useSyncExternalStore(
    subscribeOfflineWallet,
    getOfflineWalletStatus,
    getOfflineWalletStatus,
  );
}
