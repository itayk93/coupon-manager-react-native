import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUserTour, TourStepKey } from '@/hooks/useUserTour';

type TourStep = {
  key: TourStepKey;
  title: string;
  description: string;
  route: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    key: 'index',
    title: 'ברוך הבא',
    description: 'כאן רואים תמונת מצב של החיסכון, יתרות וקופונים שפגים בקרוב.',
    route: '/',
  },
  {
    key: 'add_coupon',
    title: 'הוספת קופון',
    description: 'מכאן מוסיפים קופון חדש, כולל טעינה אוטומטית, סכומים ותוקף.',
    route: '/coupons',
  },
  {
    key: 'coupon_detail',
    title: 'צפייה בפרטי קופון',
    description: 'במסך הקופונים אפשר לפתוח פרטים, קוד, שימוש, עריכה ומחיקה.',
    route: '/coupons',
  },
];

export function OnboardingTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldShowTour, completedSteps, markStepCompleted, dismissTour, isLoading, isSaving } = useUserTour();
  const [open, setOpen] = useState(false);

  const pendingSteps = useMemo(
    () => TOUR_STEPS.filter((step) => !completedSteps[step.key]),
    [completedSteps]
  );
  const currentStep = pendingSteps[0];
  const progressValue = ((TOUR_STEPS.length - pendingSteps.length) / TOUR_STEPS.length) * 100;

  useEffect(() => {
    if (!isLoading && shouldShowTour && currentStep) {
      setOpen(true);
    }
  }, [shouldShowTour, isLoading, currentStep]);

  useEffect(() => {
    if (!open || !currentStep) return;
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [open, currentStep, location.pathname, navigate]);

  const handleCompleteStep = async () => {
    if (!currentStep) return;
    await markStepCompleted(currentStep.key);
    const currentIndex = TOUR_STEPS.findIndex((step) => step.key === currentStep.key);
    const nextStep = TOUR_STEPS.slice(currentIndex + 1).find((step) => !completedSteps[step.key]);

    if (nextStep) {
      navigate(nextStep.route);
      return;
    }

    setOpen(false);
    dismissTour();
  };

  if (!currentStep) return null;

  return (
    <Dialog
      open={open && shouldShowTour}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) dismissTour();
      }}
    >
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentStep.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pendingSteps.length} צעדים נותרו</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); dismissTour(); }}>
            סגור לעכשיו
          </Button>
          <Button type="button" onClick={handleCompleteStep} disabled={isSaving}>
            {pendingSteps.length === 1 ? 'הבנתי, סיימתי' : 'הבנתי, בואו נמשיך'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
