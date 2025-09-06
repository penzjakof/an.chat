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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className={`absolute z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3 ${className}`}
      style={{ bottom: '100%', right: 0, marginBottom: '8px' }}
    >
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
      <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto custom-scroll">
        {POPULAR_EMOJIS.map((emoji, index) => (
          <button
            key={index}
            onClick={() => handleEmojiClick(emoji)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-lg"
            title={`Додати ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Підказка */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Натисніть на емодзі або Escape для закриття
        </p>
      </div>
    </div>
  );
};
