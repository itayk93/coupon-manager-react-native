import { useState } from 'react';
import { useManageUsers, useUpdateUser } from '@/hooks/useAdminManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export function AdminUsers() {
  const [search, setSearch] = useState('');
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
                  </TableRow>
                ))}
                {!users?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">לא נמצאו משתמשים</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
