import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
}) as any;

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle auth errors (e.g. token expired, employee deactivated)
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error.response?.data || error.message);
  }
);
