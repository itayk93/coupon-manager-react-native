import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { isWidgetSupported } from '../../modules/coupon-widget';
import { supabase } from '@/integrations/supabase/client';
import { couponVault } from '@/lib/couponVault';
import { syncWidget } from '@/lib/widgetSync';
import type { DecryptedCoupon } from '@/types/coupon';

const TASK_NAME = 'coupon-widget-background-refresh';
let generation = 0;
let registration = Promise.resolve();

/** Prevents work started before logout from restoring private widget data. */
export function widgetWriteGuard(): () => boolean {
  const current = generation;
  return () => generation === current;
}

async function refreshWidget(): Promise<BackgroundTask.BackgroundTaskResult> {
  const mayWrite = widgetWriteGuard();
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.user?.email || !mayWrite()) return BackgroundTask.BackgroundTaskResult.Success;
    const userId = session.user.id;
    const [coupons, companies, profile] = await Promise.all([
      couponVault<DecryptedCoupon[]>({ action: 'list' }),
      supabase.from('companies').select('name,image_path'),
      supabase.from('users').select('created_at').eq('email', session.user.email.toLowerCase()).maybeSingle(),
    ]);
    if (companies.error) throw companies.error;
    if (profile.error) throw profile.error;
    const images: Record<string, string | null> = {};
    for (const company of companies.data ?? []) if (company.name) images[company.name] = company.image_path;
    await syncWidget(coupons, images, profile.data?.created_at ?? null, async () => {
      if (!mayWrite()) return false;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      return mayWrite() && data.session?.user.id === userId;
    });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('[widget] background refresh failed', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, refreshWidget);
}

export function startWidgetBackgroundRefresh(): Promise<void> {
  if (!isWidgetSupported) return Promise.resolve();
  const mayWrite = widgetWriteGuard();
  const operation = registration.catch((error) => { console.warn('[widget] task registration failed', error); }).then(async () => {
    if (mayWrite() && !(await TaskManager.isTaskRegisteredAsync(TASK_NAME)) && mayWrite()) {
      await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 60 });
    }
  });
  registration = operation;
  return operation;
}

export function stopWidgetBackgroundRefresh(): Promise<void> {
  generation++;
  if (!isWidgetSupported) return Promise.resolve();
  const operation = registration.catch((error) => { console.warn('[widget] task registration failed', error); }).then(async () => {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  });
  registration = operation;
  return operation;
}
