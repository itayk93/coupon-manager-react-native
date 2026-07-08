import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileWarning, CheckCircle2 } from 'lucide-react';
import { parseCouponsCsv, rowIsValid, ImportRow } from '@/lib/bulkImport';
import { useAddCoupon } from '@/hooks/useCoupons';
import { toast } from 'sonner';

interface BulkImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImport({ open, onOpenChange }: BulkImportProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const addCoupon = useAddCoupon();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRows(parseCouponsCsv(text));
  };

  const validRows = rows.filter(rowIsValid);
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    setProgress(0);
    let success = 0;
    for (let i = 0; i < validRows.length; i++) {
      const { __errors, ...coupon } = validRows[i];
      try {
        await addCoupon.mutateAsync(coupon);
        success++;
      } catch {
        /* toast handled by hook */
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }
    setImporting(false);
    toast.success(`יובאו ${success} מתוך ${validRows.length} קופונים`);
    setRows([]);
    setFileName('');
    onOpenChange(false);
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא קופונים בכמות</DialogTitle>
          <DialogDescription>
            העלה קובץ CSV עם העמודות: חברה, קוד קופון, ערך מקורי, עלות, תאריך תפוגה, תיאור.
            אפשר להשתמש בקובץ שיוצא מהמערכת (ייצוא ל-Excel/CSV).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-accent/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName || 'לחץ לבחירת קובץ CSV'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-4 w-4" /> {validRows.length} תקינים
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <FileWarning className="h-4 w-4" /> {invalidCount} עם שגיאות (ידולגו)
                  </span>
                )}
              </div>

              <div className="rounded-md border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-end">חברה</TableHead>
                      <TableHead className="text-end">קוד</TableHead>
                      <TableHead className="text-end">ערך</TableHead>
                      <TableHead className="text-end">עלות</TableHead>
                      <TableHead className="text-end">תפוגה</TableHead>
                      <TableHead className="text-end">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i} className={rowIsValid(row) ? '' : 'bg-destructive/5'}>
                        <TableCell>{row.company || '-'}</TableCell>
                        <TableCell className="direction-ltr text-end">{row.code || '-'}</TableCell>
                        <TableCell>{row.value ?? '-'}</TableCell>
                        <TableCell>{row.cost ?? '-'}</TableCell>
                        <TableCell>{row.expiration || '-'}</TableCell>
                        <TableCell>
                          {rowIsValid(row) ? (
                            <Badge variant="secondary">תקין</Badge>
                          ) : (
                            <Badge variant="destructive" title={row.__errors?.join(', ')}>{row.__errors?.[0]}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importing && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">מייבא... {progress}%</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>ביטול</Button>
          <Button onClick={handleImport} disabled={!validRows.length || importing}>
            {importing ? 'מייבא...' : `ייבא ${validRows.length} קופונים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
