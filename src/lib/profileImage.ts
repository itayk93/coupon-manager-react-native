import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_BUCKET = "profile-images";
const STORAGE_PREFIX = "profile-image:";

export function profileImageStoragePath(value: string): string | null {
  if (value.startsWith(STORAGE_PREFIX)) {
    return value.slice(STORAGE_PREFIX.length) || null;
  }
  try {
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const pathname = new URL(value).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    return decodeURIComponent(pathname.slice(markerIndex + marker.length)) || null;
  } catch {
    return null;
  }
}

export async function uploadProfileImage(asset: ImagePickerAsset): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Not authenticated");

  const mimeType = asset.mimeType || "image/jpeg";
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${authData.user.id}/${Date.now()}.${extension}`;
  const body = asset.file || (await (await fetch(asset.uri)).arrayBuffer());
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: mimeType,
    cacheControl: "3600",
  });
  if (error) throw error;

  return `${STORAGE_PREFIX}${path}`;
}

/** Deletes only an uploaded image owned by the signed-in account. */
export async function deleteProfileImage(publicUrl?: string | null): Promise<void> {
  if (!publicUrl) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error("Not authenticated");
  const path = profileImageStoragePath(publicUrl);
  if (!path || !path.startsWith(`${authData.user.id}/`)) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}

export async function signedProfileImageUrl(value: string): Promise<string> {
  const path = profileImageStoragePath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
