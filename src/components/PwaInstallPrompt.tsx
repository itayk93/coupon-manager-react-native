import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const LOCAL_DISMISSED_KEY = 'coupon_master_pwa_dismissed';
const LOCAL_INSTALLED_KEY = 'coupon_master_pwa_installed';

export function PwaInstallPrompt() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Check if prompt was previously dismissed or installed
  const isDismissed = 
    localStorage.getItem(LOCAL_DISMISSED_KEY) === 'true' || 
    Boolean(profile?.pwa_prompt_dismissed);

  const isInstalled = 
    localStorage.getItem(LOCAL_INSTALLED_KEY) === 'true' || 
    Boolean(profile?.pwa_installed);

  useEffect(() => {
    // If already dismissed or installed, do not register prompt listener
    if (isDismissed || isInstalled) {
      setShowPrompt(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem(LOCAL_INSTALLED_KEY, 'true');
      setShowPrompt(false);
      
      // Update DB if user is logged in
      if (user?.email) {
        supabase
          .from('users')
          .update({ pwa_installed: true })
          .eq('email', user.email)
          .then(({ error }) => {
            if (error) console.error('Error recording PWA installation in DB:', error);
          });
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isDismissed, isInstalled, user?.email]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem(LOCAL_INSTALLED_KEY, 'true');
      setShowPrompt(false);

      if (user?.email) {
        await supabase
          .from('users')
          .update({ pwa_installed: true })
          .eq('email', user.email);
      }
    } else {
      handleDismiss();
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = async () => {
    // 1. Immediately hide locally
    setShowPrompt(false);
    localStorage.setItem(LOCAL_DISMISSED_KEY, 'true');

    // 2. Record in DB if user is logged in
    if (user?.email) {
      try {
        await supabase
          .from('users')
          .update({ pwa_prompt_dismissed: true })
          .eq('email', user.email);
      } catch (err) {
        console.error('Failed to update PWA prompt dismissal in DB:', err);
      }
    }
  };

  if (!showPrompt || isDismissed || isInstalled) return null;

  return (
    <div className="fixed bottom-5 left-5 right-5 md:left-auto md:right-5 md:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 text-slate-100 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src="/logo-icon.png" alt="קופון מאסטר" className="w-11 h-11 rounded-xl shadow-md object-cover" />
            <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">התקן את קופון מאסטר</h4>
            <p className="text-xs text-slate-400">גישה מהירה מהמסך הראשי ועבודה גם במידה ואין חיבור לרשת</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstall} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3 py-1.5 h-auto rounded-xl">
            <Download className="w-3.5 h-3.5 ms-1" />
            התקן
          </Button>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-200 p-1 transition-colors" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
