import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LiveEventSummary {
  event_id: string;
  event_name: string;
  elapsed_minutes: number;
  attendance_scanned?: number;
  revenue_to_date?: number;
}

interface TenantInfo {
  id: string;
  name: string;
  type: string;
  tier: string;
  white_label_config: {
    logo_url?: string;
    primary_color?: string;
    app_name?: string;
  } | null;
}

interface AppState {
  tenant: TenantInfo | null;
  liveEvent: LiveEventSummary | null;
  chatPanelOpen: boolean;
  sidebarCollapsed: boolean;

  setTenant: (tenant: TenantInfo | null) => void;
  setLiveEvent: (event: LiveEventSummary | null) => void;
  setChatPanelOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tenant: null,
      liveEvent: null,
      chatPanelOpen: false,
      sidebarCollapsed: false,

      setTenant: (tenant) => set({ tenant }),
      setLiveEvent: (event) => set({ liveEvent: event }),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'venueiq-app-state',
      partialize: (state) => ({ chatPanelOpen: state.chatPanelOpen, sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
