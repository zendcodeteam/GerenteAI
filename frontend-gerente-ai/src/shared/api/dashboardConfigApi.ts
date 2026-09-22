import { apiClient } from "@/lib/apiClient";

export type DashboardConfigRecord = {
  clave: string;
  valor: Record<string, unknown>;
  sedeId: string | null;
};

export const dashboardConfigApi = {
  get: async (sedeId?: string): Promise<DashboardConfigRecord[]> => {
    const query = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : "";
    return apiClient<DashboardConfigRecord[]>(`/dashboard-config${query}`);
  },

  save: async (clave: string, valor: Record<string, unknown>, sedeId?: string) => {
    return apiClient<DashboardConfigRecord>("/dashboard-config", {
      method: "PATCH",
      body: JSON.stringify({ clave, valor, ...(sedeId ? { sedeId } : {}) }),
    });
  },
};
