import axios from "axios";

const TOKEN_KEY = "ga_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at?: string;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function register(
  email: string,
  username: string,
  displayName: string,
  password: string
): Promise<AuthUser> {
  const res = await api.post("/auth/register", {
    email,
    username,
    display_name: displayName,
    password,
  });
  setToken(res.data.access_token);
  return getMe();
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.post("/auth/login", { email, password });
  setToken(res.data.access_token);
  return getMe();
}

export async function getMe(): Promise<AuthUser> {
  const res = await api.get("/auth/me");
  return res.data;
}

export function logout() {
  api.post("/auth/logout").catch(() => null).finally(() => clearToken());
  clearToken();
}
