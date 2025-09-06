import { useEffect, useCallback, useState } from 'react';
import { useWebSocketPool } from '@/contexts/WebSocketPoolContext';
import { useToast } from '@/contexts/ToastContext';
import { Socket } from 'socket.io-client';

// Дедублікація тостів на фронтенді (ключ -> timestamp)
const processedToasts = new Map<string, number>();
const TOAST_DEDUP_TTL_MS = 30_000;

interface UseDialogWebSocketOptions {
  profileId: string;
  dialogId: string;
  onMessage?: (message: any) => void;
  onUserOnlineStatus?: (data: { userId: number; isOnline: boolean }) => void;
  onDialogLimitChanged?: (data: { idUser: number; idInterlocutor: number; limitLeft: number }) => void;
}

export function useDialogWebSocket({
  profileId,
  dialogId,
  onMessage,
  onUserOnlineStatus,
  onDialogLimitChanged
}: UseDialogWebSocketOptions) {
  const { getSocketForProfile, joinDialog, leaveDialog } = useWebSocketPool();
  const { showToast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Підключення до діалогу з debounce
  useEffect(() => {
    if (!profileId || !dialogId) return;


    
    // Додаємо невелику затримку щоб уникнути спаму при React StrictMode
    const connectTimer = setTimeout(() => {
      joinDialog(profileId, dialogId);
    }, 50);

    return () => {
      clearTimeout(connectTimer);
  
      leaveDialog(profileId, dialogId);
    };
  }, [profileId, dialogId, joinDialog, leaveDialog]);

  // Отримуємо сокет один раз і зберігаємо в стейті
  useEffect(() => {
    if (!profileId) return;

    const currentSocket = getSocketForProfile(profileId);
    setSocket(currentSocket);
  }, [profileId, getSocketForProfile]);

  // Підписка на події
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (payload: any) => {
      onMessage?.(payload);
    };

    const handleUserOnlineStatus = (data: { userId: number; isOnline: boolean }) => {
      onUserOnlineStatus?.(data);
    };

    const handleDialogLimitChanged = (data: { idUser: number; idInterlocutor: number; limitLeft: number }) => {
      onDialogLimitChanged?.(data);
    };

    const handleMessageToast = (data: any) => {
      // Показуємо toast тільки якщо повідомлення не від нас
      if (data.idUserFrom?.toString?.() === profileId) return;

      // Ключ для дедублікації (покриває і email, і message)
      const toastType = data.type || 'new_message';
      const idPart = data.messageId || data.emailId || data.id || data.dialogId || '';
      const timePart = data.dateCreated || '';
      const key = `${toastType}:${idPart}:${timePart}`;

      const now = Date.now();
      // Очистка старих записів
      for (const [k, ts] of processedToasts) {
        if (now - ts > TOAST_DEDUP_TTL_MS) processedToasts.delete(k);
      }
      const last = processedToasts.get(key);
      if (last && now - last <= TOAST_DEDUP_TTL_MS) {
        // дубль — ігноруємо
        return;
      }
      processedToasts.set(key, now);

      showToast({
        messageId: data.messageId,
        idUserFrom: data.idUserFrom,
        idUserTo: data.idUserTo,
        dateCreated: data.dateCreated,
        type: toastType === 'new_email' ? 'new_email' : 'new_message',
        dialogId: data.dialogId
      });
    };

    // Підписуємося на події
    socket.on('message', handleMessage);
    socket.on('user_online_status', handleUserOnlineStatus);
    socket.on('message_toast', handleMessageToast);
    socket.on('dialog_limit_changed', handleDialogLimitChanged);

    return () => {
      // Відписуємося від подій
      socket.off('message', handleMessage);
      socket.off('user_online_status', handleUserOnlineStatus);
      socket.off('message_toast', handleMessageToast);
      socket.off('dialog_limit_changed', handleDialogLimitChanged);
    };
  }, [socket, onMessage, onUserOnlineStatus]);

  return {
    socket,
    isConnected: socket?.connected || false
  };
}
