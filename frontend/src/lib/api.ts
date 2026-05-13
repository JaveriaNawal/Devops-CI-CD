import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor — attach JWT ────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 globally ───────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth API calls ────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: number; name: string; email: string } }>(
      "/auth/login", { email, password }
    ),

  register: (name: string, email: string, password: string) =>
    api.post<{ token: string; user: { id: number; name: string; email: string } }>(
      "/auth/register", { name, email, password }
    ),
};

// ── Tasks API calls ───────────────────────────────────────────
export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export const tasksApi = {
  getAll: () => api.get<Task[]>("/tasks"),
  create: (data: Partial<Task>) => api.post<Task>("/tasks", data),
  update: (id: number, data: Partial<Task>) => api.patch<Task>(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
};

export default api;
