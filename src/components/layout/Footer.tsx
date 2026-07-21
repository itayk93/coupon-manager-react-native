import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-muted/20 py-8 mt-auto">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-right">
          <div>
            <h3 className="font-bold font-display text-lg mb-4 text-primary">קופון מאסטר</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              המערכת המובילה לניהול קופונים דיגיטליים, שוברים וכרטיסי מתנה. 
              חסוך כסף, נהל חכם, ושתף עם המשפחה.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">ניווט מהיר</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-primary transition-colors">דף הבית</Link>
              </li>
              <li>
                <Link to="/coupons" className="hover:text-primary transition-colors">הקופונים שלי</Link>
              </li>
              <li>
                <Link to="/statistics" className="hover:text-primary transition-colors">סטטיסטיקות</Link>
              </li>
              <li>
                <Link to="/sharing" className="hover:text-primary transition-colors">שיתופים</Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">מידע וכלים</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-primary transition-colors">אודות המערכת</Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-primary transition-colors">שאלות נפוצות</Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-primary transition-colors">הגדרות חשבון</Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary transition-colors">מדיניות פרטיות</Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} קופון מאסטר. כל הזכויות שמורות.</p>
        </div>
      </div>
    </footer>
  );
}
