import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureKey, useFeatureAccess } from '@/hooks/useFeatureAccess';

export function FeatureGate({
  featureKey,
  children,
  redirectTo,
}: {
  featureKey: FeatureKey;
  children: ReactNode;
  redirectTo?: string;
}) {
  const { hasFeature } = useFeatureAccess();

  if (hasFeature(featureKey)) {
    return <>{children}</>;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>פיצ׳ר לא זמין בחשבון זה</CardTitle>
        </CardHeader>
        <CardContent>
          פנה למנהל המערכת אם הפיצ׳ר הזה צריך להיות פתוח עבורך.
        </CardContent>
      </Card>
    </div>
  );
}
