'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { AudioPlayer } from './AudioPlayer';

export interface PhotoTag {
  code: string;
  description: string;
}

export interface PhotoUrls {
  urlOriginal: string;
  urlPreview: string;
  urlStandard: string;
}

export interface VideoUrls {
  urlMp4Hd: string;
  urlMp4Sd: string;
  urlThumbnail: string;
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

export interface Video {
  idVideo: number;
  idUser: number;
  status: PhotoStatus;
  tags: PhotoTag[];
  declineReasons: string[];
  comment: string;
  urls: VideoUrls;
  duration: number;
}

export interface PhotoConnectionStatus {
  idPhoto: number;
  status: 'accessed' | 'sent' | null;
}

export interface VideoConnectionStatus {
  idVideo: number;
  status: 'accessed' | 'sent' | null;
}

export interface AudioUrls {
  mp3: string;
  ogg: string;
}

export interface Audio {
  id: number;
  idUser: number;
  status: string;
  title: string;
  duration: number;
  dateCreated: string;
  dateUpdated: string;
  declineReasons: string[];
  urls: AudioUrls;
}

export interface AudioGalleryResponse {
  cursor: string;
  items: Audio[];
}

export interface AudioConnectionStatus {
  idAudio: number;
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

export interface VideoGalleryResponse {
  cursor: string;
  videos: Video[];
}

interface MediaGalleryProps {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelect: (photos: Photo[]) => void;
  maxSelection?: number;
  context?: 'chat' | 'profile' | 'other'; // Контекст відкриття галереї
  idRegularUser?: number; // ID користувача для відправки фото в чат
  // Розширення для режиму прикріплення (без відправки на бек)
  mode?: 'send' | 'attach';
  actionLabel?: string; // Текст на кнопці дії
  allowAudio?: boolean; // Прикріплення не показує аудіо
  allowedPhotoTabs?: Array<'regular' | 'special' | 'special_plus' | 'temporary'>; // Які вкладки фото показувати
  isSpecialPlusAllowed?: boolean; // Керування доступом до special_plus
  onAttach?: (payload: { photos: Photo[]; videos: Video[] }) => void; // Колбек для режиму attach
}

export function MediaGallery({ 
  profileId, 
  isOpen, 
  onClose, 
  onPhotoSelect, 
  maxSelection = 6,
  context = 'other',
  idRegularUser,
  mode = 'send',
  actionLabel,
  allowAudio = true,
  allowedPhotoTabs,
  isSpecialPlusAllowed = true,
  onAttach
}: MediaGalleryProps) {
  // Валідація props
  if (!profileId || isNaN(parseInt(profileId))) {
    throw new Error('MediaGallery: profileId must be a valid number string');
  }
  
  if (context === 'chat' && !idRegularUser) {
    console.warn('MediaGallery: idRegularUser is required when context is "chat"');
  }
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [selectedAudios, setSelectedAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(false);
  const [regularCursor, setRegularCursor] = useState('');
  const [temporaryCursor, setTemporaryCursor] = useState('');
  const [videoCursor, setVideoCursor] = useState('');
  const [audioCursor, setAudioCursor] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [hasMoreAudios, setHasMoreAudios] = useState(true);

  const [photoType, setPhotoType] = useState<'regular' | 'special' | 'special_plus' | 'temporary'>(mode === 'attach' ? 'special' : 'regular');
  const [activeTab, setActiveTab] = useState<'regular' | 'special' | 'special_plus' | 'temporary'>(mode === 'attach' ? 'special' : 'regular');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'audio'>('photo');
  
  const [fullSizePhoto, setFullSizePhoto] = useState<Photo | null>(null);
  const [fullSizeVideo, setFullSizeVideo] = useState<Video | null>(null);
  const [photoStatuses, setPhotoStatuses] = useState<Map<number, 'accessed' | 'sent' | null>>(new Map());
  const [videoStatuses, setVideoStatuses] = useState<Map<number, 'accessed' | 'sent' | null>>(new Map());
  const [audioStatuses, setAudioStatuses] = useState<Map<number, 'accessed' | 'sent' | null>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'accessed' | 'sent'>('all');
  const [statusRequestedPhotos, setStatusRequestedPhotos] = useState<Set<number>>(new Set()); // Відстеження запитів статусів
  const [statusRequestedVideos, setStatusRequestedVideos] = useState<Set<number>>(new Set()); // Відстеження запитів статусів відео
  const [statusRequestedAudios, setStatusRequestedAudios] = useState<Set<number>>(new Set()); // Відстеження запитів статусів аудіо
  const [temporaryPhotoIds, setTemporaryPhotoIds] = useState<Set<number>>(new Set()); // Відстеження temporary фото
  
  // Стан для аудіо плеєра
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<Audio | null>(null);
  const audioPlayersRef = useRef<Map<number, HTMLAudioElement>>(new Map());
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

      // Повністю відключаємо логування завантаження кешу
      // if (process.env.NODE_ENV === 'development' && validData.size > 0) {
      //   console.log('📦 Loaded from unified cache:', validData.size, 'photos');
      // }
      return validData;
    } catch (error) {
      console.warn('Failed to load unified photo cache:', error);
      return new Map();
    }
  }, [UNIFIED_PHOTO_CACHE_KEY, CACHE_DURATION]);

  // Debounced save function для зменшення частоти збереження
  const debouncedSave = useRef<NodeJS.Timeout | null>(null);
  
  const saveUnifiedPhotoCache = useCallback((cacheMap: Map<number, CachedPhotoData>) => {
    // Скасовуємо попередній таймер
    if (debouncedSave.current) {
      clearTimeout(debouncedSave.current);
    }
    
    // Встановлюємо новий таймер на 500мс
    debouncedSave.current = setTimeout(() => {
      try {
        // Конвертуємо Map в об'єкт для збереження
        const cacheObject = Object.fromEntries(cacheMap);
        localStorage.setItem(UNIFIED_PHOTO_CACHE_KEY, JSON.stringify(cacheObject));
        // Повністю відключаємо логування збереження кешу
        // if (process.env.NODE_ENV === 'development' && cacheMap.size > 1000) {
        //   console.log('📦 Unified cache saved:', cacheMap.size, 'photos');
        // }
      } catch (error) {
        console.warn('Failed to save unified photo cache:', error);
      }
    }, 500);
  }, [UNIFIED_PHOTO_CACHE_KEY]);

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 MediaGallery unmounting, cleaning up resources...');
      
      // Очищуємо debounced save
      if (debouncedSave.current) {
        clearTimeout(debouncedSave.current);
        debouncedSave.current = null;
      }
    };
  }, []);

  // Мемоізована функція для перевірки special тегів
  const hasTag = useCallback((photo: Photo, code: string) => photo.tags?.some(tag => tag.code === code) ?? false, []);
  const isSpecialPhoto = useCallback((photo: Photo) => hasTag(photo, 'special') || hasTag(photo, 'special_plus'), [hasTag]);
  const isSpecialPlusPhoto = useCallback((photo: Photo) => hasTag(photo, 'special_plus'), [hasTag]);
  const isSpecialExactPhoto = useCallback((photo: Photo) => hasTag(photo, 'special') && !hasTag(photo, 'special_plus'), [hasTag]);

  // Мемоізована функція для перевірки temporary фото
  const isTemporaryPhoto = useCallback((photo: Photo) => {
    // Temporary фото - це ті що прийшли з запиту isTemporary=true
    return temporaryPhotoIds.has(photo.idPhoto);
  }, [temporaryPhotoIds]);

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

  // Мемоізований кеш для зменшення операцій завантаження
  const [cachedPhotoMap, setCachedPhotoMap] = useState<Map<number, CachedPhotoData> | null>(null);
  
  const getCachedPhotoMap = useCallback(() => {
    if (!cachedPhotoMap) {
      const loaded = loadUnifiedPhotoCache();
      setCachedPhotoMap(loaded);
      return loaded;
    }
    return cachedPhotoMap;
  }, [cachedPhotoMap, loadUnifiedPhotoCache]);

  const updatePhotoStatusesInCache = useCallback((statuses: Map<number, 'accessed' | 'sent' | null>) => {
    try {
      const cacheMap = getCachedPhotoMap(); // Використовуємо мемоізований кеш
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
        setCachedPhotoMap(new Map(cacheMap)); // Оновлюємо мемоізований стейт
        saveUnifiedPhotoCache(cacheMap); // Debounced збереження
      }

      return cacheMap;
    } catch (error) {
      console.warn('Failed to update photo statuses in unified cache:', error);
      return getCachedPhotoMap();
    }
  }, [getCachedPhotoMap, saveUnifiedPhotoCache, setCachedPhotoMap]);

  // Централізована логіка фільтрації фото
  const filterPhotosByTypeAndStatus = useCallback((
    photos: Photo[], 
    photoType: 'regular' | 'special' | 'special_plus' | 'temporary', 
    statusFilter: 'all' | 'available' | 'accessed' | 'sent',
    context: string
  ): Photo[] => {
    let filtered = photos;

    // Фільтрація за типом (тільки в чаті)
    if (context === 'chat') {
      switch (photoType) {
        case 'regular':
          filtered = photos.filter(photo => !isSpecialPhoto(photo) && !isTemporaryPhoto(photo));
          break;
        case 'special':
          // Лише точні special (без special_plus)
          filtered = photos.filter(photo => isSpecialExactPhoto(photo));
          break;
        case 'special_plus':
          filtered = photos.filter(photo => isSpecialPlusPhoto(photo));
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
            return status === null || typeof status === 'undefined';
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
  }, [isSpecialPhoto, isTemporaryPhoto, photoStatuses]);

  // Функція фільтрації відео за статусом
  const filterVideosByStatus = useCallback((
    videos: Video[], 
    statusFilter: 'all' | 'available' | 'accessed' | 'sent'
  ): Video[] => {
    // Фільтрація за статусом
    if (statusFilter !== 'all') {
      return videos.filter(video => {
        const status = videoStatuses.get(video.idVideo);
        switch (statusFilter) {
          case 'available':
            return status === null || typeof status === 'undefined';
          case 'accessed':
            return status === 'accessed'; // Тільки переглянуті
          case 'sent':
            return status === 'sent'; // Тільки надіслані
          default:
            return true;
        }
      });
    }

    return videos;
  }, [videoStatuses]);

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

  // Завжди активуємо першу дозволену вкладку при відкритті (ігноруємо кеш для photoType)
  useEffect(() => {
    if (isOpen) {
      let initial: 'regular' | 'special' | 'special_plus' | 'temporary' = 'regular';
      if (mode === 'attach') {
        // Для attach віддаємо пріоритет special
        if (!allowedPhotoTabs || allowedPhotoTabs.includes('special')) initial = 'special';
        else if (allowedPhotoTabs.includes('special_plus')) initial = 'special_plus';
        else if (allowedPhotoTabs.includes('regular')) initial = 'regular';
        else if (allowedPhotoTabs.includes('temporary')) initial = 'temporary';
      } else {
        // Для звичайного режиму: перша з дозволених
        if (allowedPhotoTabs && allowedPhotoTabs.length > 0) initial = allowedPhotoTabs[0];
        else initial = 'regular';
      }
      setActiveTab(initial);
      setPhotoType(initial);
      // статус-фільтр можемо брати з кешу як і раніше
      try {
        const cachedFilters = localStorage.getItem(`gallery_filters_${profileId}`);
        if (cachedFilters) {
          const filters = JSON.parse(cachedFilters);
          if (filters.statusFilter) setStatusFilter(filters.statusFilter);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen, mode, allowedPhotoTabs, profileId]);

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

  // Завантаження статусів відео з відстеженням (батчами по 100)
  const loadVideoStatuses = useCallback(async (videos: Video[], idUser: number) => {
    if (videos.length === 0) return;

    // Фільтруємо тільки ті відео, для яких ще не запитували статуси
    const videosToRequest = videos.filter(video => !statusRequestedVideos.has(video.idVideo));
    
    if (videosToRequest.length === 0) {
      return;
    }

    // Розбиваємо на батчі по 100 відео
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < videosToRequest.length; i += batchSize) {
      batches.push(videosToRequest.slice(i, i + batchSize));
    }

    // Обробляємо кожен батч
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        const idsVideos = batch.map(v => v.idVideo);
        
        // Відмічаємо що для цих відео запит відправлено
        setStatusRequestedVideos(prev => {
          const newSet = new Set(prev);
          idsVideos.forEach(id => newSet.add(id));
          return newSet;
        });

        const response = await apiPost('/api/gallery/video-statuses', {
          idUser,
          idsVideos,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; data?: { videos: VideoConnectionStatus[] }; error?: string };
        if (typedResponse.success && typedResponse.data?.videos) {
          setVideoStatuses(prev => {
            const newStatusMap = new Map(prev);
            typedResponse.data!.videos.forEach((videoStatus: VideoConnectionStatus) => {
              newStatusMap.set(videoStatus.idVideo, videoStatus.status);
            });
            
            return newStatusMap;
          });
        } else {
          // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
          setStatusRequestedVideos(prev => {
            const newSet = new Set(prev);
            batch.forEach(video => newSet.delete(video.idVideo));
            return newSet;
          });
        }
      } catch (error) {
        // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
        setStatusRequestedVideos(prev => {
          const newSet = new Set(prev);
          batch.forEach(video => newSet.delete(video.idVideo));
          return newSet;
        });
      }

      // Невелика затримка між батчами щоб не перевантажити API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [profileId, statusRequestedVideos]);

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

    // Повністю відключаємо логування батчів
    // if (process.env.NODE_ENV === 'development' && batches.length > 5) {
    //   console.log(`📊 Processing ${batches.length} batches of photo statuses`);
    // }

    // Обробляємо кожен батч
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Повністю відключаємо логування окремих батчів
      // if (process.env.NODE_ENV === 'development' && (batchIndex + 1) % 5 === 0) {
      //   console.log(`📊 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} photos`);
      // }

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
          // Повністю відключаємо логування результатів батчів
          // if (process.env.NODE_ENV === 'development' && ((batchIndex + 1) % 10 === 0 || batchIndex === batches.length - 1)) {
          //   console.log(`📊 Batch ${batchIndex + 1}: Received statuses for ${typedResponse.data.photos.length} photos`);
          // }
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

  // Завантаження відео
  const loadVideos = useCallback(async (reset: boolean = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const cursor = reset ? '' : videoCursor;
      const response = await apiGet(`/api/gallery/${profileId}/videos`, {
        cursor,
        limit: '100',
        statuses: 'approved'
      });

      const typedResponse = response as { success: boolean; data?: VideoGalleryResponse; error?: string };
      if (typedResponse.success && typedResponse.data) {
        const videoData = typedResponse.data;
        
        if (reset) {
          setVideos(videoData.videos);
        } else {
          setVideos(prev => {
            const existingIds = new Set(prev.map(v => v.idVideo));
            const newVideos = videoData.videos.filter(video => !existingIds.has(video.idVideo));
            return [...prev, ...newVideos].sort((a, b) => b.idVideo - a.idVideo);
          });
        }
        
        setVideoCursor(videoData.cursor);
        setHasMoreVideos(videoData.videos.length >= 100);
        
        // Завантажуємо статуси для відео якщо є idRegularUser
        if (idRegularUser && context === 'chat') {
          const videosToLoad = reset ? videoData.videos : videoData.videos.filter(video => {
            const existingIds = new Set(videos.map(v => v.idVideo));
            return !existingIds.has(video.idVideo);
          });
          if (videosToLoad.length > 0) {
            loadVideoStatuses(videosToLoad, idRegularUser);
          }
        }
      } else {
        setError('Помилка завантаження відео');
      }
    } catch (err) {
      setError('Помилка завантаження відео');
    } finally {
      setLoading(false);
    }
  }, [profileId, loading, videoCursor, videos, idRegularUser, context, loadVideoStatuses]);

  // Завантаження аудіо з пагінацією
  const loadAudios = useCallback(async (reset: boolean = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiGet(`/api/gallery/${profileId}/audios`, {
        cursor: reset ? '' : audioCursor,
        limit: '50'
      });

      const typedResponse = response as { success: boolean; data?: AudioGalleryResponse; error?: string };
      if (typedResponse.success && typedResponse.data) {
        const audioData = typedResponse.data;
        
        if (reset) {
          setAudios(audioData.items);
        } else {
          setAudios(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newAudios = audioData.items.filter(audio => !existingIds.has(audio.id));
            return [...prev, ...newAudios].sort((a, b) => b.id - a.id);
          });
        }
        
        setAudioCursor(audioData.cursor);
        setHasMoreAudios(audioData.items.length >= 50);
        
        // Завантажуємо статуси для аудіо якщо є idRegularUser
        if (idRegularUser && context === 'chat') {
          const audiosToLoad = reset ? audioData.items : audioData.items.filter(audio => {
            const existingIds = new Set(audios.map(a => a.id));
            return !existingIds.has(audio.id);
          });
          if (audiosToLoad.length > 0) {
            loadAudioStatuses(audiosToLoad, idRegularUser);
          }
        }
      } else {
        setError('Помилка завантаження аудіо');
      }
    } catch (err) {
      setError('Помилка завантаження аудіо');
    } finally {
      setLoading(false);
    }
  }, [profileId, loading, audioCursor, audios, idRegularUser, context]);

  // Завантаження статусів аудіо з відстеженням (батчами по 100)
  const loadAudioStatuses = useCallback(async (audios: Audio[], idUser: number) => {
    if (audios.length === 0) return;

    // Фільтруємо тільки ті аудіо, для яких ще не запитували статуси
    const audiosToRequest = audios.filter(audio => !statusRequestedAudios.has(audio.id));
    
    if (audiosToRequest.length === 0) {
      return;
    }

    // Розбиваємо на батчі по 100 аудіо
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < audiosToRequest.length; i += batchSize) {
      batches.push(audiosToRequest.slice(i, i + batchSize));
    }

    // Обробляємо кожен батч
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        const idsAudios = batch.map(a => a.id);
        
        // Відмічаємо що для цих аудіо запит відправлено
        setStatusRequestedAudios(prev => {
          const newSet = new Set(prev);
          idsAudios.forEach(id => newSet.add(id));
          return newSet;
        });

        const response = await apiPost('/api/gallery/audio-statuses', {
          idUser,
          idsAudios,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; data?: { audios: AudioConnectionStatus[] }; error?: string };
        if (typedResponse.success && typedResponse.data?.audios) {
          setAudioStatuses(prev => {
            const newStatusMap = new Map(prev);
            typedResponse.data!.audios.forEach((audioStatus: AudioConnectionStatus) => {
              newStatusMap.set(audioStatus.idAudio, audioStatus.status);
            });
            
            return newStatusMap;
          });
        } else {
          // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
          setStatusRequestedAudios(prev => {
            const newSet = new Set(prev);
            batch.forEach(audio => newSet.delete(audio.id));
            return newSet;
          });
        }
      } catch (error) {
        // У випадку помилки - видаляємо з списку запитаних, щоб спробувати знову
        setStatusRequestedAudios(prev => {
          const newSet = new Set(prev);
          batch.forEach(audio => newSet.delete(audio.id));
          return newSet;
        });
      }

      // Невелика затримка між батчами щоб не перевантажити API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [profileId, statusRequestedAudios]);

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
      const allPhotos: Photo[] = [];
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

        const newPhotos: Photo[] = [];

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

      const newPhotos: Photo[] = [];
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

  // Обробник скролу для завантаження більше медіа
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Завантажуємо більше медіа коли доскролили до 80%
    if (scrollPercentage > 0.8) {
      if (mediaType === 'photo' && hasMore) {
        console.log('🔄 Scroll threshold reached! Loading more photos...');
        loadMorePhotos();
      } else if (mediaType === 'video' && hasMoreVideos) {
        console.log('🔄 Scroll threshold reached! Loading more videos...');
        loadVideos(false);
      } else if (mediaType === 'audio' && hasMoreAudios) {
        console.log('🔄 Scroll threshold reached! Loading more audios...');
        loadAudios(false);
      }
    }
  }, [loading, hasMore, hasMoreVideos, hasMoreAudios, mediaType, loadMorePhotos, loadVideos, loadAudios]);

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
      // Використовуємо централізовану логіку фільтрації
      const currentFilteredPhotos = filterPhotosByTypeAndStatus(photos, photoType, statusFilter, context);

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
  }, [isOpen, photos.length, photoType, statusFilter, context, hasMore, loading, filterPhotosByTypeAndStatus, loadMorePhotos]);

  // Фільтрація фото за типом та статусом
  const filteredPhotos = useMemo(() => {
    return filterPhotosByTypeAndStatus(photos, photoType, statusFilter, context);
  }, [photos, photoType, statusFilter, context, filterPhotosByTypeAndStatus]);

  // Мемоізований список відфільтрованих відео
  const filteredVideos = useMemo(() => {
    return filterVideosByStatus(videos, statusFilter);
  }, [videos, statusFilter, filterVideosByStatus]);

  // Функція фільтрації аудіо за статусом
  const filterAudiosByStatus = useCallback((
    audios: Audio[], 
    statusFilter: 'all' | 'available' | 'accessed' | 'sent'
  ): Audio[] => {
    // Фільтрація за статусом
    if (statusFilter !== 'all') {
      return audios.filter(audio => {
        const status = audioStatuses.get(audio.id);
        switch (statusFilter) {
          case 'available':
            // Доступні: статус відсутній або null
            return status === null || typeof status === 'undefined';
          case 'accessed':
            return status === 'accessed'; // Тільки переглянуті
          case 'sent':
            // TT для аудіо повертає 'accessed' замість 'sent' — враховуємо обидва як «надіслані»
            return status === 'sent' || status === 'accessed';
          default:
            return true;
        }
      });
    }

    return audios;
  }, [audioStatuses]);

  // Мемоізований список відфільтрованих аудіо
  const filteredAudios = useMemo(() => {
    return filterAudiosByStatus(audios, statusFilter);
  }, [audios, statusFilter, filterAudiosByStatus]);

  // Видаляємо checkAndLoadMorePhotos щоб уникнути циклічних залежностей

  // Завантажуємо медіа при відкритті галереї або зміні типу
  useEffect(() => {
    if (isOpen) {
      if (mediaType === 'photo') {
        setPhotos([]);
        setRegularCursor('');
        setTemporaryCursor('');
        setHasMore(true);
        setError(null);
        setAutoLoadAttempts(0); // Скидаємо лічильник при відкритті
        setPhotoStatuses(new Map()); // Очищуємо статуси фото

        setStatusRequestedPhotos(new Set()); // Очищуємо відстеження запитів статусів
        setTemporaryPhotoIds(new Set()); // Очищуємо відстеження temporary фото
        // Завантажуємо перші 500 фото
        loadInitialPhotos();
      } else if (mediaType === 'video') {
        setVideos([]);
        setVideoCursor('');
        setHasMoreVideos(true);
        setVideoStatuses(new Map()); // Очищуємо статуси відео
        setStatusRequestedVideos(new Set()); // Очищуємо відстеження запитів статусів відео
        setError(null);
        // Завантажуємо відео
        loadVideos(true);
      } else if (mediaType === 'audio') {
        setAudios([]);
        setAudioCursor('');
        setHasMoreAudios(true);
        setSelectedAudios([]);
        setAudioStatuses(new Map()); // Очищуємо статуси аудіо
        setStatusRequestedAudios(new Set()); // Очищуємо відстеження запитів статусів аудіо
        setError(null);
        // Завантажуємо аудіо
        loadAudios(true);
      }
    } else {
      // Очищуємо стан при закритті
      setError(null);
      setLoading(false);
    }
  }, [isOpen, profileId, mediaType]);



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

  // Обробка вибору відео
  const handleVideoSelect = (video: Video) => {
    setSelectedVideos(prev => {
      const isSelected = prev.some(v => v.idVideo === video.idVideo);
      
      if (isSelected) {
        // Видаляємо відео з вибраних
        return prev.filter(v => v.idVideo !== video.idVideo);
      } else {
        // Додаємо відео до вибраних (з обмеженням)
        if (prev.length >= maxSelection) {
          return prev;
        }
        return [...prev, video];
      }
    });
  };

  // Відправка вибраних фото
  const handleSendPhotos = async () => {
    if (selectedPhotos.length === 0) return;

    // Якщо є idRegularUser, відправляємо через API
    if (idRegularUser && context === 'chat') {
      // Оптимістичне оновлення в чаті: повідомляємо батьківський компонент
      try {
        onPhotoSelect(selectedPhotos);
      } catch {}
      // Закриваємо модалку одразу, щоб користувач бачив чат
      try {
        onClose();
      } catch {}

      setLoading(true);
      try {
        const response = await apiPost('/api/gallery/send-photos', {
          idsGalleryPhotos: selectedPhotos.map(p => p.idPhoto),
          idRegularUser,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; error?: string };
        if (typedResponse.success) {
          setSelectedPhotos([]);
          try { window.dispatchEvent(new CustomEvent('dialog:sent', { detail: { profileId: parseInt(profileId), clientId: idRegularUser, kind: 'photos' } })); } catch {}
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

  // Відправка вибраних відео
  const handleSendVideos = async () => {
    if (selectedVideos.length === 0) return;

    // Якщо є idRegularUser, відправляємо через API
    if (idRegularUser && context === 'chat') {
      setLoading(true);
      try {
        const response = await apiPost('/api/gallery/send-videos', {
          idsGalleryVideos: selectedVideos.map(v => v.idVideo),
          idRegularUser,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; data?: any; error?: string };
        if (typedResponse.success) {
          onClose();
          setSelectedVideos([]);
          try { window.dispatchEvent(new CustomEvent('dialog:sent', { detail: { profileId: parseInt(profileId), clientId: idRegularUser, kind: 'videos' } })); } catch {}
        } else {
          setError('Помилка відправки відео');
        }
      } catch {
        setError('Помилка відправки відео');
      } finally {
        setLoading(false);
      }
    } else {
      // Для інших контекстів поки що не підтримуємо
      setError('Відправка відео підтримується тільки в чаті');
    }
  };

  // Відправка вибраних аудіо
  const handleSendAudios = async () => {
    if (selectedAudios.length === 0) return;

    // Якщо є idRegularUser, відправляємо через API
    if (idRegularUser && context === 'chat') {
      setLoading(true);
      try {
        const response = await apiPost('/api/gallery/send-audios', {
          idsGalleryAudios: selectedAudios.map(a => a.id),
          idRegularUser,
          profileId: parseInt(profileId)
        });

        const typedResponse = response as { success: boolean; data?: any; error?: string };
        if (typedResponse.success) {
          onClose();
          setSelectedAudios([]);
          try { window.dispatchEvent(new CustomEvent('dialog:sent', { detail: { profileId: parseInt(profileId), clientId: idRegularUser, kind: 'audios' } })); } catch {}
        } else {
          setError('Помилка відправки аудіо');
        }
      } catch {
        setError('Помилка відправки аудіо');
      } finally {
        setLoading(false);
      }
    } else {
      // Для інших контекстів поки що не підтримуємо
      setError('Відправка аудіо підтримується тільки в чаті');
    }
  };

  // Вибір/скасування вибору аудіо
  const handleAudioSelect = (audio: Audio) => {
    setSelectedAudios(prev => {
      const isSelected = prev.some(a => a.id === audio.id);
      if (isSelected) {
        return prev.filter(a => a.id !== audio.id);
      } else if (prev.length < maxSelection) {
        return [...prev, audio];
      }
      return prev;
    });
  };

  // Функції для аудіо плеєра
  const handleAudioPlay = (audio: Audio) => {
    // Зупиняємо попередній аудіо, якщо він відтворюється
    if (currentPlayingAudio && currentPlayingAudio.id !== audio.id) {
      const prevAudioElement = audioPlayersRef.current.get(currentPlayingAudio.id);
      if (prevAudioElement && !prevAudioElement.paused) {
        prevAudioElement.pause();
      }
    }
    setCurrentPlayingAudio(audio);
  };

  const handleAudioPause = () => {
    // Плеєр сам керує паузою, але можемо додати логіку якщо потрібно
  };

  const handleAudioEnded = () => {
    setCurrentPlayingAudio(null);
  };

  // Реєстрація аудіо елементів
  const registerAudioElement = (audioId: number, element: HTMLAudioElement) => {
    audioPlayersRef.current.set(audioId, element);
  };

  const unregisterAudioElement = (audioId: number) => {
    audioPlayersRef.current.delete(audioId);
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
    // Режим прикріплення (включно з ексклюзивними постами та листами): керуємося allowedPhotoTabs
    if (mode === 'attach') {
      if (allowedPhotoTabs && allowedPhotoTabs.length > 0) {
        const allowRegular = allowedPhotoTabs.includes('regular') && !isSpecialPhoto(photo) && !isTemporaryPhoto(photo);
        const allowTemporary = allowedPhotoTabs.includes('temporary') && isTemporaryPhoto(photo) && !isSpecialPhoto(photo);
        const allowSpecial = allowedPhotoTabs.includes('special') && isSpecialExactPhoto(photo);
        const allowSpecialPlus = allowedPhotoTabs.includes('special_plus') && isSpecialPlusPhoto(photo);
        return allowRegular || allowTemporary || allowSpecial || allowSpecialPlus;
      }
      // Якщо не задано, у режимі attach дозволяємо всі несекретні фото (без special)
      return !isSpecialPhoto(photo);
    }
    // У звичайному чаті не дозволяємо special
    if (context === 'chat') {
      return !isSpecialPhoto(photo);
    }
    return true;
  }, [mode, allowedPhotoTabs, context, isSpecialPhoto, isSpecialExactPhoto, isSpecialPlusPhoto, isTemporaryPhoto]);

  // Форматування тривалості відео
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Мемоізований Set для швидкої перевірки вибраних відео
  const selectedVideoIds = useMemo(() => {
    return new Set(selectedVideos.map(v => v.idVideo));
  }, [selectedVideos]);

  // Перевірка чи відео вибране
  const isVideoSelected = useCallback((video: Video) => {
    return selectedVideoIds.has(video.idVideo);
  }, [selectedVideoIds]);

  // Мемоізована перевірка чи аудіо вибране
  const isAudioSelected = useCallback((audio: Audio) => {
    return selectedAudios.some(a => a.id === audio.id);
  }, [selectedAudios]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
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
            {(mode !== 'attach' || allowAudio) && (
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
            )}
            {mode === 'attach' && !allowAudio && (
              <span className="ml-2 text-xs text-gray-400">(у режимі прикріплення аудіо приховано)</span>
            )}
          </div>

          {/* Status filters for all media types */}
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
          loading || (mediaType === 'photo' && filteredPhotos.length < 15 && hasMore) || 
          (mediaType === 'video' && videos.length < 15 && hasMoreVideos)
            ? 'border-blue-500' 
            : 'border-gray-200'
        }`} style={{
          animation: loading || (mediaType === 'photo' && filteredPhotos.length < 15 && hasMore) || 
          (mediaType === 'video' && videos.length < 15 && hasMoreVideos)
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
                  {(!allowedPhotoTabs || allowedPhotoTabs.includes('regular')) && (
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
                  )}
                  {(!allowedPhotoTabs || allowedPhotoTabs.includes('special')) && (
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
                  )}
                  {(!allowedPhotoTabs || allowedPhotoTabs.includes('special_plus')) && (
                    <button
                      onClick={() => setPhotoType('special_plus')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1 ${
                        photoType === 'special_plus'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title={'Special+'}
                    >
                      <span className="relative inline-flex items-center justify-center w-4 h-4">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
                          </svg>
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white text-pink-600 text-[9px] font-extrabold leading-none flex items-center justify-center border border-pink-500">+</span>
                        </span>
                        <span>Special+</span>
                      </button>
                    )}
                  {(!allowedPhotoTabs || allowedPhotoTabs.includes('temporary')) && (
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
                  )}
                </div>
              ) : (
                <h3 className="font-medium">All photos</h3>
              )}
              
              {/* Status filters moved to header */}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600">{error}</p>
              </div>
            )}



            {/* Photos Grid */}
            <div 
              ref={scrollContainerRef}
              className="overflow-y-auto flex-1 p-2 custom-scroll"
            >
              <div 
                className="grid grid-cols-5 gap-2"
                style={{
                  gridAutoRows: 'minmax(0, max-content)'
                }}
              >
              {filteredPhotos.map((photo) => {
                const isSpecial = isSpecialPhoto(photo);
                const isSpecialPlus = isSpecialPlusPhoto(photo);
                const isSpecialExact = isSpecialExactPhoto(photo);
                const isTemporary = isTemporaryPhoto(photo);
                const isSelectable = isPhotoSelectable(photo);
                // У режимі прикріплення дозволяємо вибір special/special+ і показуємо кольоровими
                const shouldBeGrayed = context === 'chat' && isSpecial && mode !== 'attach';
                
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
                    
                    {/* Special / Special+ photo indicator */}
                    {(isSpecialExact || isSpecialPlus) && (
                      <div className="absolute top-1 left-1 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center shadow-sm relative">
                        {/* base special icon */}
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
                        </svg>
                        {/* plus overlay for special+ */}
                        {isSpecialPlus && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white text-pink-600 flex items-center justify-center text-[10px] font-extrabold leading-none">+</div>
                        )}
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
            <div className="flex-1 p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Відео</h3>
              </div>
              
              {/* Status filters for videos */}
              {context === 'chat' && idRegularUser && (
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-3">
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
                    <span>Відправлені</span>
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {/* Videos Grid */}
              <div 
                ref={scrollContainerRef}
                className="overflow-y-auto flex-1 p-2 custom-scroll"
              >
                <div 
                  className="grid grid-cols-5 gap-2"
                  style={{
                    gridAutoRows: 'minmax(0, max-content)'
                  }}
                >
                  {filteredVideos.map((video) => (
                    <div
                      key={video.idVideo}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isVideoSelected(video)
                          ? 'cursor-pointer border-blue-500 ring-2 ring-blue-200'
                          : 'cursor-pointer border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleVideoSelect(video)}
                    >
                      <img
                        src={video.urls.urlThumbnail}
                        alt={`Video ${video.idVideo}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Duration badge */}
                      <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>

                      {/* Video status indicator */}
                      {(() => {
                        const status = videoStatuses.get(video.idVideo);
                        if (!status) return null;
                        
                        return (
                          <div className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center ${
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

                      {/* Selection indicator */}
                      {isVideoSelected(video) && (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      {/* Full size view button - показується при ховері */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullSizeVideo(video);
                        }}
                        className="absolute bottom-1 left-1 w-12 h-12 bg-black bg-opacity-60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-80"
                        title="Переглянути відео"
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* No more videos message */}
                  {!loading && !hasMoreVideos && videos.length > 0 && (
                    <div className="col-span-5 flex flex-col items-center py-6 text-gray-500">
                      <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium mb-1">Це всі відео</p>
                      <p className="text-xs text-gray-400">Більше відео поки що немає</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Empty state for videos */}
              {filteredVideos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  {(loading || hasMoreVideos) ? (
                    <>
                      <svg className="w-12 h-12 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">Шукаємо відео...</p>
                      <p className="text-sm text-center">Завантажуємо відео з сервера</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">Немає відео</p>
                      <p className="text-sm text-center">В цьому профілі поки що немає відео</p>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Audio List */
            <div className="flex-1 p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Аудіо</h3>
              </div>
              
              {/* Status filters for audios */}
              {context === 'chat' && idRegularUser && (
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-3">
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
                    <span>Відправлені</span>
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {/* Audios List */}
              <div 
                ref={scrollContainerRef}
                className="overflow-y-auto flex-1 p-2 custom-scroll"
              >
                <div className="space-y-2">
                  {filteredAudios.map((audio) => (
                    <div
                      key={audio.id}
                      className={`group relative p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        isAudioSelected(audio)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => handleAudioSelect(audio)}
                    >
                      <div className="space-y-3">
                        {/* Header with icon, title and date */}
                        <div className="flex items-center space-x-3">
                          {/* Audio icon */}
                          <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>

                          {/* Audio info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {audio.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(audio.dateCreated).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Audio Player */}
                        <div 
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AudioPlayer
                            src={audio.urls.mp3}
                            title={audio.title}
                            duration={audio.duration}
                            audioId={audio.id}
                            onPlay={() => handleAudioPlay(audio)}
                            onPause={handleAudioPause}
                            onEnded={handleAudioEnded}
                            onRegister={registerAudioElement}
                            onUnregister={unregisterAudioElement}
                          />
                        </div>

                        {/* Audio status indicator */}
                        {(() => {
                          const status = audioStatuses.get(audio.id);
                          if (!status) return null;
                          
                          return (
                            <div className={`absolute top-2 left-2 w-4 h-4 rounded-full flex items-center justify-center ${
                              status === 'accessed' 
                                ? 'bg-green-500' 
                                : status === 'sent' 
                                ? 'bg-yellow-500' 
                                : 'bg-black bg-opacity-60'
                            }`}>
                              {status === 'accessed' ? (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : status === 'sent' ? (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                              ) : null}
                            </div>
                          );
                        })()}

                        {/* Selection indicator */}
                        {isAudioSelected(audio) && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty state for audios */}
                {filteredAudios.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    {(loading || hasMoreAudios) ? (
                      <>
                        <svg className="w-12 h-12 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <p className="text-lg font-medium mb-2">Завантаження аудіо...</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <p className="text-lg font-medium mb-2">Немає аудіо</p>
                        <p className="text-sm text-center">Аудіо файли не знайдені або не відповідають фільтру</p>
                      </>
                    )}
                  </div>
                )}

                {/* Loading indicator */}
                {!loading && !hasMoreAudios && audios.length > 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Всі аудіо завантажені
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - show for photos, videos and audios */}
        {(mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') && (
          <div className="border-t p-3 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {mediaType === 'photo' 
                ? `${selectedPhotos.length} of ${maxSelection} selected`
                : mediaType === 'video'
                ? `${selectedVideos.length} of ${Math.min(maxSelection, filteredVideos.length)} selected`
                : `${selectedAudios.length} of ${Math.min(maxSelection, filteredAudios.length)} selected`
              }
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              {mode === 'attach' && onAttach ? (
                <button
                  onClick={() => onAttach({ photos: selectedPhotos, videos: selectedVideos })}
                  disabled={(selectedPhotos.length === 0 && selectedVideos.length === 0) || loading}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    ((selectedPhotos.length > 0 || selectedVideos.length > 0) && !loading)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span>{actionLabel || 'Прикріпити'}</span>
                </button>
              ) : (
                <button
                  onClick={
                    mediaType === 'photo' 
                      ? handleSendPhotos 
                      : mediaType === 'video' 
                      ? handleSendVideos 
                      : handleSendAudios
                  }
                  disabled={
                    (mediaType === 'photo' ? selectedPhotos.length === 0 
                     : mediaType === 'video' ? selectedVideos.length === 0 
                     : selectedAudios.length === 0) || loading
                  }
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    ((mediaType === 'photo' ? selectedPhotos.length > 0 
                      : mediaType === 'video' ? selectedVideos.length > 0 
                      : selectedAudios.length > 0) && !loading)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{loading ? 'Sending...' : 'Send →'}</span>
                </button>
              )}
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

      {/* Full size video modal */}
      {fullSizeVideo && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
          onClick={() => setFullSizeVideo(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <video
              src={fullSizeVideo.urls.urlMp4Hd}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain rounded-lg"
              onError={(e) => {
                // Fallback to SD quality if HD fails
                const target = e.target as HTMLVideoElement;
                target.src = fullSizeVideo.urls.urlMp4Sd;
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFullSizeVideo(null);
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
