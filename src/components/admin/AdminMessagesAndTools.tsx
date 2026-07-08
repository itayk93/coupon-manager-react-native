import { useState } from 'react';
import { useAdminMessages, useCreateAdminMessage, useDeleteAdminMessage } from '@/hooks/useAdminManagement';
import { useSendExpirationReminders, useSendTestEmail } from '@/hooks/useEmail';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Megaphone, Mail, BellRing } from 'lucide-react';

export function AdminMessages() {
  const { data: messages, isLoading } = useAdminMessages();
  const create = useCreateAdminMessage();
  const remove = useDeleteAdminMessage();
  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const handleCreate = async () => {
    if (!text.trim()) return;
    await create.mutateAsync({ message_text: text.trim(), link_url: linkUrl, link_text: linkText });
    setText(''); setLinkUrl(''); setLinkText('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> הודעות מערכת</CardTitle>
        <CardDescription>הודעה שתוצג לכל המשתמשים בראש הדשבורד.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border-b pb-4">
          <Textarea placeholder="תוכן ההודעה..." value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="קישור (אופציונלי)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="direction-ltr text-start" />
            <Input placeholder="טקסט לקישור" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
            <Button onClick={handleCreate} disabled={create.isPending}>פרסם</Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            {messages?.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm">{m.message_text}</p>
                  {m.link_url && <a href={m.link_url} className="text-xs text-primary underline">{m.link_text || m.link_url}</a>}
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!messages?.length && <p className="text-sm text-muted-foreground text-center py-4">אין הודעות פעילות</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminEmailTools() {
  const reminders = useSendExpirationReminders();
  const testEmail = useSendTestEmail();
  const [to, setTo] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> כלי דוא"ל</CardTitle>
        <CardDescription>הפעלה ידנית של תהליכי דוא"ל (בדרך כלל רצים אוטומטית ב-cron).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="font-medium flex items-center gap-2"><BellRing className="h-4 w-4" /> תזכורות תפוגה</p>
            <p className="text-sm text-muted-foreground">שליחת תזכורות לקופונים שעומדים לפוג (30/7/1 ימים).</p>
          </div>
          <Button variant="outline" onClick={() => reminders.mutate()} disabled={reminders.isPending}>
            {reminders.isPending ? 'שולח...' : 'הפעל עכשיו'}
          </Button>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <p className="font-medium">מייל בדיקה</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="כתובת יעד" value={to} onChange={(e) => setTo(e.target.value)} className="direction-ltr text-start" />
            <Button variant="outline" onClick={() => testEmail.mutate(to)} disabled={!to || testEmail.isPending}>שלח בדיקה</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
