import { useMemo } from 'react';
import { useCoupons } from '@/hooks/useCoupons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, PieChart as PieChartIcon, BarChart3, TrendingUp } from 'lucide-react';
import { exportCouponsToCSV } from '@/lib/exportCoupons';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function Statistics() {
  const { data: coupons, isLoading } = useCoupons();

  const companyStats = useMemo(() => {
    if (!coupons) return [];
    
    const stats: Record<string, { company: string, totalValue: number, usedValue: number, count: number }> = {};
    
    coupons.forEach(coupon => {
      if (!stats[coupon.company]) {
        stats[coupon.company] = { company: coupon.company, totalValue: 0, usedValue: 0, count: 0 };
      }
      stats[coupon.company].totalValue += coupon.value;
      stats[coupon.company].usedValue += coupon.used_value;
      stats[coupon.company].count += 1;
    });
    
    // Sort by total value descending and take top 10
    return Object.values(stats)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [coupons]);

  const statusStats = useMemo(() => {
    if (!coupons) return [];
    
    let active = 0;
    let fullyUsed = 0;
    let expired = 0;
    
    const now = new Date();
    
    coupons.forEach(coupon => {
      if (coupon.value === coupon.used_value) {
        fullyUsed++;
      } else if (coupon.expiration && new Date(coupon.expiration) < now) {
        expired++;
      } else {
        active++;
      }
    });
    
    return [
      { name: 'פעילים', value: active, color: 'hsl(var(--success))' },
      { name: 'נוצלו במלואם', value: fullyUsed, color: 'hsl(var(--primary))' },
      { name: 'פגי תוקף', value: expired, color: 'hsl(var(--destructive))' },
    ].filter(s => s.value > 0);
  }, [coupons]);

  const handleExportCSV = () => {
    if (coupons?.length) exportCouponsToCSV(coupons);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[200px]" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="statistics-page space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display text-primary">סטטיסטיקות ודוחות</h1>
          <p className="text-muted-foreground">ניתוח נתונים, גרפים וייצוא מידע</p>
        </div>
        <Button onClick={handleExportCSV} className="shrink-0 gap-2" variant="outline">
          <Download className="h-4 w-4" /> ייצוא נתונים ל-CSV
        </Button>
      </div>

      {!coupons || coupons.length === 0 ? (
        <Card className="text-center py-20 bg-muted/20 border-dashed">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-xl font-bold mb-2">אין מספיק נתונים</h3>
            <p className="text-muted-foreground">הוסף קופונים כדי לראות ניתוחים סטטיסטיים.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="stats-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                שווי ומימוש לפי מותג (Top 10)
              </CardTitle>
              <CardDescription>השוואה בין השווי הכולל לבין מה שנוצל בפועל אצל החברות המובילות שלך.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={companyStats}
                    margin={{ top: 20, right: 18, left: 10, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="company" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={82}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickFormatter={(value) => `₪${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="totalValue" name="שווי כולל" fill="hsl(var(--primary)/0.7)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="usedValue" name="נוצל" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="stats-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                התפלגות סטטוס קופונים
              </CardTitle>
              <CardDescription>הצגת היחס בין קופונים פעילים, מנוצלים במלואם וכאלו שפג תוקפם.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center">
              <div className="h-[350px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="stats-panel md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                סיכום כללי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="stats-summary-card">
                  <div className="text-sm text-muted-foreground mb-1">סך הכל קופונים</div>
                  <div className="text-3xl font-bold font-display">{coupons.length}</div>
                </div>
                <div className="stats-summary-card primary">
                  <div className="text-sm text-primary font-medium mb-1">חיסכון מצטבר (נוצל)</div>
                  <div className="text-3xl font-bold font-display text-primary">
                    ₪{coupons.reduce((sum, c) => sum + c.used_value, 0).toFixed(2)}
                  </div>
                </div>
                <div className="stats-summary-card">
                  <div className="text-sm text-muted-foreground mb-1">יתרה זמינה</div>
                  <div className="text-3xl font-bold font-display">
                    ₪{coupons.reduce((sum, c) => sum + (c.value - c.used_value), 0).toFixed(2)}
                  </div>
                </div>
                <div className="stats-summary-card danger">
                  <div className="text-sm text-destructive font-medium mb-1">אובדן (פגי תוקף)</div>
                  <div className="text-3xl font-bold font-display text-destructive">
                    ₪{coupons.filter(c => c.expiration && new Date(c.expiration) < new Date()).reduce((sum, c) => sum + (c.value - c.used_value), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
