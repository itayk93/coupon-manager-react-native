import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

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
                <User className="input-icon h-4 w-4" />
                <Input
                  id="firstName"
                  type="text"
                  placeholder="הזן שם פרטי"
                  className="input-field"
                  {...register("firstName")}
                  disabled={isLoading}
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="lastName" className="form-label">שם משפחה</Label>
              <div className="input-wrapper">
                <User className="input-icon h-4 w-4" />
                <Input
                  id="lastName"
                  type="text"
                  placeholder="הזן שם משפחה"
                  className="input-field"
                  {...register("lastName")}
                  disabled={isLoading}
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="email" className="form-label">אימייל</Label>
              <div className="input-wrapper">
                <Mail className="input-icon h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="הזן כתובת אימייל"
                  className="input-field"
                  {...register("email")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="password" className="form-label">סיסמה</Label>
              <div className="input-wrapper password-wrapper">
                <Lock className="input-icon h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="הזן סיסמה"
                  className="input-field"
                  {...register("password")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="form-group">
              <Label htmlFor="confirmPassword" className="form-label">אימות סיסמה</Label>
              <div className="input-wrapper password-wrapper">
                <Lock className="input-icon h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="הזן שוב את הסיסמה"
                  className="input-field"
                  {...register("confirmPassword")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showConfirm ? "הסתר סיסמה" : "הצג סיסמה"}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? "נרשם..." : "הרשם"}
            </Button>
          </form>

          <div className="auth-links">
            <Link to="/login">כבר יש לך חשבון? התחבר כאן</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
