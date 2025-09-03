"use client";

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { apiPost } from '@/lib/api';

interface EmailAttachment {
  id: string;
  url_thumbnail: string;
  url_original: string;
  is_paid?: boolean;
  display_attributes?: any[];
}

interface EmailMessage {
  id: string;
  id_user_from: string;
  id_user_to: string;
  title?: string;
  content: string;
  date_created: string;
  status?: string;
  attachments?: {
    images?: EmailAttachment[];
  };
  is_paid?: boolean;
}

interface EmailHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  clientId: string;
  correspondenceId: string;
}

// Мемоізований компонент для прикріплень
const EmailAttachments = React.memo(({ 
  images, 
  isFromProfile, 
  onImageClick 
}: { 
  images: EmailAttachment[], 
  isFromProfile: boolean, 
  onImageClick: (url: string, alt: string) => void 
}) => (
  <div className={isFromProfile ? 'border-t pt-3 border-blue-400' : 'border-t pt-3 border-gray-200'}>
    <h4 className={isFromProfile ? 'text-sm font-medium mb-2 text-white' : 'text-sm font-medium mb-2 text-gray-900'}>📎 Вкладення:</h4>
    <div className="flex flex-wrap gap-2">
      {images.map((image) => {
        const thumbnailUrl = image.url_thumbnail || image.url_original;
        const originalUrl = image.url_original || image.url_thumbnail;
        
        return (
          <div key={image.id} className="relative inline-block w-20 h-20 border border-gray-200 rounded overflow-hidden">
            <img
              src={thumbnailUrl}
              alt={`Attachment ${image.id}`}
              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              style={{ display: 'block' }}
              onClick={() => onImageClick(originalUrl, `Attachment ${image.id}`)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.onerror = null;
              }}
            />
            {image.is_paid && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
));

export default function EmailHistory({ isOpen, onClose, profileId, clientId, correspondenceId }: EmailHistoryProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fullSizeImage, setFullSizeImage] = useState<{ url: string; alt: string } | null>(null);
  const [previousEmailCount, setPreviousEmailCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // 🎯 useRef для page - вирішує проблему stale closure
  const pageRef = useRef(1);

  // Завантаження листів
  const loadEmails = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (loading || !correspondenceId) return;

    setLoading(true);
    try {
      const response = await apiPost('/api/tt/emails-history', {
        page: pageNum,
        limit: 10,
        id_correspondence: correspondenceId,
        id_interlocutor: clientId,
        id_user: profileId,
        without_translation: false
      });

      if ((response as any).success && (response as any).data?.data?.history) {
        const newEmails = (response as any).data.data.history.sort((a: EmailMessage, b: EmailMessage) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        );

        if (append) {
          // Фільтруємо дублікати перед додаванням
          setEmails(prev => {
            const existingIds = new Set(prev.map((email: EmailMessage) => email.id));
            const uniqueNewEmails = newEmails.filter((email: EmailMessage) => !existingIds.has(email.id));
            const duplicatesCount = newEmails.length - uniqueNewEmails.length;
            if (duplicatesCount > 0) {
              console.log(`📧 EmailHistory: Відфільтровано ${duplicatesCount} дублікатів`);
            }
            return [...uniqueNewEmails, ...prev];
          });
          // Оновлюємо лічильник тільки для унікальних листів
          setPreviousEmailCount(prevCount => {
            const existingIds = new Set(emails.map((email: EmailMessage) => email.id));
            const uniqueCount = newEmails.filter((email: EmailMessage) => !existingIds.has(email.id)).length;
            return prevCount + uniqueCount;
          });
        } else {
          setEmails(newEmails);
          setPreviousEmailCount(0);
          setIsInitialLoad(true);
        }

        setHasMore(newEmails.length === 10);
        // 🎯 Оновлюємо і pageRef, і state одночасно
        pageRef.current = pageNum;
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Помилка завантаження листів:', error);
    } finally {
      setLoading(false);
    }
  }, [correspondenceId, clientId, profileId]); // Прибрали loading з залежностей

  // Завантаження старіших листів
  const loadOlderEmails = useCallback(async () => {
    if (loadingTop || !hasMore || loading) return;

    setLoadingTop(true);
    try {
      // 🔥 Використовуємо pageRef.current для отримання актуального значення
      const currentPage = pageRef.current;
      const nextPage = currentPage + 1;
      
      console.log(`📧 EmailHistory: Завантажуємо сторінку ${nextPage} (поточна: ${currentPage})`);
      const response = await apiPost('/api/tt/emails-history', {
        page: nextPage,
        limit: 10,
        id_correspondence: correspondenceId,
        id_interlocutor: clientId,
        id_user: profileId,
        without_translation: false
      });

      if ((response as any).success && (response as any).data?.data?.history) {
        const olderEmails = (response as any).data.data.history.sort((a: EmailMessage, b: EmailMessage) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        );

        if (olderEmails.length > 0) {
          // Фільтруємо дублікати перед додаванням
          setEmails(prev => {
            const existingIds = new Set(prev.map((email: EmailMessage) => email.id));
            const uniqueOlderEmails = olderEmails.filter((email: EmailMessage) => !existingIds.has(email.id));
            const duplicatesCount = olderEmails.length - uniqueOlderEmails.length;
            if (duplicatesCount > 0) {
              console.log(`📧 EmailHistory: Відфільтровано ${duplicatesCount} дублікатів при пагінації`);
            }
            return [...uniqueOlderEmails, ...prev];
          });
          // Оновлюємо лічильник тільки для унікальних листів
          setPreviousEmailCount(prevCount => {
            const existingIds = new Set(emails.map((email: EmailMessage) => email.id));
            const uniqueCount = olderEmails.filter((email: EmailMessage) => !existingIds.has(email.id)).length;
            return prevCount + uniqueCount;
          });
          // 🎯 Оновлюємо і pageRef, і state одночасно
          pageRef.current = nextPage;
          setPage(nextPage);
          setHasMore(olderEmails.length === 10);
          
          console.log(`✅ EmailHistory: Успішно завантажено сторінку ${nextPage}`);
        } else {
          setHasMore(false);
          console.log(`📧 EmailHistory: Більше листів немає`);
        }
      }
    } catch (error) {
      console.error('Помилка завантаження старіших листів:', error);
    } finally {
      setLoadingTop(false);
    }
  }, [correspondenceId, clientId, profileId]); // 🎯 Прибрали page - використовуємо pageRef

  // Обробка скролу
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    
    if (scrollTop === 0 && hasMore && !loadingTop && !loading) {
      loadOlderEmails();
    }
  }, []); // Прибрали всі залежності, функція використовує поточні значення стану

  // Корекція позиції скролу після завантаження старіших листів
  useLayoutEffect(() => {
    if (previousEmailCount > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const emailElements = container.querySelectorAll('[data-email-id]');
      
      if (emailElements.length > previousEmailCount) {
        const targetElement = emailElements[previousEmailCount] as HTMLElement;
        if (targetElement) {
          container.scrollTop = targetElement.offsetTop - 100;
        }
      }
      
      setPreviousEmailCount(0);
    }
  }, [emails, previousEmailCount]);

  // Завантаження при відкритті
  useEffect(() => {
    if (isOpen && correspondenceId) {
      setEmails([]);
      setPage(1);
      setHasMore(true);
      setPreviousEmailCount(0);
      setIsInitialLoad(true);
      loadEmails(1, false);
    }
  }, [isOpen, correspondenceId]);

  // Скрол до низу тільки при першому завантаженні
  useEffect(() => {
    if (emails.length > 0 && messagesContainerRef.current && isInitialLoad) {
      const container = messagesContainerRef.current;
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        setIsInitialLoad(false); // Позначаємо що перше завантаження завершено
      }, 100);
    }
  }, [emails, isInitialLoad]);

  // Закриття модалу по Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (fullSizeImage) {
          setFullSizeImage(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, fullSizeImage, onClose]);

  // Форматування дати
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <React.Fragment>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">📧 Історія листування</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={handleScroll}
          >
            {/* Індикатор завантаження вгорі */}
            {loadingTop && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Завантаження старіших листів...</span>
              </div>
            )}

            {emails.length === 0 && !loading ? (
              <div className="text-center text-gray-500 py-8">
                📭 Немає листів в цій кореспонденції
              </div>
            ) : (
              <div className="space-y-4 px-4">
                {emails.map((email) => {
                  const isFromProfile = email.id_user_from === profileId;
                  return (
                    <div key={email.id} data-email-id={email.id} className={isFromProfile ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={isFromProfile
                        ? 'max-w-[80%] p-4 shadow-sm bg-blue-500 text-white rounded-l-lg rounded-tr-lg'
                        : 'max-w-[80%] p-4 shadow-sm bg-gray-100 text-gray-900 rounded-r-lg rounded-tl-lg'
                      }>
                        {/* Email Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className={isFromProfile ? 'font-medium mb-1 text-white' : 'font-medium mb-1 text-gray-900'}>
                              {email.title || 'Без теми'}
                            </h3>
                            <div className={isFromProfile ? 'flex items-center space-x-4 text-sm text-blue-100' : 'flex items-center space-x-4 text-sm text-gray-600'}>
                              <span>Від: {email.id_user_from}</span>
                              <span>До: {email.id_user_to}</span>
                              <span>{formatDate(email.date_created)}</span>
                              {email.is_paid && (
                                <span className={isFromProfile ? 'px-2 py-1 rounded text-xs bg-blue-600 text-blue-100' : 'px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800'}>
                                  💰 Платний
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={email.status === 'read'
                              ? (isFromProfile ? 'px-2 py-1 rounded text-xs bg-blue-600 text-blue-100' : 'px-2 py-1 rounded text-xs bg-green-100 text-green-800')
                              : (isFromProfile ? 'px-2 py-1 rounded text-xs bg-blue-600 text-blue-100' : 'px-2 py-1 rounded text-xs bg-blue-100 text-blue-800')
                            }>
                              {email.status === 'read' ? 'Прочитано' : 'Непрочитано'}
                            </span>
                          </div>
                        </div>

                        {/* Email Content */}
                        <div
                          className={isFromProfile ? 'mb-3 prose prose-sm max-w-none prose-invert' : 'mb-3 prose prose-sm max-w-none text-gray-800'}
                          dangerouslySetInnerHTML={{ __html: email.content }}
                        />

                        {/* Attachments */}
                        {email.attachments?.images && email.attachments.images.length > 0 && (
                          <EmailAttachments
                            images={email.attachments.images}
                            isFromProfile={isFromProfile}
                            onImageClick={(url, alt) => setFullSizeImage({ url, alt })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-gray-600">Завантаження...</span>
              </div>
            )}

            {/* Повідомлення про кінець списку */}
            {!loadingTop && !hasMore && emails.length > 10 && (
              <div className="text-center py-4">
                <span className="text-gray-500 text-sm">📄 Більше листів немає</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Повноекранний модал для зображень */}
      {fullSizeImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setFullSizeImage(null)}>
          <div className="relative max-w-full max-h-full p-4">
            <img 
              src={fullSizeImage.url} 
              alt={fullSizeImage.alt}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setFullSizeImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}