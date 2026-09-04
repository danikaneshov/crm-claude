import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { Shift, Location } from '@crm/shared';

interface ShiftState {
  currentShift: Shift | null;
  locations: Location[];
  colleagues: { id: string; name: string }[];
  
  loading: boolean;
  error: string | null;

  fetchCurrentShift: () => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchColleagues: (locationId: string) => Promise<void>;
  openShift: (locationId: string, secondMasterId: string | null) => Promise<void>;
  closeShift: (shiftId: string, photoBase64: string) => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  currentShift: null,
  locations: [],
  colleagues: [],
  loading: false,
  error: null,

  fetchCurrentShift: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get('/shifts/current');
      if (res.ok) {
        set({ currentShift: res.data.shift });
      } else {
        set({ error: res.error });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error fetching shift' });
    } finally {
      set({ loading: false });
    }
  },

  fetchLocations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get('/locations');
      if (res.ok) {
        set({ locations: res.data.locations });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error fetching locations' });
    } finally {
      set({ loading: false });
    }
  },

  fetchColleagues: async (locationId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get('/employees/colleagues', { params: { location_id: locationId } });
      if (res.ok) {
        set({ colleagues: res.data.colleagues });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error fetching colleagues' });
    } finally {
      set({ loading: false });
    }
  },

  openShift: async (locationId: string, secondMasterId: string | null) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.post('/shifts', { location_id: locationId, second_master_id: secondMasterId });
      if (res.ok) {
        set({ currentShift: res.data.shift });
      } else {
        set({ error: res.error });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error opening shift' });
    } finally {
      set({ loading: false });
    }
  },

  closeShift: async (shiftId: string, photoBase64: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.post(`/shifts/${shiftId}/report`, { photo: photoBase64 });
      if (res.ok) {
        // Shift closed, clear current shift
        set({ currentShift: null });
        // Return result if needed for UI (will use local state in component for success screen)
        return res.data;
      } else {
        set({ error: res.error });
        throw new Error(res.error);
      }
    } catch (err: any) {
      set({ error: err.message || 'Error closing shift' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
}));
