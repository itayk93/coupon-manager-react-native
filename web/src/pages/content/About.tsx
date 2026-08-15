import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Zap, Heart, Users } from 'lucide-react';

export default function About() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      <div className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold tracking-tight font-display text-primary"
        >
          אודות קופון מאסטר
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-muted-foreground max-w-2xl mx-auto"
        >
          המערכת המתקדמת ביותר בישראל לניהול קופונים דיגיטליים, ארנקים, ושוברים.
        </motion.p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid md:grid-cols-2 gap-6"
      >
        <motion.div variants={item}>
          <Card className="h-full border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full text-primary">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display">אבטחה מקסימלית</h3>
              <p className="text-muted-foreground">
                כל הנתונים שלך, כולל קודי קופונים ו-CVV, מוצפנים בצורה מאובטחת באמצעות טכנולוגיות הצפנה (Fernet/AES) מתקדמות, כך שרק אתה יכול לגשת אליהם.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full text-primary">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display">מהירות ונוחות</h3>
              <p className="text-muted-foreground">
                מערכת שמגיבה בזמן אמת, זמינה מכל מכשיר, ומאפשרת לך למצוא ולנצל את הקופונים שלך בדיוק ברגע שאתה עומד בקופה.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full text-primary">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display">נבנה באהבה</h3>
              <p className="text-muted-foreground">
                המערכת פותחה מתוך צורך אישי לנהל עשרות קופונים של חבר אקסטרה, בהצדעה, ו-BuyMe, והיא מתעדכנת כל הזמן בהתאם לבקשות המשתמשים.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full text-primary">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display">שיתופיות</h3>
              <p className="text-muted-foreground">
                שתף קופונים בבטחה עם חברים ובני משפחה, עקוב אחרי ניצול משותף ונהל את הכל ממקום אחד שקוף ופשוט.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="text-center text-sm text-muted-foreground pt-12 border-t mt-12">
        <p>גרסה 2.0 (React/Vite Migration) - פותח עבור קהילת חוסכי הכסף בישראל.</p>
      </div>
    </div>
  );
}
