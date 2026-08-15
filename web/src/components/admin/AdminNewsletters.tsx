import { useState } from 'react';
import { useNewsletters, useUpsertNewsletter, useDeleteNewsletter } from '@/hooks/useAdminManagement';
import { useSendNewsletter } from '@/hooks/useEmail';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Send } from 'lucide-react';

export function AdminNewsletters() {
  const { data: newsletters, isLoading } = useNewsletters();
  const upsert = useUpsertNewsletter();
  const remove = useDeleteNewsletter();
  const send = useSendNewsletter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;
    await upsert.mutateAsync({ title: title.trim(), content });
    setTitle('');
    setContent('');
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>ניוזלטרים</CardTitle>
          <CardDescription>יצירה, עריכה ושליחה של ניוזלטרים למשתמשים.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2" /> ניוזלטר חדש</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>ניוזלטר חדש</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm">כותרת</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">תוכן (HTML נתמך)</label>
                <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={upsert.isPending}>שמור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">כותרת</TableHead>
                  <TableHead className="text-end">נוצר</TableHead>
                  <TableHead className="text-end">נשלח</TableHead>
                  <TableHead className="text-end">נמענים</TableHead>
                  <TableHead className="text-end">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsletters?.map((nl) => (
                  <TableRow key={nl.id}>
                    <TableCell className="font-medium">{nl.title}</TableCell>
                    <TableCell>{new Date(nl.created_at).toLocaleDateString('he-IL')}</TableCell>
                    <TableCell>
                      {nl.is_sent ? <Badge>נשלח</Badge> : <Badge variant="secondary">טיוטה</Badge>}
                    </TableCell>
                    <TableCell>{nl.sent_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={send.isPending}
                          onClick={() => {
                            if (confirm(`לשלוח את "${nl.title}" לכל המנויים?`)) send.mutate(nl.id);
                          }}
                        >
                          <Send className="h-4 w-4 me-1" /> שלח
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(nl.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!newsletters?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">אין ניוזלטרים</TableCell>
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
