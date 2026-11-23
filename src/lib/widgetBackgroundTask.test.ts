import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registered: false,
  register: vi.fn(async () => { mocks.registered = true; }),
  unregister: vi.fn(async () => { mocks.registered = false; }),
  session: { user: { id: 'user-a', email: 'a@example.com' } } as any,
  list: vi.fn(async () => [{ id: 1 }]),
  sync: vi.fn(async (_coupons: unknown, _images: unknown, _member: unknown, _guard: () => Promise<boolean>) => {}),
  task: undefined as undefined | (() => Promise<number>),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-task-manager', () => ({ defineTask: (_: string, task: () => Promise<number>) => { mocks.task = task; }, isTaskDefined: () => false, isTaskRegisteredAsync: async () => mocks.registered }));
vi.mock('expo-background-task', () => ({ BackgroundTaskResult: { Success: 1, Failed: 2 }, registerTaskAsync: mocks.register, unregisterTaskAsync: mocks.unregister }));
vi.mock('../../modules/coupon-widget', () => ({ isWidgetSupported: true }));
vi.mock('@/lib/couponVault', () => ({ couponVault: mocks.list }));
vi.mock('@/lib/widgetSync', () => ({ syncWidget: mocks.sync }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: mocks.session }, error: null }) }, from: (table: string) => ({ select: () => table === 'companies' ? Promise.resolve({ data: [], error: null }) : { eq: () => ({ maybeSingle: async () => ({ data: { created_at: null }, error: null }) }) } }) } }));

const { startWidgetBackgroundRefresh, stopWidgetBackgroundRefresh, widgetWriteGuard } = await import('./widgetBackgroundTask');
beforeEach(() => { mocks.registered = false; mocks.session = { user: { id: 'user-a', email: 'a@example.com' } }; mocks.register.mockClear(); mocks.unregister.mockClear(); mocks.sync.mockClear(); mocks.list.mockClear(); });
describe('widget background refresh', () => {
  it('registers only once and unregisters on sign out', async () => {
    await startWidgetBackgroundRefresh(); await startWidgetBackgroundRefresh(); await stopWidgetBackgroundRefresh();
    expect(mocks.register).toHaveBeenCalledTimes(1); expect(mocks.unregister).toHaveBeenCalledTimes(1);
  });
  it('invalidates pending writes as soon as sign out begins', async () => {
    const guard = widgetWriteGuard(); expect(guard()).toBe(true);
    const stopping = stopWidgetBackgroundRefresh(); expect(guard()).toBe(false); await stopping;
  });
  it('refreshes authenticated coupons and rejects a write after account change', async () => {
    expect(await mocks.task!()).toBe(1); expect(mocks.sync).toHaveBeenCalledTimes(1);
    const guard = mocks.sync.mock.calls[0][3] as () => Promise<boolean>;
    expect(await guard()).toBe(true); mocks.session = { user: { id: 'user-b' } }; expect(await guard()).toBe(false);
  });
  it('does not fetch coupons without a session', async () => {
    mocks.session = null; expect(await mocks.task!()).toBe(1); expect(mocks.list).not.toHaveBeenCalled();
  });
});
