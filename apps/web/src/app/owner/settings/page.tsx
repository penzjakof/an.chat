'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRole } from '@/lib/session';
import { Header } from '@/components/Header';
import { apiPost } from '@/lib/api';

export default function OwnerSettingsPage() {
  const router = useRouter();
  const role = getRole();
  const [active, setActive] = useState(false);

  // Адмін панелі (Datame)
  const [platform, setPlatform] = useState<'TALKYTIMES'>('TALKYTIMES');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [progress, setProgress] = useState<{ total: number; loaded: number; loading: boolean }>({ total: 0, loaded: 0, loading: false });
  const [loginInfo, setLoginInfo] = useState<string>('');
  const [collected, setCollected] = useState<Array<{ id: number; name: string; age?: number; email?: string; avatar?: string }>>([]);
  const [collecting, setCollecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState<'new_only' | 'replace_all' | 'skip'>('new_only');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [dupInfo, setDupInfo] = useState<{ byEmail: Record<string,string>; byProfileId: Record<string,string> } | null>(null);

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
      const res = await apiPost<{ success: boolean }>(
        '/datame/login',
        { email, password }
      );
      setLoginInfo('Успішний логін. Можна запускати збір профілів.');
    } catch (e: any) {
      setLoginInfo(e?.message || 'Помилка логіну');
    } finally {
      setBusy(false);
    }
  };

  const collectAll = async () => {
    setCollecting(true);
    setCollected([]);
    setProgress({ total: 0, loaded: 0, loading: true });
    try {
      let id_last: number | undefined = undefined;
      let total = 0;
      let loaded = 0;
      while (true) {
        const page = await apiPost<any>('/datame/collection', { status: 'approved', limit: 25, id_last });
        const items = page?.data || [];
        if (!Array.isArray(items) || items.length === 0) break;
        total += items.length;
        loaded = total;
        setCollected(prev => [
          ...prev,
          ...items.map((x: any) => ({ id: x.id, name: x.name, age: x.age, avatar: x.avatar_xxs || x.avatar_small || x.avatar || '' }))
        ]);
        setProgress({ total, loaded, loading: true });
        id_last = items[items.length - 1].id;
        // запобігти блокуванню UI
        await new Promise(r => setTimeout(r, 50));
      }
      setProgress(p => ({ ...p, loading: false }));
      // після збору — підтягнути email-и з form-data
      await enrichEmails();
    } catch (e) {
      setProgress(p => ({ ...p, loading: false }));
    } finally {
      setCollecting(false);
    }
  };

  const enrichEmails = async (max: number = Infinity) => {
    let processed = 0;
    for (let i = 0; i < collected.length; i++) {
      if (processed >= max) break;
      const item = collected[i];
      if (item.email) continue;
      try {
        const fd = await apiPost<any>('/datame/form-data', { id: item.id });
        const email = fd?.data?.profile?.email || '';
        if (email) {
          setCollected(prev => prev.map((p, idx) => idx === i ? { ...p, email } : p));
        }
      } catch {}
      processed++;
      // невелика пауза
      await new Promise(r => setTimeout(r, 25));
    }
  };

  const checkDuplicates = async () => {
    if (collected.length === 0) return;
    const resp = await apiPost<{ byEmail: Record<string,string>; byProfileId: Record<string,string> }>(
      '/datame-import/check-duplicates',
      { items: collected.map(c => ({ id: c.id })) }
    );
    setDupInfo(resp);
  };

  const doImport = async () => {
    if (!targetGroupId) return alert('Оберіть групу');
    if (collected.length === 0) return;
    // тягнемо емейли через form-data, щоб імпортувати валідно
    const items: Array<{ id: number; email: string; name?: string }> = [];
    for (const c of collected.slice(0, 500)) { // обмежимо пачку для UI
      try {
        const fd = await apiPost<any>('/datame/form-data', { id: c.id });
        const email = fd?.data?.profile?.email || '';
        if (email) items.push({ id: c.id, email, name: c.name });
      } catch {}
      await new Promise(r => setTimeout(r, 25));
    }
    const res = await apiPost<{ results: Array<{ id: number; status: string }> }>(
      '/datame-import/import',
      { groupId: targetGroupId, items, mode: importMode }
    );
    alert(`Імпорт завершено: ${res.results.filter(r => r.status==='created').length} створено, ${res.results.filter(r => r.status==='replaced').length} замінено, ${res.results.filter(r => r.status==='skipped').length} пропущено`);
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
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} onClick={doLogin} className={`px-4 py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Увійти</button>
            <button disabled={collecting} onClick={collectAll} className={`px-4 py-2 rounded text-white ${collecting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>Зібрати профілі</button>
            <button onClick={checkDuplicates} className="px-4 py-2 rounded text-white bg-amber-600 hover:bg-amber-700">Перевірити дублікати</button>
          </div>
          {loginInfo && <div className="mt-3 text-sm text-gray-700">{loginInfo}</div>}
          <div className="mt-3 text-sm text-gray-600">Зібрано: <span className="font-semibold text-gray-900">{progress.loaded}</span>{progress.loading ? ' (завантаження...)' : ''}</div>
        </div>

        {collected.length > 0 && (
          <div className="bg-white border rounded p-4 max-w-4xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">У списку: {collected.length}</div>
              <div className="flex gap-2">
                <select value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className="border p-2 rounded">
                  <option value="">Оберіть групу</option>
                </select>
                <select value={importMode} onChange={e => setImportMode(e.target.value as any)} className="border p-2 rounded">
                  <option value="new_only">Перенести тільки нові</option>
                  <option value="replace_all">Перенести всі та замінити</option>
                  <option value="skip">Не переносити дублікати</option>
                </select>
                <button onClick={doImport} className="px-3 py-2 border rounded hover:bg-gray-50">Додати всі профілі</button>
              </div>
            </div>
            {dupInfo && (
              <div className="mb-3 text-sm text-gray-600">Дублів за email: {Object.keys(dupInfo.byEmail).length}, за profileId: {Object.keys(dupInfo.byProfileId).length}</div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Аватар</th>
                    <th className="px-3 py-2 text-left">Імʼя, вік</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {collected.slice(0, 50).map(i => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-t text-sm">
                        {i.avatar ? <img src={i.avatar} alt="avatar" className="w-8 h-8 rounded" /> : <div className="w-8 h-8 rounded bg-gray-200" />}
                      </td>
                      <td className="px-3 py-2 border-t text-sm">{i.name}{typeof i.age === 'number' ? `, ${i.age}` : ''}</td>
                      <td className="px-3 py-2 border-t text-sm">{i.email || ''}</td>
                      <td className="px-3 py-2 border-t text-sm">{i.id}</td>
                    </tr>
                  ))}
                  {collected.length > 50 && (
                    <tr><td colSpan={4} className="px-3 py-2 text-sm text-gray-500">Показано перші 50...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


