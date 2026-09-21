import { apiClient } from '@/lib/apiClient';

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAssistantDto {
  tenantId?: string;
  businessId: string;
  question: string;
  history?: AssistantHistoryItem[];
  plan?: string;
}

export interface AssistantToolUsed {
  name: string;
  args: Record<string, unknown>;
}

export interface AssistantResult {
  answer: string;
  toolsUsed: AssistantToolUsed[];
  meta: {
    promptVersion: string;
    provider: string;
    model: string;
    latencyMs: number;
    costUsd: number;
  };
}

export interface AssistantApiResponse {
  success: boolean;
  data: AssistantResult;
}

export interface AiUsageQuota {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
}

export interface AiUsageResponse {
  quota: AiUsageQuota;
  summary: { messages: number };
}

export const assistantApi = {
  /**
   * Consulta al asistente financiero conversacional
   * POST /ai/assistant/ask
   */
  ask: async (dto: AskAssistantDto): Promise<AssistantResult> => {
    const res = await apiClient<AssistantApiResponse>('/ai/assistant/ask', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return res.data;
  },

  /**
   * Consulta la cuota y consumo del plan para el tenant
   * GET /ai/usage/:tenantId
   */
  getUsage: async (tenantId: string) => {
    return apiClient<{ success: boolean; data: AiUsageResponse }>(
      `/ai/usage/${tenantId}`,
    );
  },
};
