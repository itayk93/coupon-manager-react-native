import { useEffect, useState } from 'react';
import { useBulkDeleteCoupons, useCoupons } from '@/hooks/useCoupons';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Copy, Info, Eye, Edit3, Pencil, Trash2, CircleX, FileSpreadsheet, FileText, Upload, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CouponForm } from '@/components/coupons/CouponForm';
import { BulkImport } from '@/components/coupons/BulkImport';
import { getCompanyLogo } from '@/lib/companyLogos';
import { CouponActionModals } from '@/components/coupons/CouponActionModals';
import { DecryptedCoupon } from '@/hooks/useCoupons';
import { exportCouponsToExcel, exportCouponsToPDF } from '@/lib/exportCoupons';
import { useCouponTagsMap } from '@/hooks/useTags';
import { useTriggerAutoUpdate } from '@/hooks/useAutoUpdate';
import { useCouponViewTracking } from '@/hooks/useCouponViewTracking';
import { Checkbox } from '@/components/ui/checkbox';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

export default function CouponsList() {
  const { data: coupons, isLoading, isError, refetch } = useCoupons();
  const bulkDelete = useBulkDeleteCoupons();
  const { data: tagsMap } = useCouponTagsMap();
  const autoUpdate = useTriggerAutoUpdate();
  const { markDetailViewed, markCodeViewed } = useCouponViewTracking();
  const { hasFeature } = useFeatureAccess();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCouponIds, setSelectedCouponIds] = useState<number[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [detailsCoupon, setDetailsCoupon] = useState<DecryptedCoupon | null>(null);
  const [codeCoupon, setCodeCoupon] = useState<DecryptedCoupon | null>(null);
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<DecryptedCoupon | null>(null);
  const [deleteCoupon, setDeleteCoupon] = useState<DecryptedCoupon | null>(null);
  const [markUsedCoupon, setMarkUsedCoupon] = useState<DecryptedCoupon | null>(null);

  useEffect(() => {
    if (detailsCoupon) void markDetailViewed(detailsCoupon.id);
  }, [detailsCoupon, markDetailViewed]);

  useEffect(() => {
    if (codeCoupon) void markCodeViewed(codeCoupon.id);
  }, [codeCoupon, markCodeViewed]);

  const allTagNames = Array.from(new Set(Object.values(tagsMap || {}).flat())).sort();
  const hasAutoUpdatable = (coupons || []).some((c) => c.auto_update);

  const filteredCoupons = coupons?.filter(coupon => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      (coupon.company || '').toLowerCase().includes(normalizedSearch) ||
      (coupon.description || '').toLowerCase().includes(normalizedSearch);
    const matchesTag = !selectedTag || (tagsMap?.[coupon.id] || []).includes(selectedTag);
    return matchesSearch && matchesTag;
  }) || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('הקוד הועתק ללוח!');
  };

  const allFilteredSelected = filteredCoupons.length > 0 && filteredCoupons.every((coupon) => selectedCouponIds.includes(coupon.id));

  const toggleCouponSelection = (couponId: number, checked: boolean) => {
    setSelectedCouponIds((current) => (
      checked ? Array.from(new Set([...current, couponId])) : current.filter((id) => id !== couponId)
    ));
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedCouponIds((current) => current.filter((id) => !filteredCoupons.some((coupon) => coupon.id === id)));
      return;
    }
    setSelectedCouponIds((current) => Array.from(new Set([...current, ...filteredCoupons.map((coupon) => coupon.id)])));
  };

  const confirmBulkDelete = async () => {
    await bulkDelete.mutateAsync(selectedCouponIds);
    setSelectedCouponIds([]);
    setIsBulkDeleteOpen(false);
  };

  return (
    <section className="coupon-management">
      <div className="section-header">
        <h2>הקופונים שלך</h2>
        <div className="flex flex-wrap gap-2">
          {hasAutoUpdatable && hasFeature('auto_update') && (
            <Button variant="outline" className="shrink-0 gap-2" onClick={() => autoUpdate.mutate(undefined)} disabled={autoUpdate.isPending}>
              <RefreshCw className={`h-4 w-4 ${autoUpdate.isPending ? 'animate-spin' : ''}`} /> עדכן יתרות
            </Button>
          )}
          {hasFeature('bulk_import') && (
            <Button variant="outline" className="shrink-0 gap-2" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4" /> ייבוא בכמות
            </Button>
          )}
          {hasFeature('bulk_delete') && selectedCouponIds.length > 0 && (
            <Button variant="destructive" className="shrink-0 gap-2" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> מחק {selectedCouponIds.length} מסומנים
            </Button>
          )}
          <Button className="shrink-0 gap-2 add-coupon-button" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" /> הוסף קופון חדש
          </Button>
        </div>
      </div>

      <div className="search-container">
        <div className="search-input-wrapper relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="סינון לפי חברה..."
            className="input-field ps-4 pe-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {allTagNames.length > 0 && (
          <div className="category-tags-bar">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`tag-pill ${selectedTag === null ? 'active' : ''}`}
            >
              הכל
            </button>
            {allTagNames.map((name) => {
              const displayName = name.replace(/^Tag for\s+/i, '');
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === name ? null : name)}
                  className={`tag-pill ${selectedTag === name ? 'active' : ''}`}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="coupon-container-index">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-0">
                <Skeleton className="h-32 w-full rounded-none" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="no-data-message" role="alert">
          <h3>לא ניתן לטעון את הקופונים</h3>
          <p>ייתכן שהחיבור נותק זמנית. נסה לרענן את העמוד.</p>
          <Button onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /> נסה שוב</Button>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="no-data-message">
          <h3>אין קופונים פעילים.</h3>
          <p>נסה לחפש משהו אחר או הוסף קופון חדש</p>
          <Button onClick={() => setIsFormOpen(true)}>הוסף קופון עכשיו</Button>
        </div>
      ) : (
        <>
        <h3 className="coupon-section-title">קופונים פעילים</h3>
        {hasFeature('bulk_delete') && (
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
            <label className="flex items-center gap-3">
              <Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))} />
              <span>בחר הכל מתוצאות הסינון</span>
            </label>
            <span className="text-muted-foreground">{selectedCouponIds.length} קופונים מסומנים</span>
          </div>
        )}
        <div className="coupon-container-index">
          {filteredCoupons.map((coupon) => {
            const balance = coupon.value - coupon.used_value;
            const usagePercentage = coupon.value > 0 ? Math.min(100, (coupon.used_value / coupon.value) * 100) : 0;
            
            return (
              <div key={coupon.id} className="coupon-card-index-wrapper">
                <Card className="coupon-card-index">
                  {hasFeature('bulk_delete') && (
                    <div className="px-4 pt-4">
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedCouponIds.includes(coupon.id)}
                          onCheckedChange={(checked) => toggleCouponSelection(coupon.id, Boolean(checked))}
                        />
                        <span>בחר למחיקה</span>
                      </label>
                    </div>
                  )}
                  <div className="coupon-header">
                    <img src={getCompanyLogo(coupon.company)} alt={`${coupon.company} Logo`} className="company-logo" />
                    <h4>{coupon.company}</h4>
                  </div>

                  <CardContent className="coupon-content">
                    <div className="coupon-code">
                      <span className="label">קוד קופון:</span>
                      <span className="value">{coupon.code}</span>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(coupon.code)} title="העתק קוד">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="coupon-value">
                      <span className="label">יתרה:</span>
                      <span className="value">{balance.toFixed(2)} ₪</span>
                    </div>

                    <div className="usage-progress">
                      <div className="progress-text">שימוש: {usagePercentage.toFixed(0)}%</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${usagePercentage}%` }} />
                      </div>
                    </div>

                    {coupon.expiration && (
                      <div className="coupon-tags">
                        <span className="label">תוקף:</span>
                        <span className="value">{new Date(coupon.expiration).toLocaleDateString('he-IL')}</span>
                      </div>
                    )}
                    {coupon.status !== 'פעיל' && <Badge variant="secondary">{coupon.status}</Badge>}
                  </CardContent>

                  <div className="coupon-actions">
                    <Button className="action-button view-details" variant="ghost" onClick={() => setDetailsCoupon(coupon)} aria-label="פרטים">
                      <Info className="h-4 w-4" />
                      <span>פרטים</span>
                    </Button>
                    <Button className="action-button show-code" variant="ghost" onClick={() => setCodeCoupon(coupon)} aria-label="הצג קוד">
                      <Eye className="h-4 w-4" />
                      <span>הצג קוד</span>
                    </Button>
                    <Button className="action-button update-usage" variant="ghost" onClick={() => setUsageCoupon(coupon)} disabled={coupon.is_one_time || coupon.status === 'נוצל'} aria-label="עדכן שימוש">
                      <Edit3 className="h-4 w-4" />
                      <span>עדכן שימוש</span>
                    </Button>
                    <Button className="action-button edit-coupon" variant="ghost" onClick={() => setEditingCoupon(coupon)} aria-label="עריכה">
                      <Pencil className="h-4 w-4" />
                      <span>עריכה</span>
                    </Button>
                    <Button className="action-button delete-coupon" variant="ghost" onClick={() => setDeleteCoupon(coupon)} aria-label="מחיקה">
                      <Trash2 className="h-4 w-4" />
                      <span>מחיקה</span>
                    </Button>
                    <Button
                      className="action-button mark-used-coupon"
                      variant="ghost"
                      onClick={() => setMarkUsedCoupon(coupon)}
                      disabled={coupon.status === 'נוצל'}
                      aria-label="סימון כנוצל"
                    >
                      <CircleX className="h-4 w-4" />
                      <span>סימון כנוצל</span>
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
        <div className="action-buttons">
          <Button type="button" className="export-button" onClick={() => exportCouponsToExcel(filteredCoupons)}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>ייצוא ל-Excel</span>
          </Button>
          <Button type="button" className="export-button" onClick={() => exportCouponsToPDF(filteredCoupons)}>
            <FileText className="h-4 w-4" />
            <span>ייצוא ל-PDF</span>
          </Button>
        </div>
        </>
      )}

      <CouponForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      <CouponForm coupon={editingCoupon || undefined} open={!!editingCoupon} onOpenChange={(open) => !open && setEditingCoupon(null)} />
      <BulkImport open={isImportOpen} onOpenChange={setIsImportOpen} />
      <CouponActionModals
        detailsCoupon={detailsCoupon}
        codeCoupon={codeCoupon}
        usageCoupon={usageCoupon}
        deleteCoupon={deleteCoupon}
        markUsedCoupon={markUsedCoupon}
        onDetailsChange={setDetailsCoupon}
        onCodeChange={setCodeCoupon}
        onUsageChange={setUsageCoupon}
        onDeleteChange={setDeleteCoupon}
        onMarkUsedChange={setMarkUsedCoupon}
        onOpenEdit={(coupon) => {
          setDetailsCoupon(null);
          setEditingCoupon(coupon);
        }}
        bulkDeleteCount={selectedCouponIds.length}
        bulkDeleteOpen={isBulkDeleteOpen}
        onBulkDeleteCancel={() => setIsBulkDeleteOpen(false)}
        onBulkDeleteConfirm={confirmBulkDelete}
      />
    </section>
  );
}
