import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '@crm/shared';

interface AuthState {
  token: string | null;
  employee: Pick<Employee, 'id' | 'name' | 'location_ids'> | null;
  selectedLocationId: string | null;
  
  setAuth: (token: string, employee: Pick<Employee, 'id' | 'name' | 'location_ids'>) => void;
  setLocation: (locationId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      employee: null,
      selectedLocationId: null,

      setAuth: (token, employee) => set({ token, employee }),
      setLocation: (selectedLocationId) => set({ selectedLocationId }),
      logout: () => set({ token: null, employee: null, selectedLocationId: null }),
    }),
    {
      name: 'crm-auth-storage',
    }
  )
);
