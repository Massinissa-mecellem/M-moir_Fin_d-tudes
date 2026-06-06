import axios, { type AxiosInstance } from "axios";
import { clearAccessToken, getAccessToken } from "@/lib/authStorage";
import type { AlertItem, AnalyticsPoint, Parcelle, ParcelleDetails, ParcelleGeometry, ParcelleMeteo } from "./types";

// Configurez VITE_API_URL dans .env.local pour pointer vers votre backend.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const attachAuth = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        clearAccessToken();
        const path = window.location.pathname;
        if (!path.startsWith("/login") && !path.startsWith("/auth/callback")) {
          window.location.assign("/login");
        }
      }
      return Promise.reject(err);
    }
  );
};

const client = axios.create({
  baseURL: `${API_BASE}/api/parcelles`,
  headers: { "Content-Type": "application/json" },
});

const alertsClient = axios.create({
  baseURL: `${API_BASE}/api/alertes`,
  headers: { "Content-Type": "application/json" },
});

const dashboardClient = axios.create({
  baseURL: `${API_BASE}/api/dashboard`,
  headers: { "Content-Type": "application/json" },
});

const pushClient = axios.create({
  baseURL: `${API_BASE}/api/push`,
  headers: { "Content-Type": "application/json" },
});

export const authClient = axios.create({
  baseURL: `${API_BASE}/api/auth`,
  headers: { "Content-Type": "application/json" },
});

attachAuth(client);
attachAuth(alertsClient);
attachAuth(dashboardClient);
attachAuth(pushClient);
attachAuth(authClient);

export interface CreateParcellePayload {
  nom: string;
  proprietaire: string;
  cultureType?: string;
  datePlantation?: string;
  cultureEstimatedStage?: string;
  cultureAgeYears?: number;
  treeDensity?: number;
  surface?: number;
  geometry: ParcelleGeometry;
}

export const parcellesApi = {
  list: async (): Promise<Parcelle[]> => {
    const { data } = await client.get<Parcelle[]>("/");
    return data;
  },
  get: async (id: string): Promise<ParcelleDetails> => {
    const { data } = await client.get<ParcelleDetails>(`/${id}`);
    return data;
  },
    create: async (payload: CreateParcellePayload) => {
    const { data } = await client.post("/", payload);
    return data as { success: boolean; info: Parcelle; analytics: AnalyticsPoint[]; ndviMoyen: number; ndwiMoyen: number; saviMoyen: number; gndviMoyen: number; ndreMoyen: number; eviMoyen: number };
  },
  update: async (id: string, payload: Partial<CreateParcellePayload>) => {
    const { data } = await client.put(`/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await client.delete(`/${id}`);
    return data;
  },
  analyzeStress: async (id: string) => {
    const { data } = await client.post(`/${id}/analyze-stress`);
    return data;
  },
  getHeatmap: async (id: string, index?: string) => {
    const { data } = await client.get<{ url: string }>(`/${id}/heatmap`, { params: { index } });
    return data;
  },
  listByFarmer: async (farmerId: string): Promise<Parcelle[]> => {
    const { data } = await client.get<Parcelle[]>(`/farmer/${farmerId}`);
    return data;
  },
};

export interface ParcelleSeriesResult {
  parcelleId: string;
  nom: string;
  status?: "ok" | "warning" | "critical";
  ndviMoyen?: number | null;
  ndwiMoyen?: number | null;
  saviMoyen?: number | null;
  gndviMoyen?: number | null;
  ndreMoyen?: number | null;
  eviMoyen?: number | null;
  lastAnalyzedCaptureDate?: string | null;
  series: AnalyticsPoint[];
}

export const compareParcellesSeries = async (
  ids: string[],
  debut: string,
  fin: string
): Promise<ParcelleSeriesResult[]> => {
  const { data } = await client.get<ParcelleSeriesResult[]>("/compare", {
    params: { ids: ids.join(","), debut, fin },
  });
  return data;
};

export const alertsApi = {
  list: async (params?: { limit?: number; statut?: "active" }): Promise<AlertItem[]> => {
    const { data } = await alertsClient.get<AlertItem[]>("/", { params });
    return data;
  },
  markRead: async (id: string): Promise<AlertItem> => {
    const { data } = await alertsClient.patch<AlertItem>(`/${id}/read`);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await alertsClient.delete(`/${id}`);
    return data as { success: boolean };
  },
  clearRead: async () => {
    const { data } = await alertsClient.delete("/", { params: { mode: "read" } });
    return data as { success: boolean; deletedCount: number };
  },
  clearAll: async () => {
    const { data } = await alertsClient.delete("/", { params: { mode: "all" } });
    return data as { success: boolean; deletedCount: number };
  },
};

export interface DashboardStats {
  activeParcelles: number;
  trendParcelles: number;
  ndviGlobalAvg: number | null;
  trendNdvi: number;
  saviGlobalAvg: number | null;
  gndviGlobalAvg: number | null;
  stressHydriqueCount: number;
  trendStressHydrique: number;
  activeAlertsCount: number;
  trendAlerts: number;
}

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const { data } = await dashboardClient.get<DashboardStats>("/stats");
    return data;
  },
  serie: async (): Promise<{ date: string; ndvi: number | null; ndwi: number | null }[]> => {
    const { data } = await dashboardClient.get<{ date: string; ndvi: number | null; ndwi: number | null }[]>("/serie");
    return data;
  },
  statusDistribution: async (): Promise<{ name: string; value: number }[]> => {
    const { data } = await dashboardClient.get<{ name: string; value: number }[]>("/status-distribution");
    return data;
  },
  wilayas: async (): Promise<{ name: string; value: number }[]> => {
    const { data } = await dashboardClient.get<{ name: string; value: number }[]>("/wilayas");
    return data;
  },
};

export const getParcelleSeries = async (id: string, debut: string, fin: string): Promise<AnalyticsPoint[]> => {
  const { data } = await client.get<{ analytics: AnalyticsPoint[] }>(`/${id}/serie-temporelle`, {
    params: { debut, fin },
  });
  return data.analytics ?? [];
};

export const getParcelleMeteo = async (id: string): Promise<ParcelleMeteo> => {
  const { data } = await client.get<ParcelleMeteo>(`/${id}/meteo`);
  return data;
};

export const pushApi = {
  subscribe: async (subscription: PushSubscriptionJSON) => {
    const { data } = await pushClient.post("/subscribe", subscription);
    return data;
  },
  unsubscribe: async (endpoint: string) => {
    const { data } = await pushClient.post("/unsubscribe", { endpoint });
    return data;
  },
};

export const getVapidPublicKey = () =>
  import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export interface AuthMeUser {
  _id: string;
  googleId: string;
  email: string;
  nom: string;
  prenom: string;
  photo: string;
  role: string;
  wilaya: string;
  nomExploitation?: string;
  telephone?: string;
  adresse?: string;
  specialites?: string[];
  createdAt: string;
}

export interface PatchProfilePayload {
  role?: string;
  wilaya?: string;
  nomExploitation?: string;
  telephone?: string;
  adresse?: string;
  specialites?: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nom?: string;
  prenom?: string;
}

export interface ConversationItem {
  _id: string;
  farmer: AuthMeUser;
  advisor: AuthMeUser;
  lastMessage?: MessageItem;
  updatedAt: string;
}

export interface MessageItem {
  _id: string;
  conversation: string;
  sender: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
}

export interface PublicationItem {
  _id: string;
  author: AuthMeUser;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
}

export const conseilsApi = {
  listConversations: async (): Promise<ConversationItem[]> => {
    const { data } = await authClient.get<ConversationItem[]>("/conseils/conversations");
    return data;
  },
  listExperts: async (): Promise<AuthMeUser[]> => {
    const { data } = await authClient.get<AuthMeUser[]>("/conseils/experts");
    return data;
  },
  getPublications: async (expertId: string): Promise<PublicationItem[]> => {
    const { data } = await authClient.get<PublicationItem[]>(`/conseils/experts/${expertId}/publications`);
    return data;
  },
  createPublication: async (payload: { text: string; fileUrl?: string; fileName?: string; fileType?: string }): Promise<PublicationItem> => {
    const { data } = await authClient.post<PublicationItem>("/conseils/publications", payload);
    return data;
  },
  deletePublication: async (id: string): Promise<{ success: boolean }> => {
    const { data } = await authClient.delete<{ success: boolean }>(`/conseils/publications/${id}`);
    return data;
  },
  getMessages: async (conversationId: string): Promise<MessageItem[]> => {
    const { data } = await authClient.get<MessageItem[]>(`/conseils/conversations/${conversationId}/messages`);
    return data;
  },
  sendMessage: async (payload: { conversationId: string; text: string; fileUrl?: string; fileName?: string; fileType?: string }): Promise<MessageItem> => {
    const { data } = await authClient.post<MessageItem>("/conseils/messages", payload);
    return data;
  },
  uploadFile: async (file: File): Promise<{ fileUrl: string; fileName: string; fileType: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await authClient.post<{ fileUrl: string; fileName: string; fileType: string }>("/conseils/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },
  initiate: async (advisorId: string): Promise<ConversationItem> => {
    const { data } = await authClient.post<ConversationItem>("/conseils/conversations", { advisorId });
    return data;
  },
};

export const authApi = {
  me: async (): Promise<AuthMeUser> => {
    const { data } = await authClient.get<AuthMeUser>("/me");
    return data;
  },
  patchProfile: async (
    payload: PatchProfilePayload
  ): Promise<{ user: AuthMeUser; token: string }> => {
    const { data } = await authClient.patch<{ user: AuthMeUser; token: string }>("/me", payload);
    return data;
  },
  login: async (payload: LoginPayload): Promise<{ user: AuthMeUser; token: string }> => {
    const { data } = await authClient.post<{ user: AuthMeUser; token: string }>("/login", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<{ user: AuthMeUser; token: string }> => {
    const { data } = await authClient.post<{ user: AuthMeUser; token: string }>("/register", payload);
    return data;
  },
};
