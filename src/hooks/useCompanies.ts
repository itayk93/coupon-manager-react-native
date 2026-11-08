import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Company } from "@/integrations/supabase";
import { COMPANIES_COLUMNS } from "@/lib/tableColumns";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(COMPANIES_COLUMNS)
        .order("company_count", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: any) => notify.error("שגיאה", e.message),
  });
}
