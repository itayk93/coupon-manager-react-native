import { useState } from 'react';
import { useSharedWithMe, useMyShares, useRevokeShare } from '@/hooks/useSharing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Share2, Users, ArrowDownToLine, Copy, Link as LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SharingPage() {
  const { data: sharedWithMe, isLoading: loadingIncoming } = useSharedWithMe();
  const { data: myShares, isLoading: loadingOutgoing } = useMyShares();
  const revokeShare = useRevokeShare();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('הקוד הועתק ללוח!');
  };

  const handleRevoke = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך לבטל שיתוף זה?")) {
      await revokeShare.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display text-primary">שיתוף קופונים</h1>
          <p className="text-muted-foreground">שתף קופונים עם חברים ומשפחה, או השתמש בקופונים ששותפו איתך.</p>
        </div>
      </div>

      <Tabs defaultValue="incoming" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="incoming">
            <ArrowDownToLine className="w-4 h-4 me-2" />
            שותפו איתי
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            <Share2 className="w-4 h-4 me-2" />
            השיתופים שלי
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="incoming" className="mt-6">
          {loadingIncoming ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : !sharedWithMe || sharedWithMe.length === 0 ? (
            <Card className="text-center py-20 bg-muted/20 border-dashed">
              <CardContent>
                <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-xl font-bold mb-2">אין קופונים ששותפו איתך</h3>
                <p className="text-muted-foreground">
                  כאשר משתמשים אחרים ישתפו איתך קופון והוא יאושר, הוא יופיע כאן ויהיה זמין לשימושך.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sharedWithMe.map(share => (
                <Card key={share.id} className="overflow-hidden border-primary/20 bg-primary/5">
                  <div className="bg-primary p-4 text-primary-foreground flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg font-display">{share.coupon.company}</h3>
                      <p className="text-sm opacity-90">מאת: {share.shared_by?.first_name || share.shared_by?.email}</p>
                    </div>
                    <Badge variant="outline" className="bg-background/20 text-white border-white/30">
                      ₪{(share.coupon.value - share.coupon.used_value).toFixed(2)}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    {share.coupon.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{share.coupon.description}</p>
                    )}
                    
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground mb-1">קוד קופון:</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background px-2 py-1.5 rounded text-sm text-center font-mono tracking-wider border">
                          {share.coupon.code}
                        </code>
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(share.coupon.code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                    תוקף שיתוף: {new Date(share.share_expires_at).toLocaleDateString('he-IL')}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-6">
          {loadingOutgoing ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : !myShares || myShares.length === 0 ? (
            <Card className="text-center py-20 bg-muted/20 border-dashed">
              <CardContent>
                <Share2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <h3 className="text-xl font-bold mb-2">לא שיתפת אף קופון</h3>
                <p className="text-muted-foreground">
                  אתה יכול לשתף קופונים מדף "הקופונים שלי" כדי לאפשר לחברים ומשפחה להשתמש בהם.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myShares.map(share => {
                const isRevoked = share.status === 'revoked';
                const isPending = share.status === 'pending';
                
                return (
                  <Card key={share.id} className={`overflow-hidden transition-opacity ${isRevoked ? 'opacity-60 grayscale' : ''}`}>
                    <CardHeader className="p-4 border-b bg-muted/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{share.coupon.company}</CardTitle>
                          <CardDescription>
                            ₪{(share.coupon.value - share.coupon.used_value).toFixed(2)} יתרה
                          </CardDescription>
                        </div>
                        <Badge variant={
                          isRevoked ? "destructive" : 
                          isPending ? "secondary" : "default"
                        }>
                          {isRevoked ? "בוטל" : isPending ? "ממתין" : "פעיל"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">שותף עם: </span>
                        <span className="font-medium">
                          {share.shared_with ? (share.shared_with.first_name || share.shared_with.email) : 'קישור ציבורי'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">תאריך יצירה: </span>
                        <span>{new Date(share.created_at).toLocaleDateString('he-IL')}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 border-t flex justify-between">
                      {isPending && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(`${window.location.origin}/share/${share.share_token}`)}>
                          <LinkIcon className="h-3 w-3" /> העתק קישור
                        </Button>
                      )}
                      
                      {!isRevoked && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                          onClick={() => handleRevoke(share.id)}
                          disabled={revokeShare.isPending}
                        >
                          <Trash2 className="h-4 w-4" /> בטל שיתוף
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
