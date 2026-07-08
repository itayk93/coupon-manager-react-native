import { motion } from 'framer-motion';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. איזה מידע אנחנו אוספים',
    body: 'אנו אוספים את המידע שאתה מזין: פרטי חשבון (שם, אימייל), ופרטי הקופונים שלך. פרטים רגישים כמו קודי קופון ו-CVV נשמרים מוצפנים.',
  },
  {
    title: '2. כיצד אנו משתמשים במידע',
    body: 'המידע משמש אך ורק כדי לספק לך את שירות ניהול הקופונים: הצגת הקופונים, תזכורות תפוגה, סטטיסטיקות ושיתופים שאתה יוזם.',
  },
  {
    title: '3. אבטחת מידע',
    body: 'הנתונים הרגישים מוצפנים בהצפנת Fernet (AES-128-CBC + HMAC). הגישה לנתונים מוגבלת לחשבון שלך בלבד.',
  },
  {
    title: '4. דיוור ותקשורת',
    body: 'אנו שולחים תזכורות תפעוליות (למשל תפוגת קופון). דיוור שיווקי נשלח רק בהסכמתך, וניתן לבטלו בכל עת בעמוד ההגדרות.',
  },
  {
    title: '5. זכויותיך (GDPR)',
    body: 'יש לך זכות לגשת, לתקן ולמחוק את המידע האישי שלך. מחיקת החשבון מסירה את כל הנתונים האישיים והקופונים לצמיתות. ניתן לבצע זאת עצמאית בעמוד ההגדרות → פרטיות.',
  },
  {
    title: '6. עוגיות ואחסון מקומי',
    body: 'אנו משתמשים באחסון מקומי בדפדפן (localStorage) לצורך שמירת החיבור וההעדפות שלך. איננו משתפים מידע זה עם צדדים שלישיים.',
  },
  {
    title: '7. יצירת קשר',
    body: 'לשאלות בנוגע לפרטיות ניתן לפנות דרך עמוד "אודות".',
  },
];

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold tracking-tight font-display text-primary">מדיניות פרטיות</h1>
        <p className="text-muted-foreground">עודכן לאחרונה: יולי 2026</p>
      </motion.div>

      <div className="space-y-6">
        {SECTIONS.map((s, i) => (
          <section key={i} className="space-y-2">
            <h2 className="text-xl font-bold font-display">{s.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
