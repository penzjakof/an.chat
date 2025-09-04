"use client";

import React, { createContext, useContext, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/session';

interface WebSocketPoolContextType {
  getSocketForProfile: (profileId: string) => Socket | null;
  joinDialog: (profileId: string, dialogId: string) => void;
  leaveDialog: (profileId: string, dialogId: string) => void;
  disconnectProfile: (profileId: string) => void;
  disconnectAll: () => void;
}

const WebSocketPoolContext = createContext<WebSocketPoolContextType | null>(null);

export function WebSocketPoolProvider({ children }: { children: React.ReactNode }) {
  // Pool сокетів: ключ = profileId, значення = Socket
  const socketPool = useRef<Map<string, Socket>>(new Map());
  // Активні діалоги для кожного профілю
  const activeDialogs = useRef<Map<string, string>>(new Map());
  // Таймери для cleanup
  const cleanupTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const createSocketForProfile = useCallback((profileId: string): Socket | null => {
    // Перевіряємо чи вже існує сокет для цього профілю
    const existingSocket = socketPool.current.get(profileId);
    if (existingSocket) {
      console.log(`🔌 Socket already exists for profile ${profileId}, reusing`);
      return existingSocket;
    }

    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    if (!token) {
      console.warn(`🔌 No token available for profile ${profileId}`);
      return null;
    }


    
    const socket = io(`${apiUrl}`, {
      transports: ['websocket'],
      auth: { token, profileId }, // Передаємо profileId в auth
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      // WebSocket підключено для профілю ${profileId}
      
      // Якщо був активний діалог, перепідключаємося
      const activeDialog = activeDialogs.current.get(profileId);
      if (activeDialog) {
        socket.emit('join', { dialogId: activeDialog });
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`🔌 WebSocket disconnected for profile ${profileId}:`, reason);
    });

    socket.on('connect_error', (error: Error) => {
      console.warn(`🔌 WebSocket connection error for profile ${profileId}:`, error.message);
    });

    // Зберігаємо в pool
    socketPool.current.set(profileId, socket);
    
    return socket;
  }, []);

  const getSocketForProfile = useCallback((profileId: string): Socket | null => {
    // Скасовуємо cleanup якщо він був запланований
    const cleanupTimer = cleanupTimers.current.get(profileId);
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimers.current.delete(profileId);
    }

    let socket = socketPool.current.get(profileId);
    
    // Якщо сокета немає, створюємо новий
    if (!socket) {
      socket = createSocketForProfile(profileId);
    }
    // Якщо сокет є але відключений, перепідключаємося
    else if (!socket.connected && !socket.connecting) {
      socket.connect();
    }
    
    return socket;
  }, [createSocketForProfile]);

  const joinDialog = useCallback((profileId: string, dialogId: string) => {
    const socket = getSocketForProfile(profileId);
    if (!socket) return;

    // Виходимо з попереднього діалогу якщо був
    const previousDialog = activeDialogs.current.get(profileId);
    if (previousDialog && previousDialog !== dialogId) {
      socket.emit('leave', { dialogId: previousDialog });
    }

    // Підключаємося до нового діалогу
    socket.emit('join', { dialogId });
    activeDialogs.current.set(profileId, dialogId);
    

  }, [getSocketForProfile]);

  const leaveDialog = useCallback((profileId: string, dialogId: string) => {
    const socket = socketPool.current.get(profileId);
    if (!socket) return;

    socket.emit('leave', { dialogId });
    activeDialogs.current.delete(profileId);
    


    // Запускаємо таймер для cleanup сокета через 30 секунд неактивності
    const cleanupTimer = setTimeout(() => {
      disconnectProfile(profileId);
    }, 30000);
    
    cleanupTimers.current.set(profileId, cleanupTimer);
  }, []);

  const disconnectProfile = useCallback((profileId: string) => {
    const socket = socketPool.current.get(profileId);
    if (socket) {
      socket.disconnect();
      socketPool.current.delete(profileId);
      activeDialogs.current.delete(profileId);
      
      const cleanupTimer = cleanupTimers.current.get(profileId);
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimers.current.delete(profileId);
      }
      
      console.log(`🔌 Disconnected profile ${profileId}`);
    }
  }, []);

  const disconnectAll = useCallback(() => {
    console.log('🔌 Disconnecting all WebSocket connections');
    
    // Очищуємо всі таймери
    cleanupTimers.current.forEach(timer => clearTimeout(timer));
    cleanupTimers.current.clear();
    
    // Відключаємо всі сокети
    socketPool.current.forEach((socket, profileId) => {
      socket.disconnect();
      console.log(`🔌 Disconnected profile ${profileId}`);
    });
    
    socketPool.current.clear();
    activeDialogs.current.clear();
  }, []);

  // Cleanup при unmount
  React.useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, [disconnectAll]);

  const contextValue: WebSocketPoolContextType = {
    getSocketForProfile,
    joinDialog,
    leaveDialog,
    disconnectProfile,
    disconnectAll
  };

  return (
    <WebSocketPoolContext.Provider value={contextValue}>
      {children}
    </WebSocketPoolContext.Provider>
  );
}

export function useWebSocketPool() {
  const context = useContext(WebSocketPoolContext);
  if (!context) {
    throw new Error('useWebSocketPool must be used within a WebSocketPoolProvider');
  }
  return context;
}
