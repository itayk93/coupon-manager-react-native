import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_COLUMNS } from "@/lib/userColumns";
import {
  ADMIN_MESSAGES_COLUMNS,
  NEWSLETTERS_COLUMNS,
} from "@/lib/tableColumns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Newsletter,
  AdminMessage,
} from "@/integrations/supabase";
import { notify } from "@/lib/notify";

function useAdminGuard() {
  const { isAdmin } = useAuth();
  return isAdmin;
}

// ---------- Users ----------
export function useManageUsers(search = "") {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["manage_users", search],
    queryFn: async () => {
      let query = supabase.from("users").select(USER_COLUMNS).order("created_at", { ascending: false });
      if (search) query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

// ---------- Companies / Logos ----------
export { useCompanies, useUpsertCompany, useDeleteCompany } from "./useCompanies";

// ---------- Newsletters ----------
export function useNewsletters() {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["newsletters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletters").select(NEWSLETTERS_COLUMNS).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Newsletter[];
    },
    enabled: isAdmin,
  });
}

export function useUpsertNewsletter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (nl: Partial<Newsletter> & { id?: number; title: string }) => {
      if (nl.id) {
        const { error } = await supabase.from("newsletters").update(nl).eq("id", nl.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("newsletters").insert({
          title: nl.title,
          newsletter_type: nl.newsletter_type ?? "general",
          created_by: user!.id,
          is_published: false,
          is_sent: false,
          sent_count: 0,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

export function useDeleteNewsletter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("newsletters").delete().eq("id", id);
      if (error) throw error;
      // Best-effort: clear the hosted design bundle from Storage.
      try {
        const { data } = await supabase.storage.from("newsletters").list(String(id));
        if (data?.length) {
          await supabase.storage.from("newsletters").remove(data.map((o) => `${id}/${o.name}`));
        }
      } catch {
        /* the row is gone; a leftover bundle is harmless */
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

// ---------- Admin broadcast messages ----------
export function useAdminMessages() {
  return useQuery({
    queryKey: ["admin_messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_messages").select(ADMIN_MESSAGES_COLUMNS).order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdminMessage[];
    },
  });
}

export function useCreateAdminMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (msg: { message_text: string; link_url?: string; link_text?: string }) => {
      const { error } = await supabase.from("admin_messages").insert({
        message_text: msg.message_text,
        link_url: msg.link_url || null,
        link_text: msg.link_text || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_messages"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

export function useDeleteAdminMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("admin_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_messages"] });
    },
  });
}

