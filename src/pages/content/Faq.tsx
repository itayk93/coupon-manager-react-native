import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'איך מוסיפים קופון חדש?',
    a: 'בעמוד "קופונים" לוחצים על "הוסף קופון". ניתן להזין ידנית, או להשתמש בפענוח AI: מדביקים טקסט של הודעת קופון או מעלים צילום מסך, והמערכת תמלא את הפרטים אוטומטית.',
  },
  {
    q: 'האם הנתונים שלי מאובטחים?',
    a: 'כן. קודי הקופון, CVV ופרטים רגישים מוצפנים בהצפנת Fernet/AES לפני שהם נשמרים. רק אתה, עם המפתח שלך, יכול לפענח אותם.',
  },
  {
    q: 'מה זה עדכון יתרה אוטומטי?',
    a: 'לקופונים נתמכים (Multipass, BuyMe) המערכת יכולה לבדוק את היתרה העדכנית מול ספק הקופון ולעדכן את הערך שנוצל, כך שתמיד תדע כמה נשאר לך.',
  },
  {
    q: 'איך משתפים קופון עם בן משפחה?',
    a: 'בעמוד "שיתופים" יוצרים לינק שיתוף לקופון. אפשר לבטל את השיתוף בכל רגע, ורואים מי צופה בקופון בזמן אמת.',
  },
  {
    q: 'איך מייבאים הרבה קופונים בבת אחת?',
    a: 'בעמוד "קופונים" → "ייבוא בכמות" מעלים קובץ CSV (למשל קובץ שיוצא מהמערכת). המערכת תציג תצוגה מקדימה, תסמן שגיאות, ותוסיף את כל הקופונים התקינים.',
  },
  {
    q: 'קיבלתי התראה על קופון שעומד לפוג — מה עושים?',
    a: 'המערכת שולחת תזכורות 30, 7 ויום לפני התפוגה. כדאי לנצל את היתרה לפני התאריך. ניתן לנהל את העדפות ההתראות בעמוד "הגדרות".',
  },
  {
    q: 'איך מבטלים קבלת דיוור / מוחקים את החשבון?',
    a: 'בעמוד "הגדרות" → לשונית "פרטיות" ניתן לבטל קבלת דיוור שיווקי, וכן למחוק את החשבון וכל הנתונים האישיים לצמיתות (בהתאם ל-GDPR).',
  },
];

export default function Faq() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <h1 className="text-4xl font-bold tracking-tight font-display text-primary">שאלות נפוצות</h1>
        <p className="text-lg text-muted-foreground">כל מה שצריך לדעת על ניהול הקופונים שלך.</p>
      </motion.div>

      <Accordion type="single" collapsible className="space-y-3">
        {FAQS.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="rounded-xl border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger className="flex w-full items-center justify-between py-4 text-right font-medium hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <span>{faq.q}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform" />
            </AccordionTrigger>
            <AccordionContent className="overflow-hidden pb-4 text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
