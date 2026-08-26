import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag } from "@/integrations/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { TAG_COLUMNS } from "@/lib/tableColumns";

// All tags in the system
export function useTags() {
  const { user } = useAuth();
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
    enabled: !!user,
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

export function useSetCouponTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ couponId, tagNames }: { couponId: number; tagNames: string[] }) => {
      const names = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));

      // One transaction on the server. The old client-side version did a
      // select-then-insert per name (two people adding the same new tag both
      // missed and both inserted) and a read-modify-write on tag.count, which
      // drifted whenever two links landed at once. count is now recomputed
      // from coupon_tags rather than incremented.
      const { error } = await supabase.rpc("set_coupon_tags", {
        p_coupon_id: couponId,
        p_names: names,
      });
      if (error) throw error;

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
  const { user } = useAuth();
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
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ["admin_tags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["coupon_tags_map"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}
