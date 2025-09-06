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
}

interface Preferences {
  gender?: string;
  age_from?: number;
  age_to?: number;
  pref_personality_type?: string;
}

interface ProfileData {
  personal: PersonalInfo;
  preferences: Preferences;
}

interface InfoRowProps {
  label: string;
  value?: string | number | null;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  if (!value || String(value).trim() === '') return null;

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
};

interface MyPublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
}

export const MyPublicProfileModal: React.FC<MyPublicProfileModalProps> = ({
  isOpen,
  onClose,
  profileId,
}) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profileId) {
      fetchProfileData();
    }
  }, [isOpen, profileId]);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);

    try {
      const profileDataResponse = await apiGet<{ profileData: { personal: PersonalInfo; preferences: Preferences } }>(`/profiles/${profileId}/profile-data`);

      if (profileDataResponse.profileData) {
        setProfileData(profileDataResponse.profileData);
      } else {
        setError('Не вдалося завантажити дані профілю');
      }
    } catch (err: any) {
      setError(err.message || 'Сталася помилка при завантаженні');
    } finally {
      setLoading(false);
    }
  };

  const personal = profileData?.personal;
  const preferences = profileData?.preferences;

  const dateCreated = useMemo(() => {
    if (!personal?.date_birth) return null;
    try {
      const date = new Date(personal.date_birth);
      return date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [personal?.date_birth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Мій публічний профіль</h2>
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
        <div className="px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {profileData && personal && (
            <div className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-start space-x-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {personal.avatar_xl ? (
                    <img
                      src={personal.avatar_xl}
                      alt={personal.name || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">{personal.name}</h3>
                  {personal.age && (
                    <p className="text-sm text-gray-600">{personal.age} років</p>
                  )}
                  {(personal.city || personal.country) && (
                    <p className="text-sm text-gray-600">
                      {[personal.city, personal.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Блок "Звички та зовнішність" */}
              {(() => {
                const drinkingValue = personal?.drinking ? parseFloat(String(personal.drinking)) : 0;
                const hasDrinking = drinkingValue === 1 || drinkingValue === 2 || drinkingValue === 3 || drinkingValue === 4;
                const hasHeight = personal?.height && parseFloat(String(personal.height)) !== 0;
                const smokingValue = personal?.smoking ? parseFloat(String(personal.smoking)) : 0;
                const hasSmoking = smokingValue === 1 || smokingValue === 2 || smokingValue === 3;
                const hasWeight = personal?.weight && parseFloat(String(personal.weight)) !== 0;
                const hasHair = personal?.color_hair && String(personal.color_hair).trim() !== '';
                const hasBodyType = personal?.body_type && String(personal.body_type).trim() !== '';
                const hasEyes = personal?.color_eye && String(personal.color_eye).trim() !== '';
                const hasGoals = personal?.goal && Array.isArray(personal.goal) && personal.goal.length > 0;
                const shouldShow = hasDrinking || hasHeight || hasSmoking || hasWeight || hasHair || hasBodyType || hasEyes || hasGoals;

                if (!shouldShow) return null;

                return (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Звички та зовнішність</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Чіп з алкоголем */}
                    {(() => {
                      const value = personal?.drinking ? parseFloat(String(personal.drinking)) : 0;
                      let displayText = '';

                      if (value === 1) {
                        displayText = 'Ніколи';
                      } else if (value === 2) {
                        displayText = 'За компанію';
                      } else if (value === 3) {
                        displayText = 'Іноді';
                      } else if (value === 4) {
                        displayText = 'Часто';
                      }

                      return displayText && (
                        <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Cocktail icon">
                            <path d="M4 4h16l-8 9-8-9Z"/>
                            <path d="M12 13v6"/>
                            <path d="M7 21h10"/>
                            <path d="M8.5 6.5l7 4"/>
                            <circle cx="15.5" cy="9" r="1.4" fill="currentColor" stroke="none"/>
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {displayText}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп з курінням */}
                    {(() => {
                      const value = personal?.smoking ? parseFloat(String(personal.smoking)) : 0;
                      let displayText = '';

                      if (value === 1) {
                        displayText = 'Ніколи';
                      } else if (value === 2) {
                        displayText = 'За компанію';
                      } else if (value === 3) {
                        displayText = 'Так';
                      }

                      return displayText && (
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 64 64" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Cigarette icon">
                            {/* Сигарета */}
                            <rect x="8" y="28" width="36" height="8" rx="1.5"/>
                            <line x1="14" y1="28" x2="14" y2="36"/>
                            <line x1="22" y1="28" x2="22" y2="36"/>
                            {/* Попіл / кінчик */}
                            <rect x="44" y="28" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/>
                            {/* Дим */}
                            <path d="M56 20c-4 6 4 8 0 14" stroke="currentColor"/>
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {displayText}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп з волоссям */}
                    {(() => {
                      const value = personal?.color_hair;
                      return value && String(value).trim() !== '' && (
                        <div className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2zM8 14v4m8-4v4m-4-4v4" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {value}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп зі статурого */}
                    {(() => {
                      const value = personal?.body_type;
                      return value && String(value).trim() !== '' && (
                        <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {value}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Чіп з очима */}
                    {(() => {
                      const value = personal?.color_eye;
                      return value && String(value).trim() !== '' && (
                        <div className="flex items-center gap-2 bg-teal-50 px-2 py-1 rounded-full w-fit">
                          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-sm text-gray-700 font-medium">
                            {value}
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

                    {/* Чіпи з цілями */}
                    {personal?.goal && Array.isArray(personal.goal) && personal.goal.map((goalItem, index) => (
                      <div key={`goal-${index}`} className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded-full w-fit">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">
                          {goalItem}
                        </span>
                      </div>
                    ))}

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
                );
              })()}

              {/* Блок "Риси та захоплення" */}
              {(() => {
                const hasTraits = personal?.traits && ((Array.isArray(personal.traits) && personal.traits.length > 0) || (typeof personal.traits === 'string' && (personal.traits as string).trim()));
                const hasHobbies = personal?.hobbies && ((Array.isArray(personal.hobbies) && personal.hobbies.length > 0) || (typeof personal.hobbies === 'string' && (personal.hobbies as string).trim()));
                const hasReligion = personal?.religion;

                return (hasTraits || hasHobbies || hasReligion) ? (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Риси та захоплення</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Окремі чіпи з рисами */}
                    {(() => {
                      let traitsArray: string[] = [];
                      if (Array.isArray(personal?.traits)) {
                        traitsArray = personal.traits;
                      } else if (typeof personal?.traits === 'string' && personal.traits) {
                        traitsArray = (personal.traits as string).split(',').map((t: string) => t.trim()).filter((t: string) => t);
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
                      } else if (typeof personal?.hobbies === 'string' && personal.hobbies) {
                        hobbiesArray = (personal.hobbies as string).split(',').map((h: string) => h.trim()).filter((h: string) => h);
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
                ) : null;
              })()}

              {/* Блок "Про мене" */}
              {personal?.description && (
                <div className="mt-6 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Про мене</h3>
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

              {/* Інші поля */}
              <div className="space-y-1">
                <InfoRow label="Шукаю" value={personal?.looking_for} />
              </div>
              <div className="space-y-1">
                <InfoRow label="Створено" value={dateCreated} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};