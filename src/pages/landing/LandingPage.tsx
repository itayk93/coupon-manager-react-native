import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BellRing, Camera, CircleDollarSign, Store, Tags, WalletCards } from 'lucide-react';

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <Link to="/" className="landing-brand">Coupon Master</Link>
        <nav>
          <Link to="/about">אודות</Link>
          <Link to="/login">התחברות</Link>
          <Link to="/register">הרשמה</Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>הפסיקו לפספס קופונים. התחילו לחסוך אלפי שקלים!</h1>
          <p>הארנק הדיגיטלי החכם שמרכז את כל הקופונים שלכם במקום אחד - בדיוק כשאתם צריכים</p>
          <Link to="/register" className="cta-button">התחילו לחסוך עכשיו!</Link>
        </section>

        <div className="savings-counter">ארנק קופונים שמחזיר כסף לכיס - בלי לפספס תוקף, יתרה או קוד</div>

        <section className="features">
          <div className="feature-box">
            <span className="icon"><WalletCards size={34} /></span>
            <h3>נהלו ארנק דיגיטלי חכם</h3>
            <p>קחו שליטה על החיסכון שלכם! נהלו את כל הקופונים בתוך ארנק דיגיטלי אחד</p>
          </div>
          <div className="feature-box">
            <span className="icon"><Store size={34} /></span>
            <h3>שימוש מהיר ויעיל</h3>
            <p>נמצאים בסופר? הלכתם למסעדה? תפתחו את הארנק הדיגיטלי ותשלמו ישר עם הקופונים שלכם!</p>
          </div>
          <div className="feature-box">
            <span className="icon"><Camera size={34} /></span>
            <h3>הוספת קופונים בשנייה אחת</h3>
            <p>פשוט צלמו את הקופון או העתיקו אותו - והמערכת החכמה שלנו תזהה הכל באופן אוטומטי</p>
          </div>
          <div className="feature-box">
            <span className="icon"><CircleDollarSign size={34} /></span>
            <h3>הרוויחו מקופונים שאתם לא צריכים</h3>
            <p>יש לכם קופון שלא תשתמשו בו? מכרו אותו למי שכן צריך באתר שלנו</p>
          </div>
          <div className="feature-box">
            <span className="icon"><BellRing size={34} /></span>
            <h3>סוף לקופונים שפג תוקפם!</h3>
            <p>קבלו התראות חכמות לפני שהקופונים נגמרים ונצלו כל שקל אפשרי</p>
          </div>
          <div className="feature-box">
            <span className="icon"><Tags size={34} /></span>
            <h3>הדברים הגדולים עוד לפנינו!</h3>
            <p>בקרוב: עדכון אוטומטי של ארנק הקופונים, הנחות שוות מחברות מובילות, ועוד הפתעות שיחסכו לכם כסף!</p>
          </div>
        </section>

        <section className="final-cta">
          <h2>גלו את הדרך החכמה לנצל כל קופון!</h2>
          <p>התחילו לנהל את הקופונים שלהם בארנק דיגיטלי אחד ולהנות מכל שקל</p>
          <Link to="/register" className="cta-button">הגיע הזמן להתחיל לחסוך - מוזמנים להצטרף!</Link>
        </section>
      </main>

      <footer className="footer">
        <p>
          <Link to="/about">אודות</Link> | <Link to="/privacy">מדיניות פרטיות</Link> |{' '}
          <a href="mailto:couponmasteril2@gmail.com">צור קשר</a>
        </p>
      </footer>
    </div>
  );
}
