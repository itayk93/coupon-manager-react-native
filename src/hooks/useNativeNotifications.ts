import { useCallback, useEffect, useState } from "react";
import {
  getNativePushState,
  isNativePushSupported,
  sendTestNativePush,
  subscribeToNativePush,
  unsubscribeFromNativePush,
} from "@/lib/nativeNotifications";
import { useAuth } from "@/contexts/AuthContext";

type NativePushState = {
  supported: boolean;
  permission: "granted" | "denied" | "undetermined";
  subscribed: boolean;
  expoToken?: string | null;
};

const DEFAULT_STATE: NativePushState = {
  supported: false,
  permission: "undetermined",
  subscribed: false,
};

export function useNativeNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NativePushState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isNativePushSupported()) {
      setIsLoading(false);
      setState(DEFAULT_STATE);
      return;
    }
    setIsLoading(true);
    try {
      setState(await getNativePushState());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!user) {
      throw new Error("נדרש משתמש מחובר כדי להפעיל Push.");
    }
    setIsBusy(true);
    try {
      await subscribeToNativePush();
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [refresh, user]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    try {
      await unsubscribeFromNativePush();
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  const sendTest = useCallback(async () => {
    if (!user) {
      throw new Error("נדרש משתמש מחובר כדי לשלוח בדיקה.");
    }
    setIsBusy(true);
    try {
      await sendTestNativePush();
    } finally {
      setIsBusy(false);
    }
  }, [user]);

  return {
    ...state,
    notificationsEnabled: state.subscribed && state.permission === "granted",
    isSupported: state.supported,
    isLoading,
    isBusy,
    enable,
    disable,
    sendTest,
    refresh,
  };
}
