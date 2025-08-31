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

export interface PhotoConnectionStatus {
  idPhoto: number;
  status: 'accessed' | 'sent' | null;
}

interface CachedPhotoData {
  idPhoto: number;
  idProfile: number;
  idUser: number;
  urlPreview: string;
  urlOriginal: string;
  status: 'accessed' | 'sent' | null;
  category: 'regular' | 'special' | 'temporary';
  lastAccessed: number; // timestamp коли останній раз використовувалось
  tags: PhotoTag[]; // для визначення категорії
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
  const [regularCursor, setRegularCursor] = useState('');
  const [temporaryCursor, setTemporaryCursor] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const [photoType, setPhotoType] = useState<'regular' | 'special' | 'temporary'>('regular');
  const [activeTab, setActiveTab] = useState<'regular' | 'special' | 'temporary'>('regular');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'audio'>('photo');
  const [fullSizePhoto, setFullSizePhoto] = useState<Photo | null>(null);
  const [photoStatuses, setPhotoStatuses] = useState<Map<number, 'accessed' | 'sent' | null>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'accessed' | 'sent'>('all');
  const [statusRequestedPhotos, setStatusRequestedPhotos] = useState<Set<number>>(new Set()); // Відстеження запитів статусів
  const [temporaryPhotoIds, setTemporaryPhotoIds] = useState<Set<number>>(new Set()); // Відстеження temporary фото
  const [autoLoadAttempts, setAutoLoadAttempts] = useState(0); // Лічильник спроб автозавантаження

  // Кеш функції
  const UNIFIED_PHOTO_CACHE_KEY = `gallery_unified_photos_${profileId}`;
  const FILTER_CACHE_KEY = `gallery_filters_${profileId}`;
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 години

  // Функції для роботи з єдиним кешем фото
  const loadUnifiedPhotoCache = useCallback((): Map<number, CachedPhotoData> => {
    try {
      const cachedData = localStorage.getItem(UNIFIED_PHOTO_CACHE_KEY);
      if (!cachedData) return new Map();

      const parsedData = JSON.parse(cachedData) as Record<string, CachedPhotoData>;
      const now = Date.now();
      const validData = new Map<number, CachedPhotoData>();

      // Фільтруємо застарілі дані та оновлюємо lastAccessed
      Object.entries(parsedData).forEach(([idPhoto, photoData]) => {
        const age = now - photoData.lastAccessed;
        if (age <= CACHE_DURATION) {
          // Оновлюємо lastAccessed при завантаженні (використанні)
          validData.set(parseInt(idPhoto), {
            ...photoData,
            lastAccessed: now
          });
        }
      });

      console.log('📦 Loaded from unified cache:', validData.size, 'photos');
      return validData;
    } catch (error) {
      console.warn('Failed to load unified photo cache:', error);
      return new Map();
    }
  }, [UNIFIED_PHOTO_CACHE_KEY, CACHE_DURATION]);

  const saveUnifiedPhotoCache = useCallback((cacheMap: Map<number, CachedPhotoData>) => {
    try {
      // Конвертуємо Map в об'єкт для збереження
      const cacheObject = Object.fromEntries(cacheMap);
      localStorage.setItem(UNIFIED_PHOTO_CACHE_KEY, JSON.stringify(cacheObject));
      console.log('📦 Unified cache saved:', cacheMap.size, 'photos');
    } catch (error) {
      console.warn('Failed to save unified photo cache:', error);
    }
  }, [UNIFIED_PHOTO_CACHE_KEY]);

  // Мемоізована функція для перевірки special тегів
  const isSpecialPhoto = useCallback((photo: Photo) => {
    return photo.tags?.some(tag => tag.code === 'special' || tag.code === 'special_plus') ?? false;
  }, []);

  const addPhotosToUnifiedCache = useCallback((photos: Photo[], isTemporary: boolean = false) => {
    try {
      const cacheMap = loadUnifiedPhotoCache();
      const now = Date.now();
      let newCount = 0;

      photos.forEach(photo => {
        if (!cacheMap.has(photo.idPhoto)) {
          // Визначаємо категорію фото
          let category: 'regular' | 'special' | 'temporary' = 'regular';
          if (isTemporary) {
            category = 'temporary';
          } else if (isSpecialPhoto(photo)) {
            category = 'special';
          }

          cacheMap.set(photo.idPhoto, {
            idPhoto: photo.idPhoto,
            idProfile: parseInt(profileId),
            idUser: photo.idUser,
            urlPreview: photo.urls.urlPreview,
            urlOriginal: photo.urls.urlOriginal,
            status: null, // Буде оновлено пізніше
            category,
            lastAccessed: now,
            tags: photo.tags
          });
          newCount++;
        } else {
          // Оновлюємо lastAccessed для існуючих фото
          const existing = cacheMap.get(photo.idPhoto)!;
          cacheMap.set(photo.idPhoto, {
            ...existing,
            lastAccessed: now
          });
        }
      });

      if (newCount > 0) {
        saveUnifiedPhotoCache(cacheMap);
        console.log('📦 Added to unified cache:', newCount, 'new photos, total:', cacheMap.size);
      }

      return cacheMap;
    } catch (error) {
      console.warn('Failed to add photos to unified cache:', error);
      return loadUnifiedPhotoCache();
    }
  }, [loadUnifiedPhotoCache, saveUnifiedPhotoCache, profileId, isSpecialPhoto]);

  const updatePhotoStatusesInCache = useCallback((statuses: Map<number, 'accessed' | 'sent' | null>) => {
    try {
      const cacheMap = loadUnifiedPhotoCache();
      const now = Date.now();
      let updatedCount = 0;

      statuses.forEach((status, idPhoto) => {
        if (cacheMap.has(idPhoto)) {
          const existing = cacheMap.get(idPhoto)!;
          cacheMap.set(idPhoto, {
            ...existing,
            status,
            lastAccessed: now // Оновлюємо час при оновленні статусу
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        saveUnifiedPhotoCache(cacheMap);
        console.log('📦 Updated statuses in unified cache:', updatedCount, 'photos');
      }

      return cacheMap;
    } catch (error) {
      console.warn('Failed to update photo statuses in unified cache:', error);
      return loadUnifiedPhotoCache();
    }
  }, [loadUnifiedPhotoCache, saveUnifiedPhotoCache]);

  const convertCacheToPhotos = useCallback((cacheMap: Map<number, CachedPhotoData>): Photo[] => {
    return Array.from(cacheMap.values()).map(cached => ({
      idPhoto: cached.idPhoto,
      idUser: cached.idUser,
      urls: {
        urlPreview: cached.urlPreview,
        urlOriginal: cached.urlOriginal,
        urlStandard: cached.urlPreview // Використовуємо preview як standard
      },
      tags: cached.tags,
      comment: '', // Не зберігаємо в кеші
      canDisagree: false, // Не зберігаємо в кеші
      status: { code: '', description: '' }, // Додаємо поле status
      declineReasons: [] // Додаємо поле declineReasons
    })).sort((a, b) => b.idPhoto - a.idPhoto);
  }, []);





  // Синхронізуємо activeTab з photoType
  useEffect(() => {
    setPhotoType(activeTab);
    // Скидаємо лічильник спроб при зміні розділу
    setAutoLoadAttempts(0);
  }, [activeTab]);

  // Скидаємо лічильник спроб при зміні фільтра статусів
  useEffect(() => {
    setAutoLoadAttempts(0);
  }, [statusFilter]);

  // Завантажуємо фільтри з кешу при відкритті галереї
  useEffect(() => {
    if (isOpen) {
      try {
        const cachedFilters = localStorage.getItem(`gallery_filters_${profileId}`);
        if (cachedFilters) {
          const filters = JSON.parse(cachedFilters);
          console.log('💾 Loading filters from cache:', filters);
          
          // Встановлюємо фільтри
          if (filters.photoType) {
            setPhotoType(filters.photoType);
            setActiveTab(filters.photoType);
          }
          if (filters.statusFilter) {
            console.log('💾 Setting statusFilter from cache:', filters.statusFilter);
            setStatusFilter(filters.statusFilter);
          }
        }
      } catch (error) {
        console.warn('Failed to load filters from cache:', error);
      }
    }
  }, [isOpen]);

  // Зберігаємо фільтри в кеш при зміні
  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        try {
          const filtersToSave = { photoType, statusFilter };
          localStorage.setItem(`gallery_filters_${profileId}`, JSON.stringify(filtersToSave));
          console.log('💾 Filters saved to cache:', filtersToSave);
        } catch (error) {
          console.warn('Failed to save filters to cache:', error);
        }
      }, 200); // Затримка щоб уникнути збереження під час завантаження

      return () => clearTimeout(timeoutId);
    }
  }, [photoType, statusFilter, isOpen]);

  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const regularCursorRef = useRef(regularCursor);
  const temporaryCursorRef = useRef(temporaryCursor);
  const loadPhotosRef = useRef<((reset?: boolean) => Promise<void>) | null>(null);

  // Синхронізуємо ref з state
  useEffect(() => {
    hasMoreRef.current = hasMore;
    regularCursorRef.current = regularCursor;
    temporaryCursorRef.current = temporaryCursor;
  }, [hasMore, regularCursor, temporaryCursor]);

  // Мемоізована функція для перевірки temporary фото
  const isTemporaryPhoto = useCallback((photo: Photo) => {
    // Temporary фото - це ті що прийшли з запиту isTemporary=true
    return temporaryPhotoIds.has(photo.idPhoto);
  }, [temporaryPhotoIds]);

  // Завантаження статусів фото з відстеженням (батчами по 100)
  const loadPhotoStatuses = useCallback(async (photos: Photo[], idUser: number) => {
    if (photos.length === 0) return;

    // Фільтруємо тільки ті фото, для яких ще не запитували статуси
    const photosToRequest = photos.filter(photo => !statusRequestedPhotos.has(photo.idPhoto));
    
    if (photosToRequest.length === 0) {
      console.log('📊 All photo statuses already requested');
      return;
    }

    console.log(`📊 Requesting statuses for ${photosToRequest.length} photos (${photos.length} total, ${photos.length - photosToRequest.length} already requested)`);

    // Розбиваємо на батчі по 100 фото
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < photosToRequest.length; i += batchSize) {
      batches.push(photosToRequest.slice(i, i + batchSize));
    }

    console.log(`📊 Processing ${batches.length} batches of photo statuses`);

    // Обробляємо кожен батч
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📊 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} photos`);

      try {
        const idsPhotos = batch.map(p => p.idPhoto);
        
        // Відмічаємо що для цих фото запит відправлено
        setStatusRequestedPhotos(prev => {
          const newSet = new Set(prev);
          idsPhotos.forEach(id => newSet.add(id));
          return newSet;
        });

        const response = await apiPost('/api/gallery/photo-statuses', {
          idUser,
          idsPhotos,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; data?: { photos: PhotoConnectionStatus[] }; error?: string };
        if (typedResponse.success && typedResponse.data?.photos) {
          console.log(`📊 Batch ${batchIndex + 1}: Received statuses for ${typedResponse.data.photos.length} photos`);
          setPhotoStatuses(prev => {
            const newStatusMap = new Map(prev);
            typedResponse.data!.photos.forEach((photoStatus: PhotoConnectionStatus) => {
              newStatusMap.set(photoStatus.idPhoto, photoStatus.status);
            });
            
            // Зберігаємо оновлені статуси в єдиний кеш
            updatePhotoStatusesInCache(newStatusMap);
            
            return newStatusMap;
          });
        } else {
          console.error(`❌ Batch ${batchIndex + 1}: Failed to load photo statuses:`, typedResponse.error);
          
          // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
          setStatusRequestedPhotos(prev => {
            const newSet = new Set(prev);
            batch.forEach(photo => newSet.delete(photo.idPhoto));
            return newSet;
          });
        }
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1}: Error loading photo statuses:`, error);
        
        // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
        setStatusRequestedPhotos(prev => {
          const newSet = new Set(prev);
          batch.forEach(photo => newSet.delete(photo.idPhoto));
          return newSet;
        });
      }

      // Невелика затримка між батчами щоб не перевантажити API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [profileId, statusRequestedPhotos]);

  // Перевірка та завантаження пропущених статусів
  const ensureAllStatusesLoaded = useCallback(async () => {
    if (!idRegularUser || context !== 'chat' || photos.length === 0) return;

    // Знаходимо фото без статусів
    const photosWithoutStatuses = photos.filter(photo => 
      !photoStatuses.has(photo.idPhoto) && !statusRequestedPhotos.has(photo.idPhoto)
    );

    if (photosWithoutStatuses.length > 0) {
      console.log(`🔍 Found ${photosWithoutStatuses.length} photos without statuses, requesting...`);
      await loadPhotoStatuses(photosWithoutStatuses, idRegularUser);
    }
  }, [photos, photoStatuses, statusRequestedPhotos, idRegularUser, context, loadPhotoStatuses]);

  // Періодична перевірка пропущених статусів
  useEffect(() => {
    if (isOpen && photos.length > 0 && context === 'chat') {
      const timeoutId = setTimeout(() => {
        ensureAllStatusesLoaded();
      }, 2000); // Перевіряємо через 2 секунди після завантаження фото

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, photos.length, context, ensureAllStatusesLoaded]);

  // Завантаження перших 500 фото з показом одразу
  const loadInitialPhotos = useCallback(async () => {
    if (loading) return;

    // Спробуємо завантажити з єдиного кешу для швидкого показу
    const cacheMap = loadUnifiedPhotoCache();
    if (cacheMap.size > 0) {
      const cachedPhotos = convertCacheToPhotos(cacheMap);
      console.log('📦 Showing cached photos first:', cachedPhotos.length);
      setPhotos(cachedPhotos);
      
      // Визначаємо temporary фото з кешу
      const tempIds = new Set<number>();
      const statusMap = new Map<number, 'accessed' | 'sent' | null>();
      
      cacheMap.forEach((cached, idPhoto) => {
        if (cached.category === 'temporary') {
          tempIds.add(idPhoto);
        }
        if (cached.status) {
          statusMap.set(idPhoto, cached.status);
        }
      });
      
      setTemporaryPhotoIds(tempIds);
      setPhotoStatuses(statusMap);
      
      // Завантажуємо свіжі статуси для видимих фото (завжди для актуальності)
      if (idRegularUser && context === 'chat') {
        await loadPhotoStatuses(cachedPhotos, idRegularUser);
      }
    }

    setLoading(true);
    setError(null);

    try {
      let allPhotos: Photo[] = [];
      let regularCursor = '';
      let temporaryCursor = '';
      let hasMoreRegular = true;
      let hasMoreTemporary = true;
      let isFirstBatch = true;
      const maxInitialPhotos = 500; // Обмеження на початкове завантаження

      // Завантажуємо фото поетапно до 500 штук
      while ((hasMoreRegular || hasMoreTemporary) && allPhotos.length < maxInitialPhotos) {
        const requests = [];
        
        // Додаємо запит для звичайних фото якщо є ще дані
        if (hasMoreRegular) {
          requests.push(
            apiGet(`/api/gallery/${profileId}/photos`, {
              cursor: regularCursor,
              limit: '100',
              statuses: 'approved,approved_by_ai'
            })
          );
        }
        
        // Додаємо запит для temporary фото якщо є ще дані
        if (hasMoreTemporary) {
          console.log('📸 Requesting temporary photos with cursor:', temporaryCursor);
          requests.push(
            apiGet(`/api/gallery/${profileId}/photos`, {
              cursor: temporaryCursor,
              limit: '100',
              isTemporary: 'true'
            })
          );
        }

        const responses = await Promise.all(requests);
        let regularResponse = null;
        let temporaryResponse = null;

        // Розподіляємо відповіді
        if (hasMoreRegular && hasMoreTemporary) {
          [regularResponse, temporaryResponse] = responses;
        } else if (hasMoreRegular) {
          [regularResponse] = responses;
        } else if (hasMoreTemporary) {
          [temporaryResponse] = responses;
        }

        let newPhotos: Photo[] = [];

        // Обробляємо відповіді
        const typedRegularResponse = regularResponse as { success: boolean; data?: GalleryResponse; error?: string };
        if (regularResponse && typedRegularResponse.success) {
          const regularData = typedRegularResponse.data as GalleryResponse;
          console.log('📸 Regular photos batch:', regularData.photos.length);
          newPhotos.push(...regularData.photos);
          regularCursor = regularData.cursor;
          hasMoreRegular = regularData.photos.length >= 100;
        } else if (regularResponse) {
          hasMoreRegular = false;
        }

        const typedTemporaryResponse = temporaryResponse as { success: boolean; data?: GalleryResponse; error?: string };
        if (temporaryResponse && typedTemporaryResponse.success) {
          const temporaryData = typedTemporaryResponse.data as GalleryResponse;
          console.log('📸 Temporary photos batch:', temporaryData.photos.length, temporaryData.photos.map(p => p.idPhoto));
          newPhotos.push(...temporaryData.photos);
          
          // Відмічаємо ці фото як temporary
          setTemporaryPhotoIds(prev => {
            const newSet = new Set(prev);
            temporaryData.photos.forEach(photo => newSet.add(photo.idPhoto));
            return newSet;
          });
          
          temporaryCursor = temporaryData.cursor;
          hasMoreTemporary = temporaryData.photos.length >= 100;
        } else if (temporaryResponse) {
          hasMoreTemporary = false;
        }

        // Додаємо нові фото до загального списку з дедуплікацією
        const existingIds = new Set(allPhotos.map(p => p.idPhoto));
        const trulyNewPhotos = newPhotos.filter(photo => !existingIds.has(photo.idPhoto));
        allPhotos.push(...trulyNewPhotos);
        
        // Сортуємо і показуємо фото одразу після кожного батчу
        const sortedPhotos = allPhotos.sort((a, b) => b.idPhoto - a.idPhoto);
        setPhotos(sortedPhotos);
        
        // Зберігаємо фото в єдиний кеш
        if (trulyNewPhotos.length > 0) {
          // Розділяємо на regular та temporary фото
          const regularPhotos = trulyNewPhotos.filter(photo => !temporaryPhotoIds.has(photo.idPhoto));
          const tempPhotos = trulyNewPhotos.filter(photo => temporaryPhotoIds.has(photo.idPhoto));
          
          if (regularPhotos.length > 0) {
            addPhotosToUnifiedCache(regularPhotos, false);
          }
          if (tempPhotos.length > 0) {
            addPhotosToUnifiedCache(tempPhotos, true);
          }
        }

        console.log('📸 Current total photos:', sortedPhotos.length);

        // Після першого батчу - прибираємо loading і завантажуємо статуси
        if (isFirstBatch) {
          setLoading(false); // Показуємо фото одразу
          isFirstBatch = false;

          // Асинхронно завантажуємо статуси для поточних фото
          if (idRegularUser && context === 'chat' && sortedPhotos.length > 0) {
            loadPhotoStatuses(sortedPhotos, idRegularUser);
          }
        } else {
          // Для наступних батчів - завантажуємо статуси тільки для дійсно нових фото
          if (idRegularUser && context === 'chat' && trulyNewPhotos.length > 0) {
            loadPhotoStatuses(trulyNewPhotos, idRegularUser);
          }
        }
      }

      // Фінальне оновлення після початкового завантаження
      const stillHasMore = (hasMoreRegular || hasMoreTemporary) && allPhotos.length >= maxInitialPhotos;
      setHasMore(stillHasMore);
      
      // Зберігаємо курсори для подальшого завантаження
      setRegularCursor(regularCursor);
      setTemporaryCursor(temporaryCursor);
      
      console.log('📸 Initial photos loaded:', allPhotos.length);
      console.log('📸 Has more photos:', stillHasMore);
      
      // Логування розподілу фото по типах
      const specialCount = allPhotos.filter(photo => isSpecialPhoto(photo)).length;
      const temporaryCount = allPhotos.filter(photo => isTemporaryPhoto(photo)).length;
      const regularCount = allPhotos.filter(photo => !isSpecialPhoto(photo) && !isTemporaryPhoto(photo)).length;
      
      console.log('📸 Temporary photo IDs:', Array.from(temporaryPhotoIds));
      
      console.log('📊 Initial photo distribution:', {
        total: allPhotos.length,
        regular: regularCount,
        special: specialCount,
        temporary: temporaryCount,
        hasMore: stillHasMore
      });

    } catch (err) {
      console.error('❌ Error loading initial photos:', err);
      setError('Помилка завантаження фото');
      setLoading(false);
    }
  }, [profileId, loading, context, idRegularUser, isSpecialPhoto, isTemporaryPhoto, loadPhotoStatuses]);

  // Завантаження додаткових фото при скролі
  const loadMorePhotos = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    console.log('📸 Loading more photos via scroll...');

    try {
      const requests = [];
      let hasMoreRegular = !!regularCursor;
      let hasMoreTemporary = !!temporaryCursor;
      
      // Додаємо запити тільки якщо є курсори
      if (hasMoreRegular) {
        requests.push(
          apiGet(`/api/gallery/${profileId}/photos`, {
            cursor: regularCursor,
            limit: '100',
            statuses: 'approved,approved_by_ai'
          })
        );
      }
      
      if (hasMoreTemporary) {
        requests.push(
          apiGet(`/api/gallery/${profileId}/photos`, {
            cursor: temporaryCursor,
            limit: '100',
            isTemporary: 'true'
          })
        );
      }

      if (requests.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const responses = await Promise.all(requests);
      let regularResponse = null;
      let temporaryResponse = null;

      // Розподіляємо відповіді
      if (hasMoreRegular && hasMoreTemporary) {
        [regularResponse, temporaryResponse] = responses;
      } else if (hasMoreRegular) {
        [regularResponse] = responses;
      } else if (hasMoreTemporary) {
        [temporaryResponse] = responses;
      }

      let newPhotos: Photo[] = [];
      let newRegularCursor = regularCursor;
      let newTemporaryCursor = temporaryCursor;

      // Обробляємо відповіді
      const typedRegularResponse = regularResponse as { success: boolean; data?: GalleryResponse; error?: string };
      if (regularResponse && typedRegularResponse.success) {
        const regularData = typedRegularResponse.data as GalleryResponse;
        console.log('📸 More regular photos:', regularData.photos.length);
        newPhotos.push(...regularData.photos);
        newRegularCursor = regularData.cursor;
        hasMoreRegular = regularData.photos.length >= 100;
      } else if (regularResponse) {
        hasMoreRegular = false;
        newRegularCursor = '';
      }

      const typedTemporaryResponse = temporaryResponse as { success: boolean; data?: GalleryResponse; error?: string };
      if (temporaryResponse && typedTemporaryResponse.success) {
        const temporaryData = typedTemporaryResponse.data as GalleryResponse;
        console.log('📸 More temporary photos:', temporaryData.photos.length);
        newPhotos.push(...temporaryData.photos);
        
        // Відмічаємо ці фото як temporary
        setTemporaryPhotoIds(prev => {
          const newSet = new Set(prev);
          temporaryData.photos.forEach(photo => newSet.add(photo.idPhoto));
          return newSet;
        });
        
        newTemporaryCursor = temporaryData.cursor;
        hasMoreTemporary = temporaryData.photos.length >= 100;
      } else if (temporaryResponse) {
        hasMoreTemporary = false;
        newTemporaryCursor = '';
      }

      // Додаємо нові фото з дедуплікацією
      setPhotos(prev => {
        const existingIds = new Set(prev.map(p => p.idPhoto));
        const trulyNewPhotos = newPhotos.filter(photo => !existingIds.has(photo.idPhoto));
        const updatedPhotos = [...prev, ...trulyNewPhotos].sort((a, b) => b.idPhoto - a.idPhoto);
        
        // Зберігаємо нові фото в єдиний кеш
        if (trulyNewPhotos.length > 0) {
          // Розділяємо на regular та temporary фото
          const regularPhotos = trulyNewPhotos.filter(photo => !temporaryPhotoIds.has(photo.idPhoto));
          const tempPhotos = trulyNewPhotos.filter(photo => temporaryPhotoIds.has(photo.idPhoto));
          
          if (regularPhotos.length > 0) {
            addPhotosToUnifiedCache(regularPhotos, false);
          }
          if (tempPhotos.length > 0) {
            addPhotosToUnifiedCache(tempPhotos, true);
          }
        }
        
        // Завантажуємо статуси для нових фото
        if (idRegularUser && context === 'chat' && trulyNewPhotos.length > 0) {
          loadPhotoStatuses(trulyNewPhotos, idRegularUser);
        }
        
        return updatedPhotos;
      });

      // Оновлюємо курсори та hasMore
      setRegularCursor(newRegularCursor);
      setTemporaryCursor(newTemporaryCursor);
      setHasMore(hasMoreRegular || hasMoreTemporary);

      console.log('📸 More photos loaded. HasMore:', hasMoreRegular || hasMoreTemporary);

    } catch (err) {
      console.error('❌ Error loading more photos:', err);
      setError('Помилка завантаження додаткових фото');
    } finally {
      setLoading(false);
    }
  }, [profileId, loading, hasMore, regularCursor, temporaryCursor, context, idRegularUser, loadPhotoStatuses]);

  // Зберігаємо функції в ref
  useEffect(() => {
    loadPhotosRef.current = loadMorePhotos;
  }, [loadMorePhotos]);

  // Обробник скролу для завантаження більше фото
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Завантажуємо більше фото коли доскролили до 80%
    if (scrollPercentage > 0.8) {
      console.log('🔄 Scroll threshold reached! Loading more photos...');
      loadMorePhotos();
    }
  }, [loading, hasMore, loadMorePhotos]);

  // Додаємо обробник скролу
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Автозавантаження якщо в поточному фільтрі менше 15 фото
  useEffect(() => {
    if (!isOpen || loading || !hasMore) return;

    const timeoutId = setTimeout(() => {
      // Використовуємо ту ж логіку що й у filteredPhotos для підрахунку
      let currentFilteredPhotos = photos;

      // Фільтрація за типом (тільки в чаті)
      if (context === 'chat') {
        switch (photoType) {
          case 'regular':
            currentFilteredPhotos = photos.filter(photo => !isSpecialPhoto(photo) && !isTemporaryPhoto(photo));
            break;
          case 'special':
            currentFilteredPhotos = photos.filter(photo => isSpecialPhoto(photo));
            break;
          case 'temporary':
            currentFilteredPhotos = photos.filter(photo => isTemporaryPhoto(photo) && !isSpecialPhoto(photo));
            break;
          default:
            currentFilteredPhotos = photos;
        }
      }

      // Фільтрація за статусом
      if (statusFilter !== 'all') {
        currentFilteredPhotos = currentFilteredPhotos.filter(photo => {
          const status = photoStatuses.get(photo.idPhoto);
          switch (statusFilter) {
            case 'available':
              return status === null;
            case 'accessed':
              return status === 'accessed';
            case 'sent':
              return status === 'sent';
            default:
              return true;
          }
        });
      }

      const minPhotosThreshold = 15;
      console.log('🔍 Auto-load check:', {
        photoType,
        statusFilter,
        currentFilteredCount: currentFilteredPhotos.length,
        minThreshold: minPhotosThreshold,
        hasMore,
        loading
      });

      if (currentFilteredPhotos.length < minPhotosThreshold && hasMore && !loading) {
        console.log('🚀 Auto-loading more photos - current filter has only', currentFilteredPhotos.length, 'photos');
        loadMorePhotos();
      }
    }, 1000); // Затримка щоб дати час статусам завантажитися

    return () => clearTimeout(timeoutId);
  }, [isOpen, photos.length, photoType, statusFilter, context, hasMore, loading, photoStatuses, isSpecialPhoto, isTemporaryPhoto, loadMorePhotos]);

  // Фільтрація фото за типом та статусом
  const filteredPhotos = useMemo(() => {
    let filtered = photos;

    // Фільтрація за типом (тільки в чаті)
    if (context === 'chat') {
      switch (photoType) {
        case 'regular':
          filtered = photos.filter(photo => !isSpecialPhoto(photo) && !isTemporaryPhoto(photo));
          break;
        case 'special':
          // Special фото включають як звичайні special, так і special з temporary
          filtered = photos.filter(photo => isSpecialPhoto(photo));
          break;
        case 'temporary':
          // Тимчасові фото - тільки ті що temporary але НЕ special
          filtered = photos.filter(photo => isTemporaryPhoto(photo) && !isSpecialPhoto(photo));
          break;
        default:
          filtered = photos;
      }
    }

    // Фільтрація за статусом
    if (statusFilter !== 'all') {
      filtered = filtered.filter(photo => {
        const status = photoStatuses.get(photo.idPhoto);
        switch (statusFilter) {
          case 'available':
            return status === null; // Тільки фото без статусу (не переглянуті)
          case 'accessed':
            return status === 'accessed'; // Тільки переглянуті
          case 'sent':
            return status === 'sent'; // Тільки надіслані
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [photos, photoType, statusFilter, context, isSpecialPhoto, isTemporaryPhoto, photoStatuses]);

  // Видаляємо checkAndLoadMorePhotos щоб уникнути циклічних залежностей

  // Завантажуємо фото при відкритті галереї
  useEffect(() => {
    if (isOpen) {
      setPhotos([]);
      setRegularCursor('');
      setTemporaryCursor('');
      setHasMore(true);
      setSelectedPhotos([]);
      setError(null);
      setAutoLoadAttempts(0); // Скидаємо лічильник при відкритті
      setPhotoStatuses(new Map()); // Очищуємо статуси фото

      setStatusRequestedPhotos(new Set()); // Очищуємо відстеження запитів статусів
      setTemporaryPhotoIds(new Set()); // Очищуємо відстеження temporary фото
      // Завантажуємо перші 500 фото
      loadInitialPhotos();
    } else {
      // Очищуємо стан при закритті
      setError(null);
      setLoading(false);
    }
  }, [isOpen, profileId]);



  // Цей useEffect тепер об'єднаний з попереднім, видаляємо дублікат



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

        const typedResponse = response as { success: boolean; error?: string };
        if (typedResponse.success) {
          onClose();
          setSelectedPhotos([]);
        } else {
          setError('Помилка відправки фото');
        }
      } catch {
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
      // В чаті можна вибирати доступні фото та тимчасові фото (але не special)
      return !isSpecialPhoto(photo);
    }
    return true;
  }, [context, isSpecialPhoto]);



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header with media type tabs and close button */}
        <div className="flex items-center justify-between p-3">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMediaType('photo')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mediaType === 'photo'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Фото
            </button>
            <button
              onClick={() => setMediaType('video')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mediaType === 'video'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Відео
            </button>
            <button
              onClick={() => setMediaType('audio')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mediaType === 'audio'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Аудіо
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Девайдер з індикацією завантаження */}
        <div className={`border-t-2 transition-colors duration-300 ${
          loading || (filteredPhotos.length < 15 && hasMore) 
            ? 'border-blue-500' 
            : 'border-gray-200'
        }`} style={{
          animation: loading || (filteredPhotos.length < 15 && hasMore) 
            ? 'pulse 0.8s ease-in-out infinite alternate' 
            : 'none'
        }}></div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {mediaType === 'photo' ? (
            /* Photos Grid */
            <div className="flex-1 p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              {/* Photo type tabs - only in chat context */}
              {context === 'chat' ? (
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setPhotoType('regular')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      photoType === 'regular'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Звичайні
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
                  <button
                    onClick={() => setPhotoType('temporary')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                      photoType === 'temporary'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V5z" />
                    </svg>
                    <span>Тимчасові</span>
                  </button>
                </div>
              ) : (
                <h3 className="font-medium">All photos</h3>
              )}
              
              {/* Status filters */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                    statusFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>Усі</span>
                </button>
                <button
                  onClick={() => setStatusFilter('available')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                    statusFilter === 'available'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Доступні</span>
                </button>
                <button
                  onClick={() => setStatusFilter('accessed')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                    statusFilter === 'accessed'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Переглянуті</span>
                </button>
                <button
                  onClick={() => setStatusFilter('sent')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                    statusFilter === 'sent'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Надіслані</span>
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
              className="overflow-y-auto flex-1 p-2"
            >
              <div 
                className="grid grid-cols-5 gap-2"
                style={{
                  gridAutoRows: 'minmax(0, max-content)'
                }}
              >
              {filteredPhotos.map((photo) => {
                const isSpecial = isSpecialPhoto(photo);
                const isTemporary = isTemporaryPhoto(photo);
                const isSelectable = isPhotoSelectable(photo);
                const shouldBeGrayed = context === 'chat' && isSpecial; // Тільки special фото сірі
                
                return (
                  <div
                    key={photo.idPhoto}
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
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

                    {/* Photo status indicator */}
                    {(() => {
                      const status = photoStatuses.get(photo.idPhoto);
                      if (!status) return null;
                      
                      return (
                        <div className={`absolute bottom-1 left-1 w-5 h-5 rounded-full flex items-center justify-center ${
                          status === 'accessed' 
                            ? 'bg-green-500' 
                            : status === 'sent' 
                            ? 'bg-yellow-500' 
                            : 'bg-black bg-opacity-60'
                        }`}>
                          {status === 'accessed' ? (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : status === 'sent' ? (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          ) : null}
                        </div>
                      );
                    })()}

                    {/* Full size view button - показується при ховері */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullSizePhoto(photo);
                      }}
                      className="absolute bottom-1 right-1 w-12 h-12 bg-black bg-opacity-60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-80"
                      title="Переглянути в повному розмірі"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                );
              })}



              {/* No more photos message */}
              {!loading && !hasMore && filteredPhotos.length > 0 && (
                <div className="col-span-5 flex flex-col items-center py-6 text-gray-500">
                  <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium mb-1">Це всі фото</p>
                  <p className="text-xs text-gray-400">Більше фото поки що немає</p>
                </div>
              )}
              </div>
            </div>



            {/* Empty state for different sections */}
            {context === 'chat' && filteredPhotos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                {/* Показуємо "Шукаємо" поки завантажуємо або є ще фото */}
                {(loading || hasMore) ? (
                  <>
                    <svg className="w-12 h-12 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-lg font-medium mb-2">Шукаємо фото...</p>
                    <p className="text-sm text-center">Завантажуємо фото з сервера</p>
                  </>
                ) : (
                  <>
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {photoType === 'regular' && (
                  <>
                    <p className="text-lg font-medium mb-2">Немає звичайних фото</p>
                    <p className="text-sm text-center">Всі фото в цьому профілі мають спеціальний статус.<br/>Перейдіть до розділу "Special" або "Тимчасові" щоб їх переглянути.</p>
                  </>
                )}
                {photoType === 'special' && (
                  <>
                    <p className="text-lg font-medium mb-2">Немає особливих фото</p>
                    <p className="text-sm text-center">В цьому профілі немає фото з тегами "special".</p>
                  </>
                )}
                {photoType === 'temporary' && (
                  <>
                    <p className="text-lg font-medium mb-2">Немає тимчасових фото</p>
                    <p className="text-sm text-center">В цьому профілі немає тимчасових фото.</p>
                  </>
                )}
                  </>
                )}
              </div>
            )}


          </div>
          ) : mediaType === 'video' ? (
            /* Video Grid */
            <div className="flex-1 p-3 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium mb-2">Відео поки недоступні</p>
                <p className="text-sm text-center">Функціональність відео буде додана пізніше</p>
              </div>
            </div>
          ) : (
            /* Audio Grid */
            <div className="flex-1 p-3 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-lg font-medium mb-2">Аудіо поки недоступні</p>
                <p className="text-sm text-center">Функціональність аудіо буде додана пізніше</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - only show for photos */}
        {mediaType === 'photo' && (
          <div className="border-t p-3 flex items-center justify-between">
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
        )}
      </div>

      {/* Full size photo modal */}
      {fullSizePhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
          onClick={() => setFullSizePhoto(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <img
              src={fullSizePhoto.urls.urlOriginal}
              alt={`Photo ${fullSizePhoto.idPhoto}`}
              className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
              onClick={() => setFullSizePhoto(null)}
              onError={(e) => {
                // Fallback to standard size if original fails
                const target = e.target as HTMLImageElement;
                target.src = fullSizePhoto.urls.urlStandard;
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFullSizePhoto(null);
              }}
              className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-white hover:bg-opacity-80 transition-all"
              title="Закрити"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
