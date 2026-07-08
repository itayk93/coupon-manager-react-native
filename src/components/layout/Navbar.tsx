import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/ThemeProvider';
import { Menu, Moon, Sun, Bell } from 'lucide-react';

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const initial = (user?.first_name || user?.email || 'I').charAt(0).toUpperCase();

  return (
    <header className="dashboard-topbar sticky top-0 z-50 w-full">
      <div className="dashboard-topbar-inner">
        <div className="dashboard-brand-area">
          {onMenuClick && (
            <Button variant="ghost" size="icon" className="dashboard-menu-button lg:hidden" onClick={onMenuClick} aria-label="פתח תפריט">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link to="/" className="dashboard-brand">Coupon Master</Link>
        </div>

        <div className="dashboard-topbar-actions">
          <button className="dashboard-icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="החלף נושא">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </button>

          <button className="dashboard-icon-button dashboard-bell" aria-label="התראות" onClick={() => navigate('/notifications')}>
            <Bell className="h-5 w-5" />
            <span />
          </button>

          <div className="dashboard-avatar" aria-label="משתמש מחובר">{initial}</div>
        </div>
      </div>
    </header>
  );
}
