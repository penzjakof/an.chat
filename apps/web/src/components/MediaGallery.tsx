'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api';

export interface PhotoTag {
  code: string;
  description: string;
}

export interface PhotoUrls {
  urlOriginal: string;
  urlPreview: string;
  urlStandard: string;
}

export interface PhotoStatus {
  code: string;
  description: string;
}

export interface Photo {
  idPhoto: number;
  idUser: number;
  status: PhotoStatus;
  tags: PhotoTag[];
  declineReasons: string[];
  comment: string;
  urls: PhotoUrls;
  canDisagree: boolean;
}

export interface GalleryResponse {
  cursor: string;
  photos: Photo[];
}

interface MediaGalleryProps {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelect: (photos: Photo[]) => void;
  maxSelection?: number;
  context?: 'chat' | 'profile' | 'other'; // Контекст відкриття галереї
  idRegularUser?: number; // ID користувача для відправки фото в чат
}

export function MediaGallery({ 
  profileId, 
  isOpen, 
  onClose, 
  onPhotoSelect, 
  maxSelection = 6,
  context = 'other',
  idRegularUser
}: MediaGalleryProps) {
  // Валідація props
  if (!profileId || isNaN(parseInt(profileId))) {
    throw new Error('MediaGallery: profileId must be a valid number string');
  }
  
  if (context === 'chat' && !idRegularUser) {
    console.warn('MediaGallery: idRegularUser is required when context is "chat"');
  }
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'approved' | 'temporary'>('approved');
  const [photoType, setPhotoType] = useState<'available' | 'special'>('available');
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);

  // Синхронізуємо ref з state
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Завантаження фото
  const loadPhotos = useCallback(async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;

    setLoading(true);
    setError(null);

    try {
      const currentCursor = reset ? '' : cursor;

      
      // Галерея не потребує JWT токенів - вона працює через TalkyTimes API
      
      const response = await apiGet(`/api/gallery/${profileId}/photos`, {
        cursor: currentCursor,
        limit: '50',
        statuses: activeTab === 'approved' ? 'approved,approved_by_ai' : 'temporary'
      });



      if (response.success) {
        const galleryData = response.data as GalleryResponse;
        
        if (reset) {
          setPhotos(galleryData.photos);
          // При reset завжди встановлюємо hasMore базуючись на кількості отриманих фото
          setHasMore(galleryData.photos.length === 50);
        } else {
          // Додаємо тільки нові фото, уникаючи дублікатів
          setPhotos(prev => {
            const existingIds = new Set(prev.map(p => p.idPhoto));
            const newPhotos = galleryData.photos.filter(p => !existingIds.has(p.idPhoto));
            
            // Якщо немає нових фото або отримали менше 50, то більше фото немає
            const hasMorePhotos = galleryData.photos.length === 50 && newPhotos.length > 0;
            setHasMore(hasMorePhotos);
            

            
            return [...prev, ...newPhotos];
          });
        }
        
        setCursor(galleryData.cursor);
      } else {
        setError('Помилка завантаження фото');
      }
    } catch (err) {
      console.error('❌ Error loading photos:', err);
      if (err instanceof Error && err.message === 'Unauthorized') {
        setError('Помилка автентифікації. Будь ласка, увійдіть знову.');
      } else {
        setError('Помилка завантаження фото');
      }
    } finally {
      setLoading(false);
    }
  }, [profileId, cursor, hasMore, loading, activeTab]);

  // Мемоізована функція для перевірки special тегів
  const isSpecialPhoto = useCallback((photo: Photo) => {
    return photo.tags?.some(tag => tag.code === 'special' || tag.code === 'special_plus') ?? false;
  }, []);

  // Фільтрація фото за типом
  const filteredPhotos = useMemo(() => {
    if (context !== 'chat') {
      return photos;
    }

    if (photoType === 'special') {
      return photos.filter(isSpecialPhoto);
    } else {
      return photos.filter(photo => !isSpecialPhoto(photo));
    }
  }, [photos, photoType, context, isSpecialPhoto]);

  // Перевіряємо чи потрібно довантажити фото для поточного розділу
  const checkAndLoadMorePhotos = useCallback(async (maxAttempts = 3) => {
    // Тільки в контексті чату
    if (context !== 'chat' || loading || !hasMore || maxAttempts <= 0) {
      return;
    }

    const currentSectionPhotos = filteredPhotos;
    const minPhotosThreshold = 15;

    // Якщо в поточному розділі менше 15 фото і є ще фото для завантаження
    if (currentSectionPhotos.length < minPhotosThreshold && hasMore) {

      
      const prevPhotosCount = currentSectionPhotos.length;
      await loadPhotos(false);
      
      // Перевіряємо чи є ще фото після завантаження
      setTimeout(() => {
        // Якщо hasMore стало false, зупиняємо
        if (!hasMoreRef.current) {
          return;
        }
        
        // Продовжуємо рекурсивно
        checkAndLoadMorePhotos(maxAttempts - 1);
      }, 1000);
    }
  }, [context, photoType, filteredPhotos, loading, hasMore, loadPhotos]);

  // Завантажуємо фото при відкритті галереї або зміні табу
  useEffect(() => {
    if (isOpen) {
      setPhotos([]);
      setCursor('');
      setHasMore(true);
      setSelectedPhotos([]);
      setError(null);
      loadPhotos(true);
    } else {
      // Очищуємо стан при закритті
      setError(null);
      setLoading(false);
    }
  }, [isOpen, activeTab]);

  // Перевіряємо чи потрібно довантажити фото після завантаження або зміни розділу
  useEffect(() => {
    if (isOpen && photos.length > 0) {
      // Невелика затримка щоб дати час фільтрації спрацювати
      setTimeout(() => {
        checkAndLoadMorePhotos();
      }, 100);
    }
  }, [isOpen, photos, photoType, checkAndLoadMorePhotos]);

  // Перевіряємо чи потрібно довантажити фото при зміні розділу
  useEffect(() => {
    if (isOpen && context === 'chat' && photos.length > 0) {
      // Затримка щоб дати час фільтрації оновитися
      const timer = setTimeout(() => {
        const currentSectionPhotos = filteredPhotos;
        if (currentSectionPhotos.length < 15 && hasMore && !loading) {
          checkAndLoadMorePhotos();
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [photoType, isOpen, context, photos, filteredPhotos, hasMore, loading, checkAndLoadMorePhotos]);

  // Обробник скролу для завантаження більше фото (з debounce)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Завантажуємо більше фото коли доскролили до 80%
    if (scrollPercentage > 0.8) {
      // Debounce - запобігаємо занадто частим викликам
      clearTimeout((window as any).scrollTimeout);
      (window as any).scrollTimeout = setTimeout(() => {
        loadPhotos(false);
      }, 200);
    }
  }, [loading, hasMore, loadPhotos]);

  // Додаємо обробник скролу
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      // Очищуємо timeout при unmount
      clearTimeout((window as any).scrollTimeout);
    };
  }, [handleScroll]);

  // Обробка вибору фото
  const handlePhotoSelect = (photo: Photo) => {
    // Перевіряємо чи можна вибрати це фото
    if (!isPhotoSelectable(photo)) {
      return; // Не дозволяємо вибір
    }

    setSelectedPhotos(prev => {
      const isSelected = prev.some(p => p.idPhoto === photo.idPhoto);
      
      if (isSelected) {
        // Видаляємо фото з вибраних
        return prev.filter(p => p.idPhoto !== photo.idPhoto);
      } else {
        // Додаємо фото до вибраних (з обмеженням)
        if (prev.length >= maxSelection) {
          return prev;
        }
        return [...prev, photo];
      }
    });
  };

  // Відправка вибраних фото
  const handleSendPhotos = async () => {
    if (selectedPhotos.length === 0) return;

    // Якщо є idRegularUser, відправляємо через API
    if (idRegularUser && context === 'chat') {
      setLoading(true);
      try {
        const response = await apiPost('/api/gallery/send-photos', {
          idsGalleryPhotos: selectedPhotos.map(p => p.idPhoto),
          idRegularUser,
          profileId: parseInt(profileId)
        });

        if (response.success) {
          onClose();
          setSelectedPhotos([]);
        } else {
          setError('Помилка відправки фото');
        }
      } catch (error) {
        setError('Помилка відправки фото');
      } finally {
        setLoading(false);
      }
    } else {
      // Старий спосіб - через callback
      onPhotoSelect(selectedPhotos);
      onClose();
    }
  };

  // Мемоізований Set для швидкої перевірки вибраних фото
  const selectedPhotoIds = useMemo(() => {
    return new Set(selectedPhotos.map(p => p.idPhoto));
  }, [selectedPhotos]);

  // Перевірка чи фото вибране
  const isPhotoSelected = useCallback((photo: Photo) => {
    return selectedPhotoIds.has(photo.idPhoto);
  }, [selectedPhotoIds]);

  // Перевірка чи фото можна вибрати
  const isPhotoSelectable = useCallback((photo: Photo) => {
    if (context === 'chat') {
      return !isSpecialPhoto(photo);
    }
    return true;
  }, [context, isSpecialPhoto]);



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">📸</span>
            </div>
            <h2 className="text-lg font-semibold">Send media files to Jay</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'approved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Photo
          </button>
          <button
            onClick={() => setActiveTab('temporary')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'temporary'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Video
          </button>
          <button className="px-6 py-3 font-medium text-gray-500">
            Audio
          </button>
          <div className="ml-auto px-6 py-3">
            <button className="text-blue-600 hover:text-blue-700 text-sm">
              Manage Media ↗
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Photos Grid */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-4">
              {/* Photo type tabs - only in chat context */}
              {context === 'chat' ? (
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setPhotoType('available')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      photoType === 'available'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Доступні
                  </button>
                  <button
                    onClick={() => setPhotoType('special')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                      photoType === 'special'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
                    </svg>
                    <span>Special</span>
                  </button>
                </div>
              ) : (
                <h3 className="font-medium">All photos</h3>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Drag & drop or</span>
                <button className="text-blue-600 hover:text-blue-700 flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload photo</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Photos Grid */}
            <div 
              ref={scrollContainerRef}
              className="grid grid-cols-5 gap-2 max-h-[400px] overflow-y-auto"
            >
              {filteredPhotos.map((photo) => {
                const isSpecial = isSpecialPhoto(photo);
                const isSelectable = isPhotoSelectable(photo);
                const shouldBeGrayed = context === 'chat' && isSpecial;
                
                return (
                  <div
                    key={photo.idPhoto}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      !isSelectable
                        ? 'cursor-not-allowed border-gray-300'
                        : isPhotoSelected(photo)
                        ? 'cursor-pointer border-blue-500 ring-2 ring-blue-200'
                        : 'cursor-pointer border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handlePhotoSelect(photo)}
                  >
                    <img
                      src={photo.urls.urlPreview}
                      alt={`Photo ${photo.idPhoto}`}
                      className={`w-full h-full object-cover ${shouldBeGrayed ? 'grayscale opacity-60' : ''}`}
                      loading="lazy"
                    />
                    
                    {/* Special photo indicator */}
                    {isSpecial && (
                      <div className="absolute top-1 left-1 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
                        </svg>
                      </div>
                    )}

                    {/* Selection indicator */}
                    {isPhotoSelected(photo) && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading indicator */}
              {loading && (
                <div className="col-span-5 flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>



            {/* Empty state for available photos */}
            {context === 'chat' && photoType === 'available' && filteredPhotos.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium mb-2">Немає доступних фото</p>
                <p className="text-sm text-center">Всі фото в цьому профілі мають спеціальний статус.<br/>Перейдіть до розділу "Special" щоб їх переглянути.</p>
              </div>
            )}

            {/* Selection info */}
            <div className="mt-4 text-sm text-gray-500">
              Up to {maxSelection} photos can be sent in one message
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedPhotos.length} of {maxSelection} selected
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSendPhotos}
              disabled={selectedPhotos.length === 0 || loading}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                selectedPhotos.length > 0 && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{loading ? 'Sending...' : 'Send →'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
