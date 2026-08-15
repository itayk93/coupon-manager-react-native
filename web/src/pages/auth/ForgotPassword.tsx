import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "כתובת אימייל לא חוקית" }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("קישור לאיפוס סיסמה נשלח לאימייל שלך.");
    } catch (error: any) {
      toast.error(error.message || "שגיאה בשליחת הקישור. אנא בדוק שהאימייל נכון.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold font-display text-primary">איפוס סיסמה</CardTitle>
          <CardDescription>
            הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess ? (
            <div className="text-center space-y-4 p-4 bg-success/10 text-success rounded-md border border-success/20">
              <p>בדוק את תיבת המייל שלך. שלחנו לך קישור לאיפוס הסיסמה.</p>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to="/login">חזרה להתחברות</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "שולח קישור..." : "שלח קישור לאיפוס"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            נזכרת בסיסמה?{" "}
            <Link to="/login" className="text-primary hover:underline">
              התחבר כאן
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
