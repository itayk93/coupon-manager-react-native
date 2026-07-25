import { useState } from 'react';
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

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { isAdmin, signOut } = useAuth();

  const navigation = [
    { name: 'דשבורד', href: '/', icon: LayoutDashboard },
    { name: 'קופונים', href: '/coupons', icon: Tags },
    { name: 'סטטיסטיקות', href: '/statistics', icon: BarChart3 },
    { name: 'שיתופים', href: '/sharing', icon: Share2 },
    { name: 'חשבון', href: '/profile', icon: Settings },
  ];

  if (isAdmin) {
    navigation.push({ name: 'פאנל ניהול', href: '/admin', icon: ShieldAlert });
  }

  const mobileNavigation = navigation.slice(0, 5);

  return (
    <div className="coupon-master-app dashboard-shell" dir="rtl">
      <a className="skip-link" href="#main-content">דלג לתוכן הראשי</a>
      <Navbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="dashboard-body">
        <aside className="dashboard-sidebar hidden lg:flex">
          <nav className="dashboard-nav">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                               (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
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
            <button
              type="button"
              aria-label="סגירת תפריט"
              className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm" 
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="dashboard-sidebar mobile">
              <div className="dashboard-sidebar-mobile-title flex items-center gap-2">
                <img src="/logo-icon.png" alt="קופון מאסטר" className="h-7 w-7 rounded-lg object-cover" />
                <span>קופון מאסטר</span>
              </div>
              <nav className="dashboard-nav">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href || 
                                  (item.href !== '/' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsSidebarOpen(false)}
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
          </div>
        )}

        <div className="dashboard-main-wrap">
            <main id="main-content" className="dashboard-main">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="dashboard-bottom-nav" aria-label="ניווט ראשי">
        {mobileNavigation.map((item) => {
          const isActive = location.pathname === item.href || 
                           (item.href !== '/' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              to={item.href}
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
    </div>
  );
}

