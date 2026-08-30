import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type NewsletterUploadResult = {
  bundle_path: string;
  web_url: string;
  email_subject: string;
  hero_image_url: string | null;
  preview_text: string;
  file_count: number;
};

/**
 * Pick a design file (ZIP from Claude Design, or a single .html) and hand it to
 * the newsletter-upload edge function, which hosts it and extracts the teaser
 * fields. Returns null if the user cancels the picker.
 */
export function useNewsletterUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newsletterId: number): Promise<NewsletterUploadResult | null> => {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed", "text/html"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return null;
      const asset = res.assets[0];

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data, error } = await supabase.functions.invoke("newsletter-upload", {
        body: { newsletter_id: newsletterId, filename: asset.name, content_base64: base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as NewsletterUploadResult;
    },
    onSuccess: (data) => {
      if (data) {
        notify.success("הקובץ הועלה", `${data.file_count} קבצים · הדף מתארח`);
        queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      }
    },
    onError: (e: any) => notify.error("שגיאה בהעלאת הקובץ", e.message),
  });
}
