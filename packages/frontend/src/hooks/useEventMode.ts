import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/appStore';

export function useEventMode() {
  const { tenant, setLiveEvent } = useAppStore();

  const { data } = useQuery({
    queryKey: ['live-event', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data } = await apiClient.get(`/tenants/${tenant.id}/events?status=live&limit=1`);
      return data.data?.[0] ?? null;
    },
    refetchInterval: 60_000, // check every minute
    enabled: !!tenant?.id,
  });

  useEffect(() => {
    if (data) {
      setLiveEvent({
        event_id: data.id,
        event_name: data.name,
        elapsed_minutes: Math.floor((Date.now() - new Date(data.scheduled_at).getTime()) / 60_000),
      });
    } else {
      setLiveEvent(null);
    }
  }, [data, setLiveEvent]);

  return { liveEvent: data, isEventDay: !!data };
}
