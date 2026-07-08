import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tag } from '@/integrations/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// All tags in the system (shared across users, like the original design)
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .order('count', { ascending: false });

      if (error) throw error;
      return data as Tag[];
    },
  });
}

// Tag ids attached to a specific coupon
export function useCouponTags(couponId: number | undefined) {
  return useQuery({
    queryKey: ['coupon_tags', couponId],
    queryFn: async () => {
      if (!couponId) return [];
      const { data, error } = await supabase
        .from('coupon_tags')
        .select('tag_id, tag:tag_id (id, name, count)')
        .eq('coupon_id', couponId);

      if (error) throw error;
      return (data as any[]).map((row) => row.tag as Tag);
    },
    enabled: !!couponId,
  });
}

async function getOrCreateTag(name: string): Promise<Tag> {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from('tag')
    .select('*')
    .eq('name', trimmed)
    .maybeSingle();

  if (existing) return existing as Tag;

  const { data, error } = await supabase
    .from('tag')
    .insert({ name: trimmed, count: 0 })
    .select()
    .single();

  if (error) throw error;
  return data as Tag;
}

// Replace the full set of tags on a coupon (add missing, remove dropped) and keep counts in sync
export function useSetCouponTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ couponId, tagNames }: { couponId: number; tagNames: string[] }) => {
      const names = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));

      // Current links
      const { data: currentLinks, error: linksError } = await supabase
        .from('coupon_tags')
        .select('tag_id, tag:tag_id (id, name)')
        .eq('coupon_id', couponId);
      if (linksError) throw linksError;

      const currentTags = (currentLinks as any[]).map((r) => ({ id: r.tag_id as number, name: r.tag?.name as string }));
      const currentNames = new Set(currentTags.map((t) => t.name));
      const desiredNames = new Set(names);

      // Add new tags
      for (const name of names) {
        if (currentNames.has(name)) continue;
        const tag = await getOrCreateTag(name);
        await supabase.from('coupon_tags').insert({ coupon_id: couponId, tag_id: tag.id });
        await supabase.from('tag').update({ count: (tag.count || 0) + 1 }).eq('id', tag.id);
      }

      // Remove dropped tags
      for (const t of currentTags) {
        if (desiredNames.has(t.name)) continue;
        await supabase.from('coupon_tags').delete().eq('coupon_id', couponId).eq('tag_id', t.id);
        const { data: tagRow } = await supabase.from('tag').select('count').eq('id', t.id).single();
        const newCount = Math.max(0, (tagRow?.count || 1) - 1);
        await supabase.from('tag').update({ count: newCount }).eq('id', t.id);
      }

      return true;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['coupon_tags', variables.couponId] });
      queryClient.invalidateQueries({ queryKey: ['coupon_tags_map'] });
    },
    onError: (error: any) => {
      toast.error(`שגיאה בעדכון התגיות: ${error.message}`);
    },
  });
}

// Map of coupon_id -> tag names, for filtering the whole list at once
export function useCouponTagsMap() {
  return useQuery({
    queryKey: ['coupon_tags_map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupon_tags')
        .select('coupon_id, tag:tag_id (name)');

      if (error) throw error;
      const map: Record<number, string[]> = {};
      for (const row of data as any[]) {
        const name = row.tag?.name;
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
    queryKey: ['admin_tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tag').select('*').order('name');
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
      const { error } = await supabase.from('tag').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('התגית עודכנה');
      queryClient.invalidateQueries({ queryKey: ['admin_tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await supabase.from('coupon_tags').delete().eq('tag_id', id);
      const { error } = await supabase.from('tag').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('התגית נמחקה');
      queryClient.invalidateQueries({ queryKey: ['admin_tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['coupon_tags_map'] });
    },
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });
}
