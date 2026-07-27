import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, Bell } from 'lucide-react';

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();
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
          <Link to="/" className="dashboard-brand flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="קופון מאסטר" className="h-8 w-8 rounded-lg shadow-sm object-cover" />
            <span className="font-bold text-lg tracking-tight">קופון מאסטר</span>
          </Link>
        </div>

        <div className="dashboard-topbar-actions">
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
