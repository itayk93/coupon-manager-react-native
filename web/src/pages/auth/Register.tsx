import { storeLegacyUser } from '@/lib/legacyAuth';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void }) => { requestAccessToken: () => void } } } };
  }
}

const GOOGLE_CLIENT_ID = '100904281039-0ktffj6vde2uj2to3c814njss4fk34fj.apps.googleusercontent.com';

const registerSchema = z.object({
  firstName: z.string().min(2, { message: "שם פרטי חייב להכיל לפחות 2 תווים" }),
  lastName: z.string().min(2, { message: "שם משפחה חייב להכיל לפחות 2 תווים" }),
  email: z.string().email({ message: "כתובת אימייל לא חוקית" }),
  password: z.string().min(6, { message: "סיסמה חייבת להכיל לפחות 6 תווים" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "הסיסמאות אינן תואמות",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const { setLegacySession } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { first_name: data.firstName, last_name: data.lastName },
        },
      });

      if (error) throw error;

      toast.success("נרשמת בהצלחה! אנא בדוק את תיבת המייל שלך לאימות החשבון.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "שגיאה בהרשמה. אנא נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    setIsLoading(true);
    if (!window.google?.accounts?.oauth2) {
      toast.error("Google עדיין נטען. נסה שוב בעוד רגע.");
      setIsLoading(false);
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        try {
          if (!response.access_token) throw new Error(response.error || 'Google authentication failed');
          const { data, error } = await supabase.functions.invoke('google-auth', { body: { access_token: response.access_token } });
          if (error) throw error;
          if (!data?.user || !data?.token_hash) throw new Error('Google user could not be created');
          // Exchange for a real Supabase session; without it auth.uid() is null
          // and RLS hides the user's own data from them.
          const { error: otpError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.token_hash });
          if (otpError) throw new Error('לא ניתן להתחבר עם Google כרגע.');
          storeLegacyUser(data.user);
          setLegacySession(data.user);
          toast.success("החשבון נוצר בהצלחה!");
          navigate("/dashboard", { replace: true });
        } catch (error: any) {
          toast.error(error.message || "לא ניתן להירשם עם Google כרגע.");
        } finally {
          setIsLoading(false);
        }
      },
    });
    client.requestAccessToken();
  };

  return (
    <main className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="welcome-title">הרשמה ל-Coupon Master</h1>
          <div className="decorative-line" />
        </div>

        <section className="auth-card">
          <div className="auth-card-header">
            <h2>יצירת חשבון</h2>
            <div className="decorative-dots"><span /><span /><span /></div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="form-group">
              <Label htmlFor="firstName" className="form-label">שם פרטי</Label>
              <div className="input-wrapper">
                <User className="input-icon h-4 w-4" aria-hidden="true" />
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="הזן שם פרטי"
                  className="input-field"
                  aria-invalid={errors.firstName ? true : undefined}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                  {...register("firstName")}
                  disabled={isLoading}
                />
              </div>
              {errors.firstName && (
                <p id="firstName-error" role="alert" className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="lastName" className="form-label">שם משפחה</Label>
              <div className="input-wrapper">
                <User className="input-icon h-4 w-4" aria-hidden="true" />
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="הזן שם משפחה"
                  className="input-field"
                  aria-invalid={errors.lastName ? true : undefined}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  {...register("lastName")}
                  disabled={isLoading}
                />
              </div>
              {errors.lastName && (
                <p id="lastName-error" role="alert" className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="email" className="form-label">אימייל</Label>
              <div className="input-wrapper">
                <Mail className="input-icon h-4 w-4" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="הזן כתובת אימייל"
                  className="input-field"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="password" className="form-label">סיסמה</Label>
              <div className="input-wrapper password-wrapper">
                <Lock className="input-icon h-4 w-4" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="הזן סיסמה"
                  className="input-field"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="confirmPassword" className="form-label">אימות סיסמה</Label>
              <div className="input-wrapper password-wrapper">
                <Lock className="input-icon h-4 w-4" aria-hidden="true" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="הזן שוב את הסיסמה"
                  className="input-field"
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                  {...register("confirmPassword")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showConfirm ? "הסתר סיסמה" : "הצג סיסמה"}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? "נרשם..." : "הרשם"}
            </Button>
          </form>

          <div className="auth-links">
            <Link to="/login">כבר יש לך חשבון? התחבר כאן</Link>
          </div>

          <Button variant="outline" className="google-button" onClick={handleGoogleRegister} disabled={isLoading}>
            <svg className="me-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            הרשמה עם Google
          </Button>
        </section>
      </div>
    </main>
  );
}
