import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Mail, Shield, Smartphone, Lock, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOptOut, useSetOptOut, useDeleteAccount } from '@/hooks/useConsent';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: optOut } = useOptOut();
  const setOptOut = useSetOptOut();
  const deleteAccount = useDeleteAccount();
  const {
    isSupported,
    notificationsEnabled,
    permission,
    reason,
    isLoading: pushLoading,
    isBusy: pushBusy,
    enable,
    disable,
    sendTest,
  } = usePwaNotifications();

  const [newsletter, setNewsletter] = useState(true);
  const [telegramSummary, setTelegramSummary] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [gdprDialogOpen, setGdprDialogOpen] = useState(false);
  const [gdprConfirmation, setGdprConfirmation] = useState('');

  useEffect(() => {
    if (profile) {
      setNewsletter(profile.newsletter_subscription);
      setTelegramSummary(profile.telegram_monthly_summary);
    }
  }, [profile]);

  const handleSavePreferences = async () => {
    try {
      await updateProfile.mutateAsync({
        newsletter_subscription: newsletter,
        telegram_monthly_summary: telegramSummary,
      });
      toast.success("העדפות נשמרו בהצלחה!");
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleGdprDelete = async () => {
    if (gdprConfirmation !== profile?.email) {
      toast.error('כדי למחוק את כל הנתונים יש להזין את כתובת האימייל במדויק.');
      return;
    }
    await deleteAccount.mutateAsync();
    setGdprDialogOpen(false);
    setGdprConfirmation('');
    navigate('/login', { replace: true });
  };

  const handleResetPassword = () => {
    setResetDialogOpen(false);
    navigate('/forgot-password', { state: { email: profile?.email } });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== profile?.email) {
      toast.error('כדי למחוק את החשבון יש להזין את כתובת האימייל במדויק.');
      return;
    }

    try {
      await updateProfile.mutateAsync({ is_deleted: true });
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
      await signOut();
      toast.success('החשבון סומן כמחוק.');
      navigate('/login', { replace: true });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleEnablePwaNotifications = async () => {
    try {
      await enable();
      toast.success('התראות Push הופעלו בהצלחה.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'לא ניתן היה להפעיל התראות Push.');
    }
  };

  const handleDisablePwaNotifications = async () => {
    try {
      await disable();
      toast.success('התראות Push כובו.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'לא ניתן היה לכבות התראות Push.');
    }
  };

  const handleTestPush = async () => {
    try {
      await sendTest();
      toast.success('התראת בדיקה נשלחה.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שליחת התראת הבדיקה נכשלה.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-[200px]" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display text-primary">הגדרות חשבון</h1>
        <p className="text-muted-foreground">נהל את ההתראות, האבטחה והעדפות המערכת שלך</p>
      </div>

      <Tabs defaultValue="notifications" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 me-2" />
            התראות
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 me-2" />
            אבטחה
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Lock className="w-4 h-4 me-2" />
            פרטיות
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>העדפות התראות ותקשורת</CardTitle>
              <CardDescription>
                בחר אילו סוגי הודעות תרצה לקבל מאיתנו.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-4 space-x-reverse rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">ניוזלטר ומבצעים</Label>
                    <p className="text-sm text-muted-foreground text-end">
                      קבל עדכונים שבועיים על מבצעים חמים וקופונים חדשים.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={newsletter} 
                  onCheckedChange={setNewsletter} 
                />
              </div>

              <div className="flex items-center justify-between space-x-4 space-x-reverse rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">סיכום חודשי בטלגרם</Label>
                    <p className="text-sm text-muted-foreground text-end">
                      קבל הודעה חודשית בטלגרם עם סיכום החיסכון שלך.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={telegramSummary} 
                  onCheckedChange={setTelegramSummary} 
                />
              </div>

              <div className="flex items-center justify-between space-x-4 space-x-reverse rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">התראות PWA</Label>
                    <p className="text-sm text-muted-foreground text-end">
                      קבל התראות מערכת אמיתיות גם כשהאפליקציה סגורה, כולל עדכוני קופונים אוטומטיים.
                    </p>
                    <p className="text-xs text-muted-foreground text-end">
                      מצב נוכחי: {pushLoading ? 'טוען...' : notificationsEnabled ? 'פעיל' : permission === 'denied' ? 'חסום בדפדפן' : 'לא הופעל'}
                    </p>
                    {!isSupported && reason && (
                      <p className="text-xs text-destructive text-end">{reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestPush}
                    disabled={!notificationsEnabled || pushBusy}
                  >
                    בדיקה
                  </Button>
                  <Button
                    type="button"
                    variant={notificationsEnabled ? 'secondary' : 'default'}
                    onClick={notificationsEnabled ? handleDisablePwaNotifications : handleEnablePwaNotifications}
                    disabled={!isSupported || pushBusy || pushLoading}
                  >
                    {notificationsEnabled ? 'כבה' : 'הפעל'}
                  </Button>
                </div>
              </div>

            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button onClick={handleSavePreferences} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'שומר...' : 'שמור העדפות'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>סיסמה ואבטחה</CardTitle>
              <CardDescription>
                נהל את הגדרות האבטחה של החשבון שלך.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <h3 className="font-medium mb-2">שינוי סיסמה</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  כדי לשנות את הסיסמה שלך, ניתוב לדף איפוס סיסמה ישלח למייל המוגדר בחשבון.
                </p>
                <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
                  שלח קישור לשינוי סיסמה
                </Button>
              </div>
              
              <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <h3 className="font-medium text-destructive mb-2">מחיקת חשבון</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  מחיקת החשבון תסיר את כל הנתונים, הקופונים וההיסטוריה שלך מהמערכת. פעולה זו היא בלתי הפיכה.
                </p>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                  מחק את החשבון שלי
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>פרטיות ונתונים (GDPR)</CardTitle>
              <CardDescription>
                שליטה בדיוור השיווקי ובנתונים האישיים שלך.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <ShieldOff className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">ביטול דיוור שיווקי</Label>
                    <p className="text-sm text-muted-foreground text-end">
                      הפעלה תמנע כל דיוור שיווקי (התראות תפעוליות ימשיכו להישלח).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(optOut?.opted_out)}
                  onCheckedChange={(v) => setOptOut.mutate(v)}
                  disabled={setOptOut.isPending}
                />
              </div>

              <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <h3 className="font-medium text-destructive mb-2">מחיקת כל הנתונים האישיים</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  בהתאם לזכות להישכח (GDPR): מחיקה מלאה ובלתי הפיכה של כל הקופונים, ההתראות והפרטים האישיים שלך.
                </p>
                <Button variant="destructive" onClick={() => setGdprDialogOpen(true)}>
                  מחק את כל הנתונים שלי
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="legacy-modal-content settings-security-modal" dir="rtl">
          <DialogHeader>
            <DialogTitle>שינוי סיסמה</DialogTitle>
            <DialogDescription>
              בדומה למערכת הישנה, שינוי הסיסמה מתבצע דרך מסך איפוס סיסמה ושולח קישור מאובטח לכתובת האימייל של החשבון.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-4 text-end text-sm">
            הקישור יישלח אל: <span className="font-semibold direction-ltr inline-block">{profile?.email}</span>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={handleResetPassword}>המשך לאיפוס סיסמה</Button>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteConfirmation('');
      }}>
        <DialogContent className="legacy-modal-content settings-security-modal" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">אישור מחיקת חשבון</DialogTitle>
            <DialogDescription>
              המערכת הישנה מסמנת משתמשים כמחוקים באמצעות שדה is_deleted. הפעולה כאן מבצעת את אותה מחיקה רכה ומנתקת את החשבון.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-end">
            <p className="text-sm text-muted-foreground">
              כדי לאשר, יש להזין את כתובת האימייל המלאה של החשבון:
            </p>
            <Label htmlFor="delete-confirm-email">אימייל לאישור</Label>
            <Input
              id="delete-confirm-email"
              dir="ltr"
              className="text-start"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={profile?.email}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={updateProfile.isPending || deleteConfirmation !== profile?.email}
            >
              {updateProfile.isPending ? 'מוחק...' : 'אשר מחיקה'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gdprDialogOpen} onOpenChange={(open) => {
        setGdprDialogOpen(open);
        if (!open) setGdprConfirmation('');
      }}>
        <DialogContent className="legacy-modal-content settings-security-modal" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">מחיקת כל הנתונים (GDPR)</DialogTitle>
            <DialogDescription>
              פעולה זו תמחק לצמיתות את כל הקופונים, ההתראות והפרטים האישיים שלך. לא ניתן לשחזר.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-end">
            <p className="text-sm text-muted-foreground">כדי לאשר, הזן את כתובת האימייל המלאה של החשבון:</p>
            <Label htmlFor="gdpr-confirm-email">אימייל לאישור</Label>
            <Input
              id="gdpr-confirm-email"
              dir="ltr"
              className="text-start"
              value={gdprConfirmation}
              onChange={(e) => setGdprConfirmation(e.target.value)}
              placeholder={profile?.email}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              onClick={handleGdprDelete}
              disabled={deleteAccount.isPending || gdprConfirmation !== profile?.email}
            >
              {deleteAccount.isPending ? 'מוחק...' : 'מחק הכל לצמיתות'}
            </Button>
            <Button variant="outline" onClick={() => setGdprDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
