import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MailX, RotateCcw } from 'lucide-react';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token'), [searchParams]);

  const setOptOut = useMutation({
    mutationFn: async (optedOut: boolean) => {
      if (!token) throw new Error('קישור ההסרה אינו תקין.');
      const { data, error } = await supabase.functions.invoke('manage-unsubscribe', {
        body: { token, opted_out: optedOut },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_data, optedOut) => {
      toast.success(optedOut ? 'הוסרת בהצלחה מדיוור שיווקי.' : 'חזרת לקבל דיוור שיווקי.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'שמירת ההעדפה נכשלה.');
    },
  });

  return (
    <div className="max-w-xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailX className="h-5 w-5" />
            ניהול דיוור שיווקי
          </CardTitle>
          <CardDescription>
            כאן אפשר להסיר את עצמך מדיוור שיווקי, או להחזיר אותו בעתיד.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <Alert variant="destructive">
              <AlertTitle>קישור לא תקין</AlertTitle>
              <AlertDescription>חסר token תקין בקישור ההסרה.</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            דיוור תפעולי חשוב עדיין עשוי להישלח, למשל תזכורות תפוגה או עדכוני מערכת.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() => setOptOut.mutate(true)}
              disabled={!token || setOptOut.isPending}
            >
              <MailX className="h-4 w-4" />
              הסר מדיוור
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setOptOut.mutate(false)}
              disabled={!token || setOptOut.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              החזר דיוור
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
