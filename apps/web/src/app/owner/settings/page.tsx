'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRole } from '@/src/lib/session';
import { Header } from '@/components/Header';
import { apiPost } from '@/src/lib/api';

export default function OwnerSettingsPage() {
  const router = useRouter();
  const role = getRole();
  const [active, setActive] = useState(false);

  // Адмін панелі (Datame)
  const [platform, setPlatform] = useState<'TALKYTIMES'>('TALKYTIMES');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cookieHeader, setCookieHeader] = useState('');
  const [loginInfo, setLoginInfo] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== 'OWNER') {
      router.replace('/login');
    }
  }, [role, router]);

  if (role !== 'OWNER') return null;

  const doLogin = async () => {
    setBusy(true);
    setLoginInfo('');
    try {
      const res = await apiPost<{ success: boolean; refreshToken?: string; setCookie?: string[] }>(
        '/datame/login',
        { email, password, cookieHeader: cookieHeader || undefined }
      );
      const setCookie = (res.setCookie || []).join('; ');
      const cookieJoined = [cookieHeader, setCookie].filter(Boolean).join('; ');
      setCookieHeader(cookieJoined);
      setLoginInfo('Успішний логін. Cookies збережено.');
    } catch (e: any) {
      setLoginInfo(e?.message || 'Помилка логіну');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Налаштування" showChatsButton={true} isActive={active} currentPath="/owner/settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Адмін панелі</h2>
        <div className="bg-white border rounded p-4 mb-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Платформа</label>
              <select value={platform} onChange={e => setPlatform(e.target.value as any)} className="border p-2 rounded w-full">
                <option value="TALKYTIMES">TalkyTimes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Логін (email)</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded w-full" placeholder="email" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 rounded w-full" placeholder="password" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Cookie (tld-token; user; _csrf)</label>
              <textarea value={cookieHeader} onChange={e => setCookieHeader(e.target.value)} rows={3} className="border p-2 rounded w-full" placeholder="sm_anonymous_id=...; tld-token=...; user=...; _csrf=..." />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} onClick={doLogin} className={`px-4 py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Увійти</button>
          </div>
          {loginInfo && <div className="mt-3 text-sm text-gray-700">{loginInfo}</div>}
        </div>
      </div>
    </div>
  );
}


