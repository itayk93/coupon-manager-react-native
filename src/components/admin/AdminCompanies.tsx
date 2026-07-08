import { useState } from 'react';
import { useCompanies, useUpsertCompany, useDeleteCompany } from '@/hooks/useAdminManagement';
import { resolveCompanyLogo } from '@/lib/companyLogos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Save } from 'lucide-react';

export function AdminCompanies() {
  const { data: companies, isLoading } = useCompanies();
  const upsert = useUpsertCompany();
  const remove = useDeleteCompany();
  const [newName, setNewName] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [edits, setEdits] = useState<Record<number, string>>({});

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await upsert.mutateAsync({ name: newName.trim(), image_path: newLogo.trim() || 'default.png' });
    setNewName('');
    setNewLogo('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>חברות ולוגואים</CardTitle>
        <CardDescription>ניהול רשימת החברות והלוגו המשויך לכל אחת (קובץ או URL).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 items-end border-b pb-4">
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground">שם חברה</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="למשל: רמי לוי" />
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground">נתיב/URL לוגו</label>
            <Input value={newLogo} onChange={(e) => setNewLogo(e.target.value)} placeholder="rami_levi.jpg או https://..." className="direction-ltr text-start" />
          </div>
          <Button onClick={handleAdd} disabled={upsert.isPending}>
            <Plus className="h-4 w-4 me-2" /> הוסף
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">לוגו</TableHead>
                  <TableHead className="text-end">שם</TableHead>
                  <TableHead className="text-end">קופונים</TableHead>
                  <TableHead className="text-end">נתיב לוגו</TableHead>
                  <TableHead className="text-end">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies?.map((c) => {
                  const editVal = edits[c.id] ?? c.image_path;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <img
                          src={resolveCompanyLogo(c.name, c.image_path)}
                          alt={c.name}
                          className="h-8 w-8 rounded object-contain bg-white"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/legacy-images/default.png'; }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.company_count}</TableCell>
                      <TableCell>
                        <Input
                          value={editVal}
                          onChange={(e) => setEdits((p) => ({ ...p, [c.id]: e.target.value }))}
                          className="direction-ltr text-start min-w-[180px]"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={edits[c.id] === undefined || edits[c.id] === c.image_path}
                            onClick={() => upsert.mutate({ id: c.id, name: c.name, image_path: edits[c.id] })}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!companies?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">אין חברות</TableCell>
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
