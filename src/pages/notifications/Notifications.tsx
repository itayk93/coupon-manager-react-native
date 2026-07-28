import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Clock, ExternalLink, List, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('hide_from_view', false)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const markViewed = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ viewed: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const hideNotification = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ hide_from_view: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('ההתראה נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקת ההתראה'),
  });

  const hideAllNotifications = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ hide_from_view: true })
        .eq('user_id', user.id)
        .eq('hide_from_view', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('כל ההתראות נמחקו');
    },
    onError: () => toast.error('שגיאה במחיקת ההתראות'),
  });

  return (
    <section className="notifications-container">
      <div className="notifications-header">
        <h1 className="notifications-title">
          <Bell className="h-8 w-8" />
          התראות
        </h1>
        <p className="notifications-subtitle">נהל את ההתראות שלך בקלות</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {notifications.length > 0 && (
            <div className="notifications-controls">
              <div className="notifications-count">
                <List className="h-4 w-4" />
                <span>סה"כ התראות:</span>
                <span className="count-badge">{notifications.length}</span>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="delete-all-btn gap-2"
                onClick={() => hideAllNotifications.mutate()}
                disabled={hideAllNotifications.isPending}
              >
                <Trash2 className="h-4 w-4" />
                מחק את כל ההתראות
              </Button>
            </div>
          )}

          <div className="notifications-list">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <Card key={notification.id} className="notification-card">
                  <CardContent className="notification-content">
                    <div className="notification-message">
                      <p className="notification-text">{notification.message}</p>
                      <div className="notification-meta">
                        <div className="notification-timestamp">
                          <Clock className="h-4 w-4" />
                          {new Date(notification.timestamp).toLocaleString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.link && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="notification-close"
                          title="פתח התראה"
                          onClick={() => {
                            markViewed.mutate(notification.id);
                            navigate(notification.link!);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="notification-close"
                        title="מחק התראה"
                        onClick={() => hideNotification.mutate(notification.id)}
                        disabled={hideNotification.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="no-notifications">
                <BellOff className="empty-state-icon" />
                <div className="empty-state-title">אין התראות חדשות</div>
                <div className="empty-state-description">כל ההתראות שלך מעודכנות! נודיע לך כאשר יהיו עדכונים חדשים.</div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
