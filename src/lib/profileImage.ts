import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_BUCKET = "profile-images";

export async function uploadProfileImage(asset: ImagePickerAsset): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Not authenticated");

  const mimeType = asset.mimeType || "image/jpeg";
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${authData.user.id}/${Date.now()}.${extension}`;
  const body = asset.file || (await (await fetch(asset.uri)).arrayBuffer());
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: mimeType,
    cacheControl: "31536000",
  });
  if (error) throw error;

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}
