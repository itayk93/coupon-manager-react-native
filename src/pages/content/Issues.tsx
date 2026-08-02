import { FormEvent, useState } from 'react';
import { Mail, Send, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export default function Issues() {
  const [sent, setSent] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const subject = String(form.get('subject') || 'דיווח תקלה ב-Coupon Master');
    const details = String(form.get('details') || '');
    const email = String(form.get('email') || '');
    const body = `תיאור התקלה:\n${details}\n\nאימייל לחזרה: ${email || 'לא צוין'}\n\nעמוד: ${window.location.href}`;
    const { error: sendError } = await supabase.functions.invoke('send-emails', {
      body: { mode: 'issue_report', subject, details, email, page_url: window.location.href },
    });
    setSending(false);
    if (sendError) {
      setError('לא הצלחנו לשלוח כרגע. אפשר לכתוב ישירות ל־itayk93@gmail.com.');
      return;
    }
    setSent(true);
    event.currentTarget.reset();
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6" dir="rtl">
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Bug className="w-7 h-7" />
        </div>
        <h1 className="text-4xl font-bold font-display text-primary">מצאתם משהו שלא עובד?</h1>
        <p className="text-muted-foreground">ספרו לנו. נבדוק ונחזור אליכם בהקדם.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>דיווח תקלה</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submitIssue} className="space-y-4">
            <Input name="subject" required placeholder="נושא קצר, למשל: הקופונים לא נטענים" aria-label="נושא" />
            <Textarea name="details" required rows={6} placeholder="מה קרה? מה ניסיתם לעשות?" aria-label="פרטי התקלה" />
            <Input name="email" type="email" placeholder="האימייל שלכם (כדי שנוכל לחזור)" aria-label="אימייל לחזרה" />
            <Button type="submit" disabled={sending} className="w-full gap-2"><Send className="w-4 h-4" />{sending ? 'שולחים…' : 'שליחת דיווח'}</Button>
            {sent && <p className="text-sm text-emerald-700 flex items-center gap-2"><Mail className="w-4 h-4" />הדיווח נשלח. תודה שעזרתם לנו להשתפר.</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">אפשר גם לכתוב ישירות ל־<a className="text-primary underline" href="mailto:itayk93@gmail.com">itayk93@gmail.com</a></p>
    </div>
  );
}
