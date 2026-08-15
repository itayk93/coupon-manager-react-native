import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminStats, useAdminSettings, useUpdateAdminSetting } from '@/hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Tags as TagsIcon, Settings, Save, AlertTriangle, Building2, Clock, Newspaper, Megaphone } from 'lucide-react';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminCompanies } from '@/components/admin/AdminCompanies';
import { AdminTags } from '@/components/admin/AdminTags';
import { AdminTasks } from '@/components/admin/AdminTasks';
import { AdminNewsletters } from '@/components/admin/AdminNewsletters';
import { AdminMessages, AdminEmailTools, AdminPrivacyTools } from '@/components/admin/AdminMessagesAndTools';

function SystemSettings() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateSetting = useUpdateAdminSetting();
  const [editing, setEditing] = useState<Record<number, string>>({});

  const save = async (id: number) => {
    if (editing[id] === undefined) return;
    await updateSetting.mutateAsync({ id, value: editing[id] });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות מערכת</CardTitle>
        <CardDescription>פרמטרים גלובליים המשפיעים על כל המשתמשים.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : settings?.length ? (
          <div className="space-y-6">
            {settings.map((setting) => {
              const isEditing = editing[setting.id] !== undefined;
              const currentValue = isEditing ? editing[setting.id] : setting.setting_value || '';
              return (
                <div key={setting.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b pb-6 last:border-0 last:pb-0">
                  <div className="md:col-span-1">
                    <h4 className="font-medium font-mono text-sm mb-1">{setting.setting_key}</h4>
                    <p className="text-xs text-muted-foreground">{setting.description || 'ללא תיאור'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      value={currentValue}
                      onChange={(e) => setEditing((p) => ({ ...p, [setting.id]: e.target.value }))}
                      className="w-full direction-ltr text-start font-mono"
                    />
                  </div>
                  <div className="md:col-span-1 text-start">
                    <Button variant={isEditing ? 'default' : 'outline'} size="sm" onClick={() => save(setting.id)} disabled={!isEditing || updateSetting.isPending}>
                      <Save className="h-4 w-4 me-2" /> {updateSetting.isPending ? 'שומר...' : 'שמור'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
            <p>לא נמצאו הגדרות במערכת.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display text-primary">פאנל ניהול</h1>
        <p className="text-muted-foreground">ניהול מלא של המערכת, משתמשים, תוכן והגדרות.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה"כ משתמשים רשומים</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">בכל המערכת</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">סה"כ קופונים</CardTitle>
              <TagsIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCoupons || 0}</div>
              <p className="text-xs text-muted-foreground">קופונים שהוזנו למערכת</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="w-full" dir="rtl">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="users"><Users className="w-4 h-4 me-2" /> משתמשים</TabsTrigger>
          <TabsTrigger value="companies"><Building2 className="w-4 h-4 me-2" /> חברות</TabsTrigger>
          <TabsTrigger value="tags"><TagsIcon className="w-4 h-4 me-2" /> תגיות</TabsTrigger>
          <TabsTrigger value="tasks"><Clock className="w-4 h-4 me-2" /> משימות</TabsTrigger>
          <TabsTrigger value="newsletters"><Newspaper className="w-4 h-4 me-2" /> ניוזלטרים</TabsTrigger>
          <TabsTrigger value="messages"><Megaphone className="w-4 h-4 me-2" /> הודעות ודוא"ל</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 me-2" /> הגדרות</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6"><AdminUsers /></TabsContent>
        <TabsContent value="companies" className="mt-6"><AdminCompanies /></TabsContent>
        <TabsContent value="tags" className="mt-6"><AdminTags /></TabsContent>
        <TabsContent value="tasks" className="mt-6"><AdminTasks /></TabsContent>
        <TabsContent value="newsletters" className="mt-6"><AdminNewsletters /></TabsContent>
        <TabsContent value="messages" className="mt-6 space-y-6">
          <AdminMessages />
          <AdminEmailTools />
          <AdminPrivacyTools />
        </TabsContent>
        <TabsContent value="settings" className="mt-6"><SystemSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
