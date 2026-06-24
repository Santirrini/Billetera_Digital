/**
 * API Service - Connects to FastAPI backend
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const SMS_API_BASE = process.env.EXPO_PUBLIC_SMS_API_URL || "https://billetera-digital.onrender.com";

interface ApiResponse<T> {
  data: T;
  count?: number;
}

interface Transaction {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  currency: string;
  description: string | null;
  category_id: string | null;
  source: string;
  parsed_data: Record<string, unknown> | null;
  llm_enrichment: Record<string, unknown> | null;
  transaction_date: string;
  created_at: string;
  categories?: {
    name: string;
    icon: string;
    color: string;
  } | null;
}

interface DashboardStats {
  total_balance: number;
  total_ingresos: number;
  total_egresos: number;
  transaction_count: number;
  top_categories: Array<{
    name: string;
    icon: string;
    color: string;
    total: number;
    count: number;
  }>;
  recent_transactions: Transaction[];
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  // Dashboard
  getDashboardStats: (period = "month") =>
    fetchApi<DashboardStats>(`/api/dashboard/stats?period=${period}`),

  getCategories: () =>
    fetchApi<ApiResponse<Category[]>>("/api/dashboard/categories"),

  // Transactions
  getTransactions: (params?: { type?: string; limit?: number; offset?: number; period?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.period) query.set("period", params.period);
    return fetchApi<ApiResponse<Transaction[]>>(`/api/transactions/?${query}`);
  },

  getTransaction: (id: string) => fetchApi<Transaction>(`/api/transactions/${id}`),

  createTransaction: (data: Partial<Transaction>) =>
    fetchApi<Transaction>("/api/transactions/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: string) =>
    fetchApi<null>(`/api/transactions/${id}`, { method: "DELETE" }),

  // Email Processing
  processEmail: (subject: string, body: string, messageId?: string) =>
    fetchApi<{
      success: boolean;
      transaction: Transaction;
      enrichment: Record<string, unknown>;
      parse_method: string;
      confidence: number;
    }>("/api/email/process", {
      method: "POST",
      body: JSON.stringify({ subject, body, message_id: messageId }),
    }),

  // SMS Processing (direct to production API)
  processSms: (message: string) => {
    const url = `${SMS_API_BASE}/api/sms/process`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).then(res => res.json());
  },
};

export type { Transaction, DashboardStats, Category };
