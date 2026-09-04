import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { app } from '@crm/firebase-config';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

apiClient.interceptors.request.use(async (config) => {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject(error.response?.data || error.message);
  }
);
