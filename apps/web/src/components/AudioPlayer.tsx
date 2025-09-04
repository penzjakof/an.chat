'use client';

import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  title: string;
  duration: number;
  audioId?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onRegister?: (audioId: number, element: HTMLAudioElement) => void;
  onUnregister?: (audioId: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration,
  audioId,
  onPlay,
  onPause,
  onEnded,
  onRegister,
  onUnregister
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Форматування часу
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Обробка відтворення/паузи
  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        setIsLoading(true);
        setError(null);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
      }
    } catch (err) {
      setIsLoading(false);
      setError('Помилка відтворення аудіо');
      console.error('Audio playback error:', err);
    }
  };

  // Обробка зміни позиції
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Реєстрація аудіо елемента
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioId) return;

    onRegister?.(audioId, audio);

    return () => {
      onUnregister?.(audioId);
    };
  }, [audioId, onRegister, onUnregister]);

  // Обробники подій аудіо елемента
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    const handleError = () => {
      setIsLoading(false);
      setError('Помилка завантаження аудіо');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [onEnded]);

  // Очищення при зміні src
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
  }, [src]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Контроли */}
      <div className="flex items-center space-x-3">
        {/* Кнопка відтворення/паузи */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            error 
              ? 'bg-red-500 cursor-not-allowed' 
              : isLoading 
              ? 'bg-gray-400 cursor-wait' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          title={error || (isLoading ? 'Завантаження...' : isPlaying ? 'Пауза' : 'Відтворити')}
        >
          {error ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Прогрес бар */}
        <div className="flex-1">
          <div 
            className="h-2 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleSeek}
          >
            {/* Прогрес */}
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            
            {/* Індикатор позиції */}
            <div 
              className="absolute top-1/2 w-3 h-3 bg-blue-600 rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow-sm"
              style={{ left: `${progress}%` }}
            />
          </div>
          
          {/* Час */}
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Помилка */}
      {error && (
        <div className="mt-2 text-xs text-red-600 text-center">
          {error}
        </div>
      )}
    </div>
  );
};
