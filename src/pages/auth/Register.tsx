import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          }
        }
      });

      if (error) {
        throw error;
      }

      toast.success("נרשמת בהצלחה! אנא בדוק את תיבת המייל שלך לאימות החשבון.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "שגיאה בהרשמה. אנא נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold font-display text-primary">הרשמה לקופון מאסטר</CardTitle>
          <CardDescription>
            צור חשבון חדש כדי להתחיל לנהל את הקופונים שלך
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-end">
                <Label htmlFor="firstName">שם פרטי</Label>
                <Input
                  id="firstName"
                  type="text"
                  {...register("firstName")}
                  disabled={isLoading}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2 text-end">
                <Label htmlFor="lastName">שם משפחה</Label>
                <Input
                  id="lastName"
                  type="text"
                  {...register("lastName")}
                  disabled={isLoading}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2 text-end">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                className="text-end direction-ltr"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2 text-end">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                className="text-end direction-ltr"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            
            <div className="space-y-2 text-end">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                className="text-end direction-ltr"
                {...register("confirmPassword")}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "נרשם..." : "הרשם"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            כבר יש לך חשבון?{" "}
            <Link to="/login" className="text-primary hover:underline">
              התחבר כאן
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
