import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Tags, 
  BarChart3, 
  Share2, 
  Settings,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { PwaNotificationManager } from '@/components/PwaNotificationManager';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { isAdmin, signOut } = useAuth();
  const { hasFeature } = useFeatureAccess();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = () => setIsSidebarOpen(false);

  // The drawer is modal: keyboard users must not be able to tab behind the
  // overlay, and Escape must return them to the button that opened it.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const items = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Runs after the drawer is torn down. Removing a subtree that holds
      // focus resets it to <body>, so the restore has to happen here rather
      // than synchronously inside the close handler.
      menuButtonRef.current?.focus();
    };
  }, [isSidebarOpen]);

  const navigation = [
    { name: 'דשבורד', href: '/', icon: LayoutDashboard },
    { name: 'קופונים', href: '/coupons', icon: Tags },
    { name: 'סטטיסטיקות', href: '/statistics', icon: BarChart3 },
    { name: 'שיתופים', href: '/sharing', icon: Share2 },
    { name: 'חשבון', href: '/profile', icon: Settings },
  ].filter((item) => {
    if (item.href === '/' && !hasFeature('dashboard')) return false;
    if (item.href === '/coupons' && !hasFeature('coupons')) return false;
    if (item.href === '/statistics' && !hasFeature('statistics')) return false;
    if (item.href === '/sharing' && !hasFeature('sharing')) return false;
    if (item.href === '/profile' && !hasFeature('profile')) return false;
    return true;
  });

  if (isAdmin && hasFeature('admin')) {
    navigation.push({ name: 'פאנל ניהול', href: '/admin', icon: ShieldAlert });
  }

  const mobileNavigation = navigation.slice(0, 5);

  return (
    <div className="coupon-master-app dashboard-shell" dir="rtl">
      <a className="skip-link" href="#main-content">דלג לתוכן הראשי</a>
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        menuButtonRef={menuButtonRef}
        isSidebarOpen={isSidebarOpen}
      />

      <div className="dashboard-body">
        <aside className="dashboard-sidebar hidden lg:flex">
          <nav className="dashboard-nav" aria-label="ניווט צדדי">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                               (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "dashboard-nav-link",
                    isActive && "active"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <button className="dashboard-nav-link dashboard-logout" onClick={signOut}>
              <LogOut className="h-6 w-6" />
              <span>יציאה מהחשבון</span>
            </button>
          </nav>
        </aside>

        {isSidebarOpen && (
          <div className="mobile-sidebar-overlay lg:hidden">
            {/* Drawer before the scrim so the first Tab lands in the menu
                rather than on the control that dismisses it. */}
            <aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="תפריט ניווט"
              className="dashboard-sidebar mobile"
            >
              <div className="dashboard-sidebar-mobile-title flex items-center gap-2">
                <img src="/logo-icon.png" alt="קופון מאסטר" className="h-7 w-7 rounded-lg object-cover" />
                <span>קופון מאסטר</span>
              </div>
              <nav className="dashboard-nav" aria-label="ניווט ראשי">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href ||
                                  (item.href !== '/' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        "dashboard-nav-link",
                        isActive && "active"
                      )}
                    >
                      <item.icon className="h-6 w-6" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                <button className="dashboard-nav-link dashboard-logout" onClick={signOut}>
                  <LogOut className="h-6 w-6" />
                  <span>יציאה מהחשבון</span>
                </button>
              </nav>
            </aside>
            <button
              type="button"
              aria-label="סגירת תפריט"
              className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm"
              onClick={closeSidebar}
            />
          </div>
        )}

        <div className="dashboard-main-wrap">
            <main id="main-content" tabIndex={-1} className="dashboard-main">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="dashboard-bottom-nav" aria-label="ניווט תחתון">
        {mobileNavigation.map((item) => {
          const isActive = location.pathname === item.href ||
                           (item.href !== '/' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "dashboard-bottom-nav-link",
                isActive && "active"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <PwaInstallPrompt />
      <PwaNotificationManager />
      {hasFeature('onboarding') && <OnboardingTour />}
    </div>
  );
}
