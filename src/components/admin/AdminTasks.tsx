import { useState } from 'react';
import { useScheduledTasks, useToggleTask, useTaskLogs } from '@/hooks/useAdminManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';

function TaskLogs({ taskId }: { taskId: number }) {
  const { data: logs, isLoading } = useTaskLogs(taskId);
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!logs?.length) return <p className="text-sm text-muted-foreground py-2">אין ריצות קודמות.</p>;
  return (
    <div className="rounded-md border bg-muted/30 mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-end">מתי</TableHead>
            <TableHead className="text-end">סטטוס</TableHead>
            <TableHead className="text-end">תוצאה</TableHead>
            <TableHead className="text-end">משך (ש')</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.executed_at).toLocaleString('he-IL')}</TableCell>
              <TableCell>
                <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>{log.status}</Badge>
              </TableCell>
              <TableCell className="max-w-[280px] truncate">{log.result_message || log.error_message || '-'}</TableCell>
              <TableCell>{log.execution_time_seconds ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminTasks() {
  const { data: tasks, isLoading } = useScheduledTasks();
  const toggle = useToggleTask();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>משימות מתוזמנות</CardTitle>
        <CardDescription>
          משימות רקע (עדכון יתרות, תזכורות מייל, ניקוי). ההרצה בפועל מתבצעת ע"י pg_cron המפעיל Edge Functions —
          ראה <code>supabase/DEPLOYMENT.md</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">שם</TableHead>
                  <TableHead className="text-end">סוג</TableHead>
                  <TableHead className="text-end">תזמון</TableHead>
                  <TableHead className="text-end">ריצה אחרונה</TableHead>
                  <TableHead className="text-end">פעיל</TableHead>
                  <TableHead className="text-end">לוגים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks?.map((t) => (
                  <>
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.task_name}</TableCell>
                      <TableCell><Badge variant="outline">{t.task_type}</Badge></TableCell>
                      <TableCell className="direction-ltr text-end">{t.schedule_value || t.execution_time}</TableCell>
                      <TableCell>{t.last_run ? new Date(t.last_run).toLocaleString('he-IL') : 'טרם רצה'}</TableCell>
                      <TableCell>
                        <Switch checked={t.is_active} onCheckedChange={(v) => toggle.mutate({ id: t.id, isActive: v })} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                          {expanded === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded === t.id && (
                      <TableRow>
                        <TableCell colSpan={6}><TaskLogs taskId={t.id} /></TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {!tasks?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">אין משימות מתוזמנות</TableCell>
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
