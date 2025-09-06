"use client";

import React, { useState, useRef, useEffect } from 'react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
}

// Популярні емодзі для швидкого доступу
const POPULAR_EMOJIS = [
  '😀', '😂', '❤️', '👍', '👎', '👋', '🙌', '👏', '🙏', '🤝',
  '😊', '😍', '🥰', '😘', '😉', '😎', '🤔', '😮', '😢', '😭',
  '😤', '😡', '🥺', '😴', '🤗', '🤭', '🤫', '🤥', '🤑', '🤐',
  '💖', '💕', '💯', '🔥', '⭐', '✨', '💫', '🌟', '🎉', '🎊',
  '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
  '🌹', '🌷', '🌺', '🌸', '🌼', '🌻', '🌷', '🌹', '🥀', '🌱',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '👨', '👩', '👧', '👦', '👶', '👵', '👴', '🧑', '👨‍💻', '👩‍💻',
  '💼', '📱', '💻', '⌨️', '🖥️', '🖨️', '📺', '📷', '🎥', '🎵',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀',
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
  '✈️', '🚀', '🚁', '🛳️', '⛵', '🛶', '🚤', '🛥️', '🛩️', '🛸'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  onClose,
  isOpen,
  className = ""
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Закриття при кліку поза компонентом
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Закриття при натисканні Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    // Не закриваємо меню після вибору емодзі
  };

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className={`absolute z-50 bg-white border border-gray-300 rounded-lg shadow-xl ${className}`}
      style={{
        bottom: '100%',
        right: 0,
        marginBottom: '8px',
        width: 'fit-content',
        minWidth: '220px',
        maxWidth: '240px'
      }}
    >
      <div className="p-3">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">Виберіть емодзі</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Сітка емодзі */}
        <div className="max-h-96 overflow-y-auto custom-scroll">
        <div className="grid gap-2 p-1" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 36px)',
          gridAutoRows: '36px'
        }}>
          {POPULAR_EMOJIS.map((emoji, index) => (
            <button
              key={index}
              onClick={() => handleEmojiClick(emoji)}
              className="flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-2xl leading-none"
              title={`Додати ${emoji}`}
              style={{
                fontSize: '1.44em',
                width: '36px !important',
                height: '36px !important',
                minWidth: '36px !important',
                minHeight: '36px !important',
                maxWidth: '36px !important',
                maxHeight: '36px !important'
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        </div>

        {/* Підказка */}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Натисніть на емодзі для додавання або Escape для закриття
          </p>
        </div>
      </div>
    </div>
  );
};
