import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag } from "@/integrations/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { TAG_COLUMNS } from "@/lib/tableColumns";

// All tags in the system
export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tag")
        .select(TAG_COLUMNS)
        .order("count", { ascending: false });

      if (error) throw error;
      return data as Tag[];
    },
  });
}

// Tag ids attached to a specific coupon
export function useCouponTags(couponId: number | undefined) {
  return useQuery({
    queryKey: ["coupon_tags", couponId],
    queryFn: async () => {
      if (!couponId) return [];
      const { data: links, error: linksError } = await supabase
        .from("coupon_tags")
        .select("tag_id")
        .eq("coupon_id", couponId);

      if (linksError) throw linksError;
      const tagIds = Array.from(new Set((links || []).map((row) => row.tag_id)));
      if (tagIds.length === 0) return [];

      const { data: tags, error: tagsError } = await supabase
        .from("tag")
        .select(TAG_COLUMNS)
        .in("id", tagIds);

      if (tagsError) throw tagsError;
      return tags as Tag[];
    },
    enabled: !!couponId,
  });
}

async function getOrCreateTag(name: string): Promise<Tag> {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from("tag")
    .select(TAG_COLUMNS)
    .eq("name", trimmed)
    .maybeSingle();

  if (existing) return existing as Tag;

  const { data, error } = await supabase
    .from("tag")
    .insert({ name: trimmed, count: 0 })
    .select()
    .single();

  if (error) throw error;
  return data as Tag;
}

export function useSetCouponTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ couponId, tagNames }: { couponId: number; tagNames: string[] }) => {
      const names = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));

      const { data: currentLinks, error: linksError } = await supabase
        .from("coupon_tags")
        .select("tag_id")
        .eq("coupon_id", couponId);
      if (linksError) throw linksError;

      const currentTagIds = Array.from(new Set((currentLinks || []).map((row) => row.tag_id)));
      const { data: currentTagsData, error: currentTagsError } =
        currentTagIds.length > 0
          ? await supabase.from("tag").select("id, name").in("id", currentTagIds)
          : { data: [], error: null };
      if (currentTagsError) throw currentTagsError;

      const currentTags = currentTagsData || [];
      const currentNames = new Set(currentTags.map((t) => t.name));
      const desiredNames = new Set(names);

      // Add new tags
      for (const name of names) {
        if (currentNames.has(name)) continue;
        const tag = await getOrCreateTag(name);
        await supabase.from("coupon_tags").insert({ coupon_id: couponId, tag_id: tag.id });
        await supabase.from("tag").update({ count: (tag.count || 0) + 1 }).eq("id", tag.id);
      }

      // Remove dropped tags
      for (const t of currentTags) {
        if (desiredNames.has(t.name)) continue;
        await supabase.from("coupon_tags").delete().eq("coupon_id", couponId).eq("tag_id", t.id);
        const { data: tagRow } = await supabase.from("tag").select("count").eq("id", t.id).single();
        const newCount = Math.max(0, (tagRow?.count || 1) - 1);
        await supabase.from("tag").update({ count: newCount }).eq("id", t.id);
      }

      return true;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["coupon_tags", variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ["coupon_tags_map"] });
    },
    onError: (error: any) => {
      notify.error("שגיאה בעדכון התגיות", error.message);
    },
  });
}

export function useCouponTagsMap() {
  return useQuery({
    queryKey: ["coupon_tags_map"],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("coupon_tags")
        .select("coupon_id, tag_id");

      if (linksError) throw linksError;
      if (!links?.length) return {};

      const tagIds = Array.from(new Set(links.map((row) => row.tag_id)));
      const { data: tags, error: tagsError } = await supabase
        .from("tag")
        .select("id, name")
        .in("id", tagIds);

      if (tagsError) throw tagsError;
      const tagNamesById = new Map((tags || []).map((tag) => [tag.id, tag.name]));
      const map: Record<number, string[]> = {};
      for (const row of links) {
        const name = tagNamesById.get(row.tag_id);
        if (!name) continue;
        (map[row.coupon_id] ||= []).push(name);
      }
      return map;
    },
  });
}

// --- Admin tag management ---
export function useAdminTags() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin_tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tag").select(TAG_COLUMNS).order("name");
      if (error) throw error;
      return data as Tag[];
    },
    enabled: isAdmin,
  });
}

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { error } = await supabase.from("tag").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("התגית עודכנה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["admin_tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("coupon_tags").delete().eq("tag_id", id);
      const { error } = await supabase.from("tag").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("התגית נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["admin_tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["coupon_tags_map"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}
