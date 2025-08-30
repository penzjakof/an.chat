"use client";

import { useEffect, useState } from 'react';

export interface ToastData {
  id: string;
  messageId: number;
  idUserFrom: number;
  idUserTo: number;
  dateCreated: string;
  type: 'new_message';
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Показуємо toast з анімацією
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    // Автоматично закриваємо через 5 секунд
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300); // Чекаємо завершення анімації
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [toast.id, onClose]);

  const handleClick = () => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-[9999] max-w-sm w-full rounded-lg shadow-2xl border-2
        transform transition-all duration-300 ease-in-out cursor-pointer
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      style={{ 
        zIndex: 9999,
        backgroundColor: '#1e40af',
        borderColor: '#1d4ed8',
        color: 'white',
        minHeight: '80px',
        width: '320px',
        padding: '16px'
      }}
      onClick={handleClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, marginRight: '12px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              backgroundColor: '#3b82f6', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', margin: 0, lineHeight: '1.4' }}>
              🍞 Нове повідомлення RTM!
            </p>
            <p style={{ color: '#e0e7ff', fontSize: '14px', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              Від користувача {toast.idUserFrom}
            </p>
            <p style={{ color: '#c7d2fe', fontSize: '12px', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              {new Date(toast.dateCreated).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            style={{ color: '#e0e7ff', marginLeft: '8px' }}
            className="flex-shrink-0 hover:opacity-80"
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemoveToast: (id: string) => void;
}

export function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${index * 80}px)` }}
          className="transition-transform duration-300"
        >
          <Toast toast={toast} onClose={onRemoveToast} />
        </div>
      ))}
    </div>
  );
}
