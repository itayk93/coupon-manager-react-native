import { useState } from 'react';
import { useParseCoupon, ParsedCoupon } from '@/hooks/useCouponAI';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AiParsePanelProps {
  onParsed: (coupon: ParsedCoupon) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AiParsePanel({ onParsed }: AiParsePanelProps) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const parse = useParseCoupon();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('התמונה גדולה מדי (מקסימום 5MB)');
      return;
    }
    setFileName(file.name);
    setImageBase64(await fileToBase64(file));
  };

  const handleParse = async () => {
    const result = await parse.mutateAsync({ text: text || undefined, imageBase64 });
    onParsed(result);
    toast.success('הפרטים מולאו — בדוק ותקן לפי הצורך');
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-primary font-medium">
        <Sparkles className="h-4 w-4" />
        <span>מילוי אוטומטי עם AI</span>
      </div>
      <p className="text-xs text-muted-foreground">
        הדבק את טקסט הודעת הקופון, או העלה צילום מסך, והמערכת תזהה את הפרטים אוטומטית.
      </p>

      <Textarea
        rows={3}
        placeholder="הדבק כאן את הודעת הקופון..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="resize-none bg-background"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" />
          <span>{fileName || 'העלה תמונה'}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        <Button type="button" onClick={handleParse} disabled={parse.isPending || (!text && !imageBase64)}>
          {parse.isPending ? (
            <><Loader2 className="h-4 w-4 me-2 animate-spin" /> מפענח...</>
          ) : (
            <><Sparkles className="h-4 w-4 me-2" /> פענח ומלא</>
          )}
        </Button>
      </div>
    </div>
  );
}
