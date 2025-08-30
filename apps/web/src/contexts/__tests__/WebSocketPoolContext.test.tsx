import React from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { WebSocketPoolProvider, useWebSocketPool } from '../WebSocketPoolContext';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');
const mockIo = io as jest.MockedFunction<typeof io>;

// Mock socket instance
const mockSocket = {
  connected: false,
  connecting: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  close: jest.fn(),
};

describe('WebSocketPoolContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIo.mockReturnValue(mockSocket as any);
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WebSocketPoolProvider>{children}</WebSocketPoolProvider>
  );

  describe('Socket Creation and Management', () => {
    it('should create socket for profile', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        const socket = result.current.getSocketForProfile('7162437');
        expect(socket).toBeTruthy();
      });

      expect(mockIo).toHaveBeenCalledWith('http://localhost:4000/ws', {
        transports: ['websocket'],
        auth: { token: 'mock-token', profileId: '7162437' },
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
    });

    it('should reuse existing socket for same profile', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        const socket1 = result.current.getSocketForProfile('7162437');
        const socket2 = result.current.getSocketForProfile('7162437');
        expect(socket1).toBe(socket2);
      });

      // Socket.io повинен бути викликаний тільки один раз
      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it('should reconnect disconnected socket', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        const socket = result.current.getSocketForProfile('7162437');
        // Симулюємо відключення
        mockSocket.connected = false;
        mockSocket.connecting = false;
        
        // Отримуємо сокет знову
        result.current.getSocketForProfile('7162437');
      });

      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  describe('Dialog Management', () => {
    it('should join dialog correctly', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        result.current.joinDialog('7162437', '7162437-123456');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', { dialogId: '7162437-123456' });
    });

    it('should leave dialog correctly', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        result.current.joinDialog('7162437', '7162437-123456');
        result.current.leaveDialog('7162437', '7162437-123456');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('leave', { dialogId: '7162437-123456' });
    });

    it('should handle socket cleanup after leaving dialog', () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        result.current.joinDialog('7162437', '7162437-123456');
        result.current.leaveDialog('7162437', '7162437-123456');
        
        // Симулюємо проходження 30 секунд
        jest.advanceTimersByTime(30000);
      });

      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing token gracefully', () => {
      // Mock відсутності токена
      (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        const socket = result.current.getSocketForProfile('7162437');
        expect(socket).toBeNull();
      });

      expect(mockIo).not.toHaveBeenCalled();
    });

    it('should handle socket connection errors', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        result.current.getSocketForProfile('7162437');
        
        // Симулюємо помилку підключення
        const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
        if (errorHandler) {
          errorHandler(new Error('Connection failed'));
        }
      });

      // Перевіряємо що помилка оброблена без краху
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });
  });

  describe('Multiple Profiles', () => {
    it('should manage multiple profile sockets independently', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        const socket1 = result.current.getSocketForProfile('7162437');
        const socket2 = result.current.getSocketForProfile('117326723');
        
        expect(socket1).not.toBe(socket2);
      });

      expect(mockIo).toHaveBeenCalledTimes(2);
      expect(mockIo).toHaveBeenNthCalledWith(1, 'http://localhost:4000/ws', expect.objectContaining({
        auth: { token: 'mock-token', profileId: '7162437' }
      }));
      expect(mockIo).toHaveBeenNthCalledWith(2, 'http://localhost:4000/ws', expect.objectContaining({
        auth: { token: 'mock-token', profileId: '117326723' }
      }));
    });

    it('should handle dialog switching between profiles', () => {
      const { result } = renderHook(() => useWebSocketPool(), { wrapper });

      act(() => {
        // Підключаємося до діалогу з профілем 1
        result.current.joinDialog('7162437', '7162437-123456');
        
        // Переключаємося на діалог з профілем 2
        result.current.joinDialog('117326723', '117326723-789012');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', { dialogId: '7162437-123456' });
      expect(mockSocket.emit).toHaveBeenCalledWith('join', { dialogId: '117326723-789012' });
    });
  });
});
