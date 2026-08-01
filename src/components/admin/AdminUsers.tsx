import { useState } from 'react';
import { useManageUsers, useUpdateUser } from '@/hooks/useAdminManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FEATURE_KEYS, FeatureKey, useUpsertUserFeatureOverride, useUserFeatureOverrides } from '@/hooks/useFeatureAccess';

function UserFeatureOverridesDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: overrides = [] } = useUserFeatureOverrides(userId ?? undefined);
  const upsertOverride = useUpsertUserFeatureOverride();

  const overrideMap = new Map(overrides.map((row) => [row.feature_key, row.is_enabled]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>הרשאות ופיצ׳רים למשתמש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {FEATURE_KEYS.map((featureKey) => (
            <div key={featureKey} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="font-medium">{featureKey}</div>
              <Switch
                checked={overrideMap.has(featureKey) ? Boolean(overrideMap.get(featureKey)) : true}
                onCheckedChange={(checked) => {
                  if (!userId) return;
                  upsertOverride.mutate({
                    userId,
                    featureKey: featureKey as FeatureKey,
                    isEnabled: checked,
                  });
                }}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsers() {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { data: users, isLoading } = useManageUsers(search);
  const updateUser = useUpdateUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>ניהול משתמשים</CardTitle>
        <CardDescription>חיפוש, הרשאות ניהול, אימות והקצאת סלוטים.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או אימייל..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">שם</TableHead>
                  <TableHead className="text-end">אימייל</TableHead>
                  <TableHead className="text-end">מאומת</TableHead>
                  <TableHead className="text-end">מנהל</TableHead>
                  <TableHead className="text-end">סלוטים</TableHead>
                  <TableHead className="text-end">פיצ׳רים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                      {u.is_deleted && <Badge variant="secondary" className="ms-2">מחוק</Badge>}
                    </TableCell>
                    <TableCell className="direction-ltr text-end">{u.email}</TableCell>
                    <TableCell>
                      <Switch
                        checked={u.is_confirmed}
                        onCheckedChange={(v) => updateUser.mutate({ id: u.id, updates: { is_confirmed: v } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.is_admin}
                        onCheckedChange={(v) => updateUser.mutate({ id: u.id, updates: { is_admin: v } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={u.slots}
                        className="w-20 text-center"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val !== u.slots) {
                            updateUser.mutate({ id: u.id, updates: { slots: val } });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUserId(u.id)}>
                        <SlidersHorizontal className="h-4 w-4 me-2" />
                        פיצ׳רים
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!users?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">לא נמצאו משתמשים</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <UserFeatureOverridesDialog
          userId={selectedUserId}
          open={selectedUserId !== null}
          onOpenChange={(open) => !open && setSelectedUserId(null)}
        />
      </CardContent>
    </Card>
  );
}
