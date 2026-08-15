import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const profileSchema = z.object({
  first_name: z.string().min(2, { message: "שם פרטי חייב להכיל לפחות 2 תווים" }),
  last_name: z.string().min(2, { message: "שם משפחה חייב להכיל לפחות 2 תווים" }),
  age: z.coerce.number().optional().nullable(),
  gender: z.string().optional().nullable(),
  profile_description: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      age: null,
      gender: '',
      profile_description: '',
    },
  });

  // Reset form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        age: profile.age || null,
        gender: profile.gender || '',
        profile_description: profile.profile_description || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('סוג קובץ לא תקין. יש להעלות תמונה בפורמט jpg/png/gif.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageUrl = await resizeImageToDataUrl(file);
      await updateProfile.mutateAsync({ profile_image: imageUrl });
      toast.success('תמונת הפרופיל עודכנה בהצלחה!');
    } catch (error: any) {
      toast.error(error.message || 'שגיאה בעדכון תמונת הפרופיל.');
    } finally {
      setIsUploadingImage(false);
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
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display text-primary">פרופיל משתמש</h1>
        <p className="text-muted-foreground">ניהול המידע האישי שלך במערכת</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-4 flex flex-col items-center p-6 space-y-4">
          <button
            type="button"
            className="group relative cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage || updateProfile.isPending}
            aria-label="החלף תמונת פרופיל"
          >
            <Avatar className="h-32 w-32 border-4 border-background shadow-md transition-opacity group-hover:opacity-75">
              <AvatarImage src={profile?.profile_image || ''} alt={profile?.first_name || ''} />
              <AvatarFallback className="text-4xl bg-primary/10 text-primary font-display">
                {profile?.first_name?.charAt(0) || profile?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploadingImage ? 'מעלה...' : 'החלף תמונה'}
            </div>
          </button>
          <div className="text-center">
            <h2 className="text-xl font-bold font-display">{profile?.first_name} {profile?.last_name}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={handleProfileImageChange}
          />
        </Card>

        <Card className="md:col-span-8">
          <CardHeader>
            <CardTitle>פרטים אישיים</CardTitle>
            <CardDescription>
              עדכן את הפרטים האישיים שלך כאן. הם ישמשו אותנו כדי להתאים עבורך את החוויה.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">שם פרטי</Label>
                  <Input id="first_name" {...form.register("first_name")} disabled={isSubmitting} />
                  {form.formState.errors.first_name && (
                    <p className="text-sm text-destructive">{form.formState.errors.first_name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">שם משפחה</Label>
                  <Input id="last_name" {...form.register("last_name")} disabled={isSubmitting} />
                  {form.formState.errors.last_name && (
                    <p className="text-sm text-destructive">{form.formState.errors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">גיל (אופציונלי)</Label>
                  <Input id="age" type="number" {...form.register("age")} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">מגדר (אופציונלי)</Label>
                  <Select
                    value={form.watch("gender") || ""}
                    onValueChange={(val) => form.setValue("gender", val)}
                    disabled={isSubmitting}
                    dir="rtl"
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="בחר מגדר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="זכר">זכר</SelectItem>
                      <SelectItem value="נקבה">נקבה</SelectItem>
                      <SelectItem value="אחר">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile_description">קצת עליי (אופציונלי)</Label>
                <Textarea 
                  id="profile_description" 
                  rows={4} 
                  {...form.register("profile_description")} 
                  disabled={isSubmitting}
                  placeholder="ספר קצת על עצמך..."
                />
              </div>
            </form>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" form="profile-form" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting ? 'שומר שינויים...' : 'שמור שינויים'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function resizeImageToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('לא ניתן לקרוא את קובץ התמונה.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('קובץ התמונה לא תקין.'));
      image.onload = () => {
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('לא ניתן לעבד את התמונה בדפדפן.'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
