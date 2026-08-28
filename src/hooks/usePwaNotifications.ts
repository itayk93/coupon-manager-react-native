import { useCallback, useEffect, useState } from 'react';
import {
  getPushState,
  maybePromptPushOnFirstPwaLaunch,
  sendTestPushToUser,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushState,
} from '@/lib/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const DEFAULT_STATE: PushState = {
  supported: false,
  reason: 'טוען...',
  isIos: false,
  isStandalone: false,
  permission: 'default',
  subscribed: false,
};

export function usePwaNotifications() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [state, setState] = useState<PushState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setState(await getPushState());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.email || !profile?.id) return;
    void maybePromptPushOnFirstPwaLaunch(user.email);
  }, [user?.email, profile?.id]);

  const enable = useCallback(async () => {
    if (!user?.email || !profile?.id) {
      throw new Error('נדרש משתמש מחובר כדי להפעיל Push.');
    }
    setIsBusy(true);
    try {
      await subscribeToPushNotifications(user.email);
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [profile?.id, refresh, user?.email]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    try {
      await unsubscribeFromPushNotifications();
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  const sendTest = useCallback(async () => {
    if (!user?.email || !profile?.id) {
      throw new Error('נדרש משתמש מחובר כדי לשלוח בדיקה.');
    }
    setIsBusy(true);
    try {
      await sendTestPushToUser(user.email);
    } finally {
      setIsBusy(false);
    }
  }, [profile?.id, user?.email]);

  return {
    ...state,
    notificationsEnabled: state.subscribed && state.permission === 'granted',
    isSupported: state.supported,
    isLoading,
    isBusy,
    enable,
    disable,
    sendTest,
    refresh,
  };
}
