import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/appStore';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:3013';

let socket: Socket | null = null;

export function useSocket(event: string, handler: (data: unknown) => void) {
  const { tenant } = useAppStore();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!tenant?.id) return;

    if (!socket || !socket.connected) {
      socket = io(REALTIME_URL, {
        auth: { tenant_id: tenant.id },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });
    }

    const listener = (data: unknown) => handlerRef.current(data);
    socket.on(event, listener);

    return () => {
      socket?.off(event, listener);
    };
  }, [event, tenant?.id]);
}

export function useSocketEvents(events: Record<string, (data: unknown) => void>) {
  const { tenant } = useAppStore();

  useEffect(() => {
    if (!tenant?.id) return;

    if (!socket || !socket.connected) {
      socket = io(REALTIME_URL, {
        auth: { tenant_id: tenant.id },
        transports: ['websocket'],
        reconnection: true,
      });
    }

    const listeners: Array<[string, (d: unknown) => void]> = Object.entries(events).map(([ev, fn]) => {
      socket!.on(ev, fn);
      return [ev, fn];
    });

    return () => {
      listeners.forEach(([ev, fn]) => socket?.off(ev, fn));
    };
  }, [tenant?.id]);
}
