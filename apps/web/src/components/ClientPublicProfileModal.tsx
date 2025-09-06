"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface PersonalInfo {
  avatar_xl?: string;
  age?: number;
  date_birth?: string;
  city?: string;
  country?: string;
  count_children?: number;
  color_hair?: string;
  color_eye?: string;
  body_type?: string;
  description?: string;
  drinking?: number;
  education?: string;
  level_of_english?: string;
  gender?: string;
  height?: number;
  looking_for?: string;
  marital_status?: string;
  name?: string;
  occupation?: string;
  other_langs?: string;
  religion?: string;
  smoking?: number;
  weight?: number;
  goal?: string[];
  traits?: string[];
  hobbies?: string[];
  mood?: string;
  language?: string;
  field_of_work?: string;
  other_languages?: string[];
}

interface Preferences {
  age_from?: number;
  age_to?: number;
  pref_personality_type?: string | null;
  gender?: string;
}

interface ProfileResponse {
  profileData?: {
    personal?: PersonalInfo;
    preferences?: Preferences;
    is_online?: boolean;
    last_visit?: string;
    date_created?: string;
  };
}

interface PhotoItem {
  id: number;
  id_media: number;
  id_image: number;
  url_xs?: string;
  url_small?: string;
  url_medium?: string;
  url_large?: string;
  url_xl?: string;
  url_xxl?: string;
  url_standart?: string; // sic: так у відповіді
  url_original?: string;
  is_hidden?: boolean;
  is_main?: number;
  isMain?: number;
}

interface PhotosResponse {
  data?: {
    public?: PhotoItem[];
    private?: PhotoItem[];
    [key: string]: any;
  };
}

export function ClientPublicProfileModal({
  isOpen,
  onClose,
  profileId,
  clientId
}: {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  clientId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personal, setPersonal] = useState<PersonalInfo | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | undefined>();
  const [lastVisit, setLastVisit] = useState<string | undefined>();
  const [dateCreated, setDateCreated] = useState<string | undefined>();
  const [photosPublic, setPhotosPublic] = useState<PhotoItem[]>([]);
  const [photosPrivate, setPhotosPrivate] = useState<PhotoItem[]>([]);
  const [mainPhoto, setMainPhoto] = useState<PhotoItem | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // Публічний профіль клієнта
        const clientPublic = await apiGet<{ success: boolean; profile?: any }>(`/profiles/${profileId}/client/${clientId}/public`);
        const pr = clientPublic.profile?.personal ? clientPublic.profile : undefined;
        if (pr && !cancelled) {
          setPersonal(pr.personal || null);
          setPreferences(pr.preferences || null);
          setIsOnline(pr.is_online);
          setLastVisit(pr.last_visit);
          setDateCreated(pr.date_created);
        }
        const photos = await apiPost<PhotosResponse>(`/profiles/${profileId}/client/${clientId}/photos`, {});
        const data = photos?.data || (photos as any);
        const publicPhotos = (data?.public || []).filter((x: PhotoItem) => !x.is_hidden);
        const privatePhotos = (data?.private || []).filter((x: PhotoItem) => !x.is_hidden);
        if (!cancelled) {
          setPhotosPublic(publicPhotos);
          setPhotosPrivate(privatePhotos);
          const main = [...publicPhotos, ...privatePhotos].find(x => (x.isMain === 1) || (x.is_main === 1));
          setMainPhoto(main || null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Помилка завантаження профілю');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, profileId, clientId]);

  const publicShown = useMemo(() => photosPublic, [photosPublic]);
  const privateShown = useMemo(() => photosPrivate, [photosPrivate]);

  if (!isOpen) return null;

  // Функція для форматування часу останнього візиту
  const formatLastVisit = (lastVisitDate: string | undefined) => {
    if (!lastVisitDate) return 'офлайн';

    try {
      const now = new Date();
      const lastVisit = new Date(lastVisitDate);
      const diffMs = now.getTime() - lastVisit.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);

      if (diffMinutes < 60) {
        if (diffMinutes < 1) return 'щойно';
        if (diffMinutes === 1) return 'хвилину тому';
        if (diffMinutes < 5) return `${diffMinutes} хвилини тому`;
        return `${diffMinutes} хвилин тому`;
      }

      if (diffHours < 24) {
        if (diffHours === 1) return 'годину тому';
        if (diffHours < 5) return `${diffHours} години тому`;
        return `${diffHours} годин тому`;
      }

      if (diffDays < 7) {
        if (diffDays === 1) return 'день тому';
        return `${diffDays} дні тому`;
      }

      if (diffWeeks === 1) return 'тиждень тому';
      if (diffWeeks < 4) return `${diffWeeks} тижні тому`;

      return 'місяць тому';
    } catch {
      return 'офлайн';
    }
  };

  // Функція для визначення стилів настрою
  const getMoodStyles = (mood: string | null | undefined) => {
    // Перевіряємо на null/undefined
    if (!mood || typeof mood !== 'string') {
      return {
        iconColor: 'text-gray-600',
        textColor: 'text-gray-600',
        displayName: 'Невідомо',
        icon: (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        )
      };
    }

    switch (mood.toLowerCase()) {
      case 'real_love':
        return {
          iconColor: 'text-red-600',
          textColor: 'text-red-600',
          displayName: 'Любов',
          icon: (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'friendship':
        return {
          iconColor: 'text-blue-600',
          textColor: 'text-blue-600',
          displayName: 'Дружба',
          icon: (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          )
        };
      case 'hot_talks':
        return {
          iconColor: 'text-pink-600',
          textColor: 'text-pink-600',
          displayName: 'Інтим',
          icon: (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
            </svg>
          )
        };
      default:
        return {
          iconColor: 'text-gray-600',
          textColor: 'text-gray-600',
          displayName: mood,
          icon: (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )
        };
    }
  };

  // Функція для визначення знаку зодіаку
  const getZodiacSign = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const month = date.getMonth() + 1; // Місяці від 0 до 11
      const day = date.getDate();

      const signs = [
        { name: 'Козоріг', start: [12, 22], end: [1, 19], icon: '♑' },
        { name: 'Водолій', start: [1, 20], end: [2, 18], icon: '♒' },
        { name: 'Риби', start: [2, 19], end: [3, 20], icon: '♓' },
        { name: 'Овен', start: [3, 21], end: [4, 19], icon: '♈' },
        { name: 'Телець', start: [4, 20], end: [5, 20], icon: '♉' },
        { name: 'Близнюки', start: [5, 21], end: [6, 20], icon: '♊' },
        { name: 'Рак', start: [6, 21], end: [7, 22], icon: '♋' },
        { name: 'Лев', start: [7, 23], end: [8, 22], icon: '♌' },
        { name: 'Діва', start: [8, 23], end: [9, 22], icon: '♍' },
        { name: 'Терези', start: [9, 23], end: [10, 22], icon: '♎' },
        { name: 'Скорпіон', start: [10, 23], end: [11, 21], icon: '♏' },
        { name: 'Стрілець', start: [11, 22], end: [12, 21], icon: '♐' }
      ];

      for (const sign of signs) {
        const [startMonth, startDay] = sign.start;
        const [endMonth, endDay] = sign.end;

        if ((month === startMonth && day >= startDay) ||
            (month === endMonth && day <= endDay) ||
            (month > startMonth && month < endMonth) ||
            (month === 12 && startMonth === 1) ||
            (month === 1 && endMonth === 12)) {
          return sign;
        }
      }

      return { name: 'Невідомий', icon: '❓' };
    } catch {
      return { name: 'Невідомий', icon: '❓' };
    }
  };

  const InfoRow = ({ label, value }: { label: string; value?: any }) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
    const val = Array.isArray(value) ? value.join(', ') : String(value);

    // Декодування HTML entities
    const decodeHtmlEntities = (text: string) => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    };

    const decodedValue = decodeHtmlEntities(val);

    return (
      <div className="flex text-sm">
        <div className="w-[120px] text-gray-500 text-right">{label}</div>
        <div className="flex-1 text-gray-900 ml-2">{decodedValue}</div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scroll">

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Завантаження…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : (
          <div className="p-6 grid grid-cols-2 gap-8">
            {/* Ліва колонка з фото */}
            <div className="space-y-4">
              {mainPhoto && (
                <div className="w-[350px] h-[400px]">
                  <img
                    src={mainPhoto.url_standart || mainPhoto.url_xxl || mainPhoto.url_xl || mainPhoto.url_large || mainPhoto.url_medium || mainPhoto.url_small || mainPhoto.url_xs || personal?.avatar_xl || ''}
                    alt="main"
                    className="w-full h-full object-cover rounded-lg cursor-zoom-in"
                    onClick={() => setFullImage(mainPhoto.url_original || '')}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {/* Публічні фото */}
                {publicShown.map(p => (
                  <img key={p.id}
                    src={p.url_xl || p.url_large || p.url_medium || p.url_small || p.url_xs || ''}
                    alt={`pub-${p.id}`}
                    className="w-[80px] h-[80px] object-cover rounded cursor-zoom-in"
                    onClick={() => setFullImage(p.url_original || '')}
                  />
                ))}

                {/* Приватні фото */}
                {privateShown.map(p => (
                  <div key={p.id} className="relative">
                    <img
                      src={p.url_xl || p.url_large || p.url_medium || p.url_small || p.url_xs || ''}
                      alt={`priv-${p.id}`}
                      className="w-[80px] h-[80px] object-cover rounded cursor-zoom-in hover:opacity-80 transition-opacity"
                      onClick={() => setFullImage(p.url_original || '')}
                    />
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 py-0.5 rounded">Приватне</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Права колонка з інформацією */}
            <div className="space-y-2">
              {/* Інформація про ім'я та вік */}
              <div className="flex items-center gap-3">
                {/* Іконка гендеру */}
                {personal?.gender && (
                  <div className="flex-shrink-0">
                    {personal.gender === 'male' ? (
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : personal.gender === 'female' ? (
                      <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                )}
                <div className="text-xl font-bold text-gray-900">
                  {personal?.name ? `${personal.name}${personal?.age ? `, ${personal.age}` : ''}` : `User ${clientId}`}
                </div>
                {/* Чіп з статусом онлайн */}
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-gray-700 font-medium">
                    {isOnline ? 'онлайн' : formatLastVisit(lastVisit)}
                  </span>
                </div>
              </div>

              {/* Чіпи з інформацією */}
              <div className="space-y-2">
                {/* Чіп з локацією */}
                {(personal?.country || personal?.city) && (
                  <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-700 font-medium">
                      {[personal?.country, personal?.city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}

                {/* Рядок з датою народження та знаком зодіаку */}
                {personal?.date_birth && (
                  <div className="flex gap-2">
                    {/* Чіп з датою народження */}
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">
                        {personal.date_birth}
                      </span>
                    </div>

                    {/* Чіп із знаком зодіаку */}
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                      <span className="text-base">{getZodiacSign(personal.date_birth).icon}</span>
                      <span className="text-sm text-gray-700 font-medium">
                        {getZodiacSign(personal.date_birth).name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Інші чіпи */}
                <div className="flex flex-wrap gap-2">
                  {/* Чіп з настроєм */}
                  {(() => {
                    const moodStyles = getMoodStyles(personal?.mood);
                    return (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                        <div className={`w-4 h-4 flex items-center justify-center ${moodStyles.iconColor}`}>
                          {moodStyles.icon}
                        </div>
                        <span className={`text-xs font-medium ${moodStyles.textColor}`}>
                          {moodStyles.displayName}
                        </span>
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* Заголовок "Я шукаю" */}
              <div className="mt-6 mb-3">
                <h3 className="text-base font-semibold text-gray-900">Я шукаю</h3>
              </div>

              {/* Чіпи з пошуком */}
              {(preferences?.gender || preferences?.age_from || preferences?.age_to || personal?.goal || preferences?.pref_personality_type) && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    {/* Чіп з пошуком за статтю та віком */}
                    {(preferences?.gender || preferences?.age_from || preferences?.age_to) && (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                        {/* Іконка статі */}
                        {preferences?.gender === 'male' ? (
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        ) : preferences?.gender === 'female' ? (
                          <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                        {/* Текст з віковим діапазоном */}
                        <span className="text-sm text-gray-700 font-medium">
                          {preferences?.age_from && preferences?.age_to
                            ? `${preferences.age_from}-${preferences.age_to}`
                            : preferences?.age_from
                              ? `від ${preferences.age_from}`
                              : preferences?.age_to
                                ? `до ${preferences.age_to}`
                                : 'Будь-який вік'
                          }
                        </span>
                      </div>
                    )}

                    {/* Чіп з цілями */}
                    {personal?.goal && Array.isArray(personal.goal) && personal.goal.length > 0 && (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.goal}
                        </span>
                      </div>
                    )}

                    {/* Чіп з типом особистості */}
                    {preferences?.pref_personality_type && (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {preferences.pref_personality_type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Блок "Риси та захоплення" */}
              {((personal?.traits && ((Array.isArray(personal.traits) && personal.traits.length > 0) || (typeof personal.traits === 'string' && personal.traits.trim()))) ||
                (personal?.hobbies && ((Array.isArray(personal.hobbies) && personal.hobbies.length > 0) || (typeof personal.hobbies === 'string' && personal.hobbies.trim()))) ||
                (personal?.movie_genres && Array.isArray(personal.movie_genres) && personal.movie_genres.length > 0) ||
                (personal?.music_genres && Array.isArray(personal.music_genres) && personal.music_genres.length > 0) ||
                personal?.religion) && (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Риси та захоплення</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Окремі чіпи з рисами */}
                    {(() => {
                      let traitsArray: string[] = [];
                      if (Array.isArray(personal?.traits)) {
                        traitsArray = personal.traits;
                      } else if (typeof personal?.traits === 'string') {
                        traitsArray = personal.traits.split(',').map(t => t.trim()).filter(t => t);
                      }
                      return traitsArray.map((trait, index) => (
                        <div key={`trait-${index}`} className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {trait}
                          </span>
                        </div>
                      ));
                    })()}

                    {/* Окремі чіпи з хобі */}
                    {(() => {
                      let hobbiesArray: string[] = [];
                      if (Array.isArray(personal?.hobbies)) {
                        hobbiesArray = personal.hobbies;
                      } else if (typeof personal?.hobbies === 'string') {
                        hobbiesArray = personal.hobbies.split(',').map(h => h.trim()).filter(h => h);
                      }
                      return hobbiesArray.map((hobby, index) => (
                        <div key={`hobby-${index}`} className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H15m-3 7.5A9.5 9.5 0 1121.5 12 9.5 9.5 0 0112 2.5z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {hobby}
                          </span>
                        </div>
                      ));
                    })()}

                    {/* Окремі чіпи з жанрами фільмів */}
                    {personal?.movie_genres && Array.isArray(personal.movie_genres) && personal.movie_genres.map((genre, index) => (
                      <div key={`movie-${index}`} className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {genre}
                        </span>
                      </div>
                    ))}

                    {/* Окремі чіпи з музичними жанрами */}
                    {personal?.music_genres && Array.isArray(personal.music_genres) && personal.music_genres.map((genre, index) => (
                      <div key={`music-${index}`} className="flex items-center gap-2 bg-orange-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {genre}
                        </span>
                      </div>
                    ))}

                    {/* Чіп з релігією */}
                    {personal?.religion && (
                      <div className="flex items-center gap-2 bg-violet-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.religion}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Блок "Освіта та зайнятість" */}
              {(personal?.education || personal?.occupation || personal?.field_of_work || personal?.language ||
                personal?.level_of_english || personal?.other_langs || personal?.other_languages) && (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Освіта та зайнятість</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Чіп з освітою */}
                    {personal?.education && (
                      <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.education}
                        </span>
                      </div>
                    )}

                    {/* Чіп з професією */}
                    {personal?.occupation && (
                      <div className="flex items-center gap-2 bg-teal-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.occupation}
                        </span>
                      </div>
                    )}

                    {/* Чіп зі сферою роботи */}
                    {personal?.field_of_work && (
                      <div className="flex items-center gap-2 bg-cyan-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.field_of_work}
                        </span>
                      </div>
                    )}

                    {/* Чіп з мовою */}
                    {personal?.language && (
                      <div className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.language}
                        </span>
                      </div>
                    )}

                    {/* Чіп з рівнем англійської */}
                    {personal?.level_of_english && (
                      <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.level_of_english}
                        </span>
                      </div>
                    )}

                    {/* Чіпи з іншими мовами */}
                    {(() => {
                      let otherLanguages: string[] = [];
                      if (personal?.other_langs && typeof personal.other_langs === 'string') {
                        otherLanguages = personal.other_langs.split(',').map(lang => lang.trim()).filter(lang => lang);
                      } else if (personal?.other_languages && typeof personal.other_languages === 'string') {
                        otherLanguages = personal.other_languages.split(',').map(lang => lang.trim()).filter(lang => lang);
                      } else if (Array.isArray(personal?.other_languages)) {
                        otherLanguages = personal.other_languages;
                      }
                      return otherLanguages.map((lang, index) => (
                        <div key={`other-lang-${index}`} className="flex items-center gap-2 bg-rose-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V5l1-1z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {lang}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Блок "Сім'я" */}
              {(personal?.marital_status || (personal?.count_children !== undefined && personal?.count_children >= 0)) && (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Сім'я</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Чіп із сімейним станом */}
                    {personal?.marital_status && (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.marital_status}
                        </span>
                      </div>
                    )}

                    {/* Чіп з дітьми */}
                    {personal?.count_children !== undefined && personal?.count_children >= 0 && (
                      <div className="flex items-center gap-2 bg-lime-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-lime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {personal.count_children === 0 ? 'Немає дітей' : `${personal.count_children} ${personal.count_children === 1 ? 'дитина' : personal.count_children < 5 ? 'дитини' : 'дітей'}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Блок "Звички та зовнішність" */}
              {(() => {
                const hasDrinking = personal?.drinking && parseFloat(String(personal.drinking)) !== 0;
                const hasHeight = personal?.height && parseFloat(String(personal.height)) !== 0;
                const hasSmoking = personal?.smoking && parseFloat(String(personal.smoking)) !== 0;
                const hasWeight = personal?.weight && parseFloat(String(personal.weight)) !== 0;
                const shouldShow = hasDrinking || hasHeight || hasSmoking || hasWeight;

                if (!shouldShow) return null;

                return (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Звички та зовнішність</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Чіп з алкоголем */}
                    {(() => {
                      const value = personal?.drinking;
                      const numValue = value ? parseFloat(String(value)) : 0;
                      return numValue !== 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            Алкоголь: {value}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп зі зростом */}
                    {(() => {
                      const value = personal?.height;
                      const numValue = value ? parseFloat(String(value)) : 0;
                      return numValue !== 0 && (
                        <div className="flex items-center gap-2 bg-cyan-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7l-2-2-2 2m0 0l-2 2 2 2m0-2V21M8 7h8M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {value} см
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп з курінням */}
                    {(() => {
                      const value = personal?.smoking;
                      const numValue = value ? parseFloat(String(value)) : 0;
                      return numValue !== 0 && (
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            Куріння: {value}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп з вагою */}
                    {(() => {
                      const value = personal?.weight;
                      const numValue = value ? parseFloat(String(value)) : 0;
                      return numValue !== 0 && (
                        <div className="flex items-center gap-2 bg-pink-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0m-6.001 0l3-9m0 0l3-1m-3 1l-3 1M6 7l3 1m0 0l-3 9a5.002 5.002 0 006.001 0m-6.001 0l3-9m0 0l3-1m-3 1l-3 1M9 8l3 1m0 0l-3 9a5.002 5.002 0 006.001 0m-6.001 0l3-9m0 0l3-1m-3 1l-3 1M12 9l3 1m0 0l-3 9a5.002 5.002 0 006.001 0m-6.001 0l3-9m0 0l3-1m-3 1l-3 1" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {value} кг
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                );
              })()}

              {/* Блок "Опис" */}
              {personal?.description && (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Опис</h3>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {(() => {
                      const decodeHtmlEntities = (text: string) => {
                        const textarea = document.createElement('textarea');
                        textarea.innerHTML = text;
                        return textarea.value;
                      };
                      return decodeHtmlEntities(String(personal.description));
                    })()}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <InfoRow label="Волосся" value={personal?.color_hair} />
                <InfoRow label="Очі" value={personal?.color_eye} />
                <InfoRow label="Статура" value={personal?.body_type} />
                <InfoRow label="Шукаю" value={personal?.looking_for} />
              </div>
              <div className="space-y-1">
                <InfoRow label="Створено" value={dateCreated} />
              </div>
            </div>
          </div>
        )}

        {fullImage && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setFullImage(null)}>
            <div className="absolute inset-0 bg-black/80" />
            <img src={fullImage} alt="full" className="relative max-w-[95vw] max-h-[95vh] object-contain rounded" />
          </div>
        )}
      </div>
    </div>
  );
}


