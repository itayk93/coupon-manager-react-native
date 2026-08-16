import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_COLUMNS } from "@/lib/userColumns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Company,
  Newsletter,
  ScheduledTask,
  TaskExecutionLog,
  AdminMessage,
  AutoUpdateRun,
  UserUpdate,
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

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UserUpdate }) => {
      const { error } = await supabase.from("users").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("המשתמש עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["manage_users"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

// ---------- Companies / Logos ----------
export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("company_count", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });
}

export function useUpsertCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (company: { id?: number; name: string; image_path: string }) => {
      if (company.id) {
        const { error } = await supabase
          .from("companies")
          .update({ name: company.name, image_path: company.image_path })
          .eq("id", company.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("companies")
          .insert({ name: company.name, image_path: company.image_path, company_count: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      notify.success("החברה נשמרה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("החברה נמחקה בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

// ---------- Scheduled tasks ----------
export function useScheduledTasks() {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["scheduled_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scheduled_tasks").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data as ScheduledTask[];
    },
    enabled: isAdmin,
  });
}

export function useTaskLogs(taskId: number | undefined) {
  return useQuery({
    queryKey: ["task_logs", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_execution_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("executed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as TaskExecutionLog[];
    },
    enabled: !!taskId,
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { error } = await supabase
        .from("scheduled_tasks")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("סטטוס המשימה עודכן!");
      queryClient.invalidateQueries({ queryKey: ["scheduled_tasks"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}

// ---------- Newsletters ----------
export function useNewsletters() {
  const isAdmin = useAdminGuard();
  return useQuery({
    queryKey: ["newsletters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletters").select("*").order("created_at", { ascending: false });
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
          content: nl.content ?? null,
          newsletter_type: nl.newsletter_type ?? "general",
          created_by: user!.id,
          is_published: false,
          is_sent: false,
          sent_count: 0,
          show_telegram_button: nl.show_telegram_button ?? false,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      notify.success("הניוזלטר נשמר בהצלחה!");
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
    },
    onSuccess: () => {
      notify.success("הניוזלטר נמחק בהצלחה!");
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
      const { data, error } = await supabase.from("admin_messages").select("*").order("created_at", { ascending: false });
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
      notify.success("ההודעה נשלחה בהצלחה!");
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

// ---------- Auto-update runs ----------
export function useAutoUpdateRuns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["auto_update_runs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("auto_update_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as AutoUpdateRun[];
    },
    enabled: !!user,
  });
}
