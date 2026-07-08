import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <AlertCircle className="w-24 h-24 text-primary/30 mx-auto mb-6" />
        <h1 className="text-6xl font-bold font-display text-primary mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">אופס! הדף לא נמצא.</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          נראה שהלכת לאיבוד. הדף שניסית להגיע אליו לא קיים, הוסר, או שהקישור שבור.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/">חזרה לדף הבית</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/coupons">לקופונים שלי</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
