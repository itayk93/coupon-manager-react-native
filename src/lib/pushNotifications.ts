import { supabase } from '@/integrations/supabase/client';

type MaybeStandaloneNavigator = Navigator & { standalone?: boolean };

export type PushState = {
  supported: boolean;
  reason?: string;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
};

const IOS_REGEX = /iphone|ipad|ipod/i;

function toPlatformLabel(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  return 'Unknown';
}

function isStandaloneMode() {
  const mediaMatch = window.matchMedia('(display-mode: standalone)').matches;
  const legacyNavigator = navigator as MaybeStandaloneNavigator;
  return mediaMatch || legacyNavigator.standalone === true;
}

function assertPushSupport() {
  const isIos = IOS_REGEX.test(navigator.userAgent);
  const isStandalone = isStandaloneMode();

  if (!window.isSecureContext) {
    return { supported: false, reason: 'Push דורש HTTPS או localhost.', isIos, isStandalone };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'הדפדפן לא תומך ב-Service Worker.', isIos, isStandalone };
  }

  if (!('PushManager' in window)) {
    return { supported: false, reason: 'הדפדפן לא תומך ב-Web Push.', isIos, isStandalone };
  }

  if (!('Notification' in window)) {
    return { supported: false, reason: 'הדפדפן לא תומך בהתראות מערכת.', isIos, isStandalone };
  }

  if (isIos && !isStandalone) {
    return {
      supported: false,
      reason: 'באייפון צריך קודם להתקין את האפליקציה למסך הבית כדי לקבל Push.',
      isIos,
      isStandalone,
    };
  }

  return { supported: true, isIos, isStandalone };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function invokePushFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('push-notifications', { body });
  if (error) {
    throw new Error(error.message || 'שירות ה-Push לא זמין כרגע.');
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data;
}

async function getServiceWorkerScriptProblem(): Promise<string | undefined> {
  try {
    const response = await fetch('/sw.js', { cache: 'no-store' });
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';

    if (!response.ok || !contentType.includes('javascript')) {
      return 'התראות Push אינן זמינות כרגע בגרסת הפיתוח המקומית.';
    }
  } catch {
    return 'לא ניתן לטעון את שירות ההתראות כרגע.';
  }

  return undefined;
}

async function ensureRegistration() {
  const current = await navigator.serviceWorker.getRegistration();
  if (current) return current;

  const scriptProblem = await getServiceWorkerScriptProblem();
  if (scriptProblem) throw new Error(scriptProblem);

  return navigator.serviceWorker.register('/sw.js');
}

export async function getPushState(): Promise<PushState> {
  const support = assertPushSupport();
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

  if (!support.supported) {
    return { ...support, permission, subscribed: false };
  }

  try {
    const scriptProblem = await getServiceWorkerScriptProblem();
    if (scriptProblem) {
      return { ...support, supported: false, reason: scriptProblem, permission, subscribed: false };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    return { ...support, permission, subscribed: Boolean(subscription) };
  } catch {
    return {
      ...support,
      supported: false,
      reason: 'נכשלה בדיקת מצב ההתראות.',
      permission,
      subscribed: false,
    };
  }
}

export async function subscribeToPushNotifications(userEmail: string, userId: number) {
  const support = assertPushSupport();
  if (!support.supported) {
    throw new Error(support.reason || 'Push לא נתמך בדפדפן זה.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error('לא ניתנה הרשאה להתראות.');
  }

  await ensureRegistration();
  const readyRegistration = await navigator.serviceWorker.ready;
  let subscription = await readyRegistration.pushManager.getSubscription();

  if (!subscription) {
    const data = await invokePushFunction({ action: 'public-key' });
    if (!data?.publicKey) {
      throw new Error('לא התקבל מפתח Push מהשרת.');
    }

    subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  await invokePushFunction({
    action: 'subscribe',
    subscription: subscription.toJSON(),
    platform: toPlatformLabel(),
    user_id: userId,
    user_email: userEmail,
  });
}

export async function unsubscribeFromPushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = subscription?.endpoint;

  if (subscription) {
    await subscription.unsubscribe();
  }

  if (endpoint) {
    await invokePushFunction({ action: 'unsubscribe', endpoint });
  }
}

export async function sendTestPushToUser(userEmail: string, userId: number) {
  return invokePushFunction({
    action: 'test-user',
    user_email: userEmail,
    user_id: userId,
    payload: {
      title: 'קופון מאסטר',
      body: 'זוהי התראת בדיקה. מערכת ה-Push פעילה.',
      url: '/notifications',
      tag: 'coupon-master-test',
      requireInteraction: false,
      renotify: true,
    },
  });
}

export async function maybePromptPushOnFirstPwaLaunch(userEmail?: string, userId?: number) {
  if (!userEmail || !userId || typeof window === 'undefined') return;

  const support = assertPushSupport();
  if (!support.supported || !support.isStandalone) return;
  if (Notification.permission !== 'default') return;

  let inFlight = false;

  const cleanup = () => {
    window.removeEventListener('pointerdown', interactionHandler, true);
    window.removeEventListener('keydown', interactionHandler, true);
    window.removeEventListener('touchend', interactionHandler, true);
  };

  const attemptPrompt = async () => {
    if (inFlight) return;
    if (Notification.permission !== 'default') {
      cleanup();
      return;
    }

    inFlight = true;
    try {
      await subscribeToPushNotifications(userEmail, userId);
      cleanup();
    } catch {
      if (Notification.permission !== 'default') {
        cleanup();
      }
    } finally {
      inFlight = false;
    }
  };

  const interactionHandler = () => {
    void attemptPrompt();
  };

  void attemptPrompt();
  window.addEventListener('pointerdown', interactionHandler, true);
  window.addEventListener('keydown', interactionHandler, true);
  window.addEventListener('touchend', interactionHandler, true);
}
