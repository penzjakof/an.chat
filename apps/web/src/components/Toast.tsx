"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface ToastData {
  id: string;
  type: 'new_message' | 'success' | 'error' | 'info';
  // Загальні поля
  title?: string;
  message?: string;
  dialogId?: string; // Для навігації при кліку
  // Поля для типу new_message
  messageId?: number;
  idUserFrom?: number;
  idUserTo?: number;
  dateCreated?: string;
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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
    // Якщо є dialogId, перевіряємо чи ми вже на цій сторінці
    if (toast.dialogId) {
      const targetPath = `/chats/${toast.dialogId}`;
      const currentPath = pathname;
      
      if (currentPath === targetPath) {
        console.log('🔗 Toast clicked: already on target page', toast.dialogId, '- just closing toast');
      } else {
        console.log('🔗 Toast clicked: navigating to dialog', toast.dialogId);
        router.push(targetPath);
      }
    }
    
    // Закриваємо toast
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  // Відмінні стилі для різних типів
  const bgByType: Record<NonNullable<ToastData['type']>, { bg: string; border: string; icon: string; label: string }> = {
    new_message: { bg: '#1e40af', border: '#1d4ed8', icon: '💬', label: 'Нове повідомлення' },
    success: { bg: '#065f46', border: '#059669', icon: '✅', label: 'Успіх' },
    error: { bg: '#7f1d1d', border: '#dc2626', icon: '❌', label: 'Помилка' },
    info: { bg: '#1f2937', border: '#374151', icon: 'ℹ️', label: 'Інфо' },
  };
  const colors = bgByType[toast.type];

  return (
    <div
      className={`
        fixed top-4 right-4 z-[9999] max-w-sm w-full rounded-lg shadow-2xl border-2
        transform transition-all duration-300 ease-in-out cursor-pointer
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      style={{ 
        zIndex: 9999,
        backgroundColor: colors.bg,
        borderColor: colors.border,
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
              backgroundColor: colors.border, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <span style={{ fontSize: '14px' }}>{colors.icon}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {toast.type === 'new_message' ? (
              <>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', margin: 0, lineHeight: '1.4' }}>
                  {colors.icon} {colors.label}!
                </p>
                <p style={{ color: '#e0e7ff', fontSize: '14px', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                  Від користувача {toast.idUserFrom}
                </p>
                <p style={{ color: '#c7d2fe', fontSize: '12px', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                  {toast.dateCreated ? new Date(toast.dateCreated).toLocaleTimeString() : ''}
                  {toast.dialogId && (pathname === `/chats/${toast.dialogId}` ? ' • Натисніть щоб закрити' : ' • Натисніть щоб відкрити')}
                </p>
              </>
            ) : (
              <>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', margin: 0, lineHeight: '1.4' }}>
                  {colors.icon} {toast.title || colors.label}
                </p>
                {toast.message && (
                  <p style={{ color: '#e5e7eb', fontSize: '13px', margin: '6px 0 0 0', lineHeight: '1.5' }}>
                    {toast.message}
                  </p>
                )}
              </>
            )}
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
