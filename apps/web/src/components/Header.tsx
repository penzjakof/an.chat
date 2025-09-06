'use client';

import { useRouter } from 'next/navigation';
import { clearSession } from '@/lib/session';

interface HeaderProps {
  title?: string;
  showHomeButton?: boolean;
  showChatsButton?: boolean;
  showSettingsButton?: boolean;
  showEndShiftButton?: boolean;
  showLogoutButton?: boolean;
  showBackButton?: boolean;
  isActive?: boolean;
  currentPath?: string;
  onEndShift?: () => void;
}

export function Header({
  title,
  showHomeButton = false,
  showChatsButton = false,
  showSettingsButton = false,
  showEndShiftButton = false,
  showLogoutButton = false,
  showBackButton = false,
  isActive = false,
  currentPath = '',
  onEndShift
}: HeaderProps) {
  const router = useRouter();

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
      {/* Назва додатку або заголовок сторінки */}
      <div className="font-bold text-xl text-[#680098] mr-4">
        {title || 'AnChat'}
      </div>

      {/* Кнопка назад */}
      {showBackButton && (
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
          title="Назад"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          <span className="text-[14px] text-gray-500">Назад</span>
        </button>
      )}

      {/* Кнопка на дашборд */}
      {showHomeButton && (
        <button
          onClick={() => router.push('/dashboard')}
          className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
            currentPath === '/dashboard' ? 'bg-blue-50 text-blue-700' : ''
          }`}
          title="На дашборд"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${
            currentPath === '/dashboard' ? 'text-blue-600' : 'text-gray-700'
          }`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
          <span className={`text-[14px] ${
            currentPath === '/dashboard' ? 'text-blue-700 font-medium' : 'text-gray-500'
          }`}>Дашборд</span>
        </button>
      )}

      {/* Кнопка чатів */}
      {showChatsButton && (
        <button
          onClick={() => router.push('/chats')}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            !isActive ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
          } ${
            currentPath?.includes('/chats') ? 'bg-blue-50 text-blue-700' : ''
          }`}
          title={!isActive ? "Почніть зміну щоб отримати доступ" : "Чати"}
          disabled={!isActive}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${
            currentPath?.includes('/chats') ? 'text-blue-600' : 'text-gray-700'
          }`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <span className={`text-[14px] ${
            currentPath?.includes('/chats') ? 'text-blue-700 font-medium' : 'text-gray-500'
          }`}>Чати</span>
        </button>
      )}

      {/* Кнопка налаштувань */}
      {showSettingsButton && (
        <button
          onClick={() => router.push('/settings')}
          className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
            currentPath === '/settings' ? 'bg-blue-50 text-blue-700' : ''
          }`}
          title="Налаштування"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${
            currentPath === '/settings' ? 'text-blue-600' : 'text-gray-700'
          }`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.165.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.108 1.204.165.397.506.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.108 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.939-1.11.939h-1.094c-.55 0-1.019-.397-1.11-.94l-.148-.893c-.071-.425-.383-.763-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.939-.56-.939-1.109v-1.094c0-.55.397-1.019.94-1.11l.894-.149c.424-.07.763-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={`text-[14px] ${
            currentPath === '/settings' ? 'text-blue-700 font-medium' : 'text-gray-500'
          }`}>Налаштування</span>
        </button>
      )}

      {/* Кнопка завершити зміну */}
      {showEndShiftButton && currentPath !== '/dashboard' && (
        <button
          onClick={onEndShift}
          className="group flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Завершити зміну"
          disabled={!isActive}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} className="w-5 h-5 text-gray-700 group-hover:text-red-600 group-hover:fill-red-600 transition-all border border-gray-400 rounded group-hover:border-red-600" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
          </svg>
          <span className="text-[14px] text-gray-500 group-hover:text-red-500 transition-colors">Завершити</span>
        </button>
      )}


      {/* Кнопка виходу */}
      {showLogoutButton && (
        <button
          onClick={() => { clearSession(); router.push('/login'); }}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ml-auto"
          title="Вийти"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
          </svg>
          <span className="text-[14px] text-gray-500">Вийти</span>
        </button>
      )}
    </header>
  );
}
