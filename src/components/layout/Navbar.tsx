import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, Bell } from 'lucide-react';

export function Navbar({
  onMenuClick,
  menuButtonRef,
  isSidebarOpen,
  inert,
}: {
  onMenuClick?: () => void;
  menuButtonRef?: React.Ref<HTMLButtonElement>;
  isSidebarOpen?: boolean;
  /** Set while the mobile drawer is open so the topbar leaves the a11y tree. */
  inert?: '';
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initial = (user?.first_name || user?.email || 'I').charAt(0).toUpperCase();
  const accountName = user?.first_name || user?.email || '';

  return (
    <header className="dashboard-topbar sticky top-0 z-50 w-full" {...(inert === '' ? { inert: '' } : {})}>
      <div className="dashboard-topbar-inner">
        <div className="dashboard-brand-area">
          {onMenuClick && (
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="dashboard-menu-button lg:hidden"
              onClick={onMenuClick}
              aria-label="פתח תפריט"
              aria-expanded={isSidebarOpen ?? false}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <Link to="/" className="dashboard-brand flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="קופון מאסטר" className="h-8 w-8 rounded-lg shadow-sm object-cover" />
            <span className="font-bold text-lg tracking-tight">קופון מאסטר</span>
          </Link>
        </div>

        <div className="dashboard-topbar-actions">
          <button className="dashboard-icon-button dashboard-bell" aria-label="התראות" onClick={() => navigate('/notifications')}>
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          {/* The initial is decorative; the account name carries the meaning. */}
          <div className="dashboard-avatar">
            <span aria-hidden="true">{initial}</span>
            <span className="sr-only">{`מחובר כ${accountName}`}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
