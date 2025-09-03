import { useEffect, useCallback, useState } from 'react';
import { useWebSocketPool } from '@/contexts/WebSocketPoolContext';
import { useToast } from '@/contexts/ToastContext';
import { Socket } from 'socket.io-client';

interface UseDialogWebSocketOptions {
  profileId: string;
  dialogId: string;
  onMessage?: (message: any) => void;
  onUserOnlineStatus?: (data: { userId: number; isOnline: boolean }) => void;
}

export function useDialogWebSocket({
  profileId,
  dialogId,
  onMessage,
  onUserOnlineStatus
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

    const handleMessageToast = (data: any) => {
      // Показуємо toast тільки якщо повідомлення не від нас
      if (data.idUserFrom.toString() !== profileId) {
        console.log('🍞 Showing toast for message:', data);
        showToast({
          messageId: data.messageId,
          idUserFrom: data.idUserFrom,
          idUserTo: data.idUserTo,
          dateCreated: data.dateCreated,
          type: 'new_message',
          dialogId: data.dialogId // Передаємо dialogId для навігації
        });
      }
    };

    // Підписуємося на події
    socket.on('message', handleMessage);
    socket.on('user_online_status', handleUserOnlineStatus);
    socket.on('message_toast', handleMessageToast);

    return () => {
      // Відписуємося від подій
      socket.off('message', handleMessage);
      socket.off('user_online_status', handleUserOnlineStatus);
      socket.off('message_toast', handleMessageToast);
    };
  }, [socket, onMessage, onUserOnlineStatus]);

  return {
    socket,
    isConnected: socket?.connected || false
  };
}
