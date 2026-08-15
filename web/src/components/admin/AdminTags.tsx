import { useState } from 'react';
import { useAdminTags, useRenameTag, useDeleteTag } from '@/hooks/useTags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Trash2 } from 'lucide-react';

export function AdminTags() {
  const { data: tags, isLoading } = useAdminTags();
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [edits, setEdits] = useState<Record<number, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>ניהול תגיות</CardTitle>
        <CardDescription>שינוי שם או מחיקה של תגיות. מחיקה מסירה את התגית מכל הקופונים.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">שם תגית</TableHead>
                  <TableHead className="text-end">מספר קופונים</TableHead>
                  <TableHead className="text-end">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags?.map((t) => {
                  const editVal = edits[t.id] ?? t.name;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Input value={editVal} onChange={(e) => setEdits((p) => ({ ...p, [t.id]: e.target.value }))} className="max-w-[220px]" />
                      </TableCell>
                      <TableCell>{t.count}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={edits[t.id] === undefined || edits[t.id] === t.name}
                            onClick={() => rename.mutate({ id: t.id, name: edits[t.id] })}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!tags?.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">אין תגיות</TableCell>
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
