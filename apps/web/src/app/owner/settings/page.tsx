'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRole } from '@/lib/session';
import { Header } from '@/components/Header';
import { apiPost, apiGet } from '@/lib/api';

type Group = { id: string; name: string };
type Collected = { id: number; name: string; age?: number; email?: string; avatar?: string };
type Connection = {
  id: string;
  platform: 'DATAME';
  email: string;
  status: 'connecting' | 'connected' | 'error';
  lastUpdatedAt?: number;
  count: number;
  items: Collected[];
  loading: boolean;
  menuOpen?: boolean;
};

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
  const [showModal, setShowModal] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectEmail, setConnectEmail] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [connectPlatform, setConnectPlatform] = useState<'TALKYTIMES'>('TALKYTIMES');
  const [connectError, setConnectError] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [selectedConnIdx, setSelectedConnIdx] = useState<number | null>(null);

  useEffect(() => {
    if (role !== 'OWNER') {
      router.replace('/login');
    }
  }, [role, router]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Group[]>('/groups');
        setGroups(data);
      } catch {}
    })();
  }, []);

  if (role !== 'OWNER') return null;

  const connect = async () => {
    setBusy(true);
    setLoginInfo('');
    try {
      setConnectLoading(true);
      setConnectError('');
      await apiPost<{ success: boolean }>('/datame/login', { email: connectEmail || email, password: connectPassword || password });
      // Додаємо айтем у список і одразу запускаємо збір
      const conn: Connection = {
        id: `datame-${Date.now()}`,
        platform: 'DATAME',
        email: (connectEmail || email).trim(),
        status: 'connecting',
        count: 0,
        items: [],
        loading: true,
      };
      setConnections(prev => [...prev, conn]);
      const idx = connections.length; // позиція нового
      setShowConnectModal(false);
      await collectForConnection(idx);
    } catch (e: any) {
      const msg = e?.message || 'Невірний логін або пароль';
      setConnectError(msg);
    } finally {
      setConnectLoading(false);
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

  const collectForConnection = async (idx: number) => {
    if (idx < 0) return;
    setConnections(prev => prev.map((c, i) => i === idx ? { ...c, loading: true } : c));
    try {
      let id_last: number | undefined = undefined;
      let total = 0;
      const items: Collected[] = [];
      while (true) {
        const page = await apiPost<any>('/datame/collection', { status: 'approved', limit: 25, id_last });
        const batch = page?.data || [];
        if (!Array.isArray(batch) || batch.length === 0) break;
        total += batch.length;
        items.push(...batch.map((x: any) => ({ id: x.id, name: x.name, age: x.age, avatar: x.avatar_xxs || x.avatar_small || x.avatar || '' })));
        id_last = batch[batch.length - 1].id;
        await new Promise(r => setTimeout(r, 50));
      }
      const now = Date.now();
      setConnections(prev => prev.map((c, i) => i === idx ? { ...c, items, count: total, lastUpdatedAt: now, status: 'connected', loading: false } : c));
    } catch {
      setConnections(prev => prev.map((c, i) => i === idx ? { ...c, loading: false, status: 'error' } : c));
    }
  };

  const openProfilesModal = async (idx: number) => {
    setSelectedConnIdx(idx);
    setShowModal(true);
    // підтягуємо email-и у фоні
    await enrichEmailsForConnection(idx, 500);
  };

  const enrichEmailsForConnection = async (idx: number, max: number = Infinity) => {
    const conns = connections;
    const target = conns[idx];
    if (!target) return;
    let processed = 0;
    for (let i = 0; i < target.items.length; i++) {
      if (processed >= max) break;
      const it = target.items[i];
      if (it.email) continue;
      try {
        const fd = await apiPost<any>('/datame/form-data', { id: it.id });
        const email = fd?.data?.profile?.email || '';
        if (email) {
          setConnections(prev => prev.map((c, ci) => {
            if (ci !== idx) return c;
            const items = c.items.map((p, pi) => pi === i ? { ...p, email } : p);
            return { ...c, items };
          }));
        }
      } catch {}
      processed++;
      await new Promise(r => setTimeout(r, 20));
    }
  };

  function formatRelative(ts?: number) {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'щойно';
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m} хв тому`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} год тому`;
    const d = Math.floor(h / 24);
    return `${d} дн тому`;
  }

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
    const base = selectedConnIdx !== null ? (connections[selectedConnIdx]?.items || []) : collected;
    if (base.length === 0) return;
    const resp = await apiPost<{ byEmail: Record<string,string>; byProfileId: Record<string,string> }>(
      '/datame-import/check-duplicates',
      { items: base.map(c => ({ id: c.id })) }
    );
    setDupInfo(resp);
  };

  const doImport = async () => {
    if (!targetGroupId) return alert('Оберіть групу');
    const base = selectedConnIdx !== null ? (connections[selectedConnIdx!]?.items || []) : collected;
    if (base.length === 0) return;
    const items: Array<{ id: number; email: string; name?: string }> = [];
    for (const c of base.slice(0, 500)) {
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Адмін Панелі</h2>
          <button onClick={() => { setConnectEmail(''); setConnectPassword(''); setConnectError(''); setShowConnectModal(true); }} className="px-4 py-2 rounded border hover:bg-gray-50">Підключити</button>
        </div>

        {/* Список підключень */}
        <div className="space-y-4 max-w-5xl">
          {connections.length === 0 && (
            <div className="text-gray-500 text-sm">Немає підключень. Натисніть “Підключити”.</div>
          )}
          {connections.map((c, idx) => (
            <div key={c.id} className="border rounded p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">DataMe</div>
                <div className="font-medium">{c.email}</div>
                <span className={`px-3 py-1 rounded-full text-xs ${c.status==='connected' ? 'bg-green-100 text-green-700' : (c.status==='connecting' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}`}>
                  {c.status==='connected' ? 'Підключено' : c.status==='connecting' ? 'Підключення…' : 'Помилка'}
                </span>
                <button onClick={() => collectForConnection(idx)} className="px-2 py-1 border rounded hover:bg-gray-50" title="Оновити">⟳</button>
                <div className="text-xs text-gray-500">Ост. оновл. {formatRelative(c.lastUpdatedAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={c.loading || c.count===0} onClick={() => openProfilesModal(idx)} className={`px-4 py-2 rounded border ${c.loading || c.count===0 ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}`}>{c.count} активні профілі</button>
                <div className="relative">
                  <button onClick={() => setConnections(prev => prev.map((x,i)=> i===idx ? { ...x, menuOpen: !x.menuOpen } : { ...x, menuOpen: false }))} className="px-2 py-1 border rounded hover:bg-gray-50">⋮</button>
                  {c.menuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow">
                      <button onClick={() => { setConnectEmail(c.email); setConnectPassword(''); setShowConnectModal(true); setConnections(prev=>prev.map((x,i)=> i===idx ? { ...x, menuOpen:false } : x)); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">Редагувати</button>
                      <button onClick={() => setConnections(prev => prev.filter((_,i)=>i!==idx))} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600">Видалити</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Модалка підключення */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-full max-w-md">
              <div className="p-4 border-b font-semibold">Підключення</div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Платформа</label>
                  <select value={connectPlatform} onChange={e=>setConnectPlatform(e.target.value as any)} className="border p-2 rounded w-full">
                    <option value="TALKYTIMES">TalkyTimes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Логін (email)</label>
                  <input value={connectEmail} onChange={e=>setConnectEmail(e.target.value)} className="border p-2 rounded w-full" placeholder="email" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Пароль</label>
                  <input type="password" value={connectPassword} onChange={e=>setConnectPassword(e.target.value)} className="border p-2 rounded w-full" placeholder="password" />
                </div>
                {connectError && <div className="text-sm text-red-600">{connectError}</div>}
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button onClick={()=>setShowConnectModal(false)} className="px-3 py-2 border rounded hover:bg-gray-50">Скасувати</button>
                <button disabled={connectLoading} onClick={connect} className={`px-4 py-2 rounded text-white ${connectLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Увійти</button>
              </div>
            </div>
          </div>
        )}
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
          {/* Закриваємо грід-блок старого макету */}
          
          {/* Старі кнопки/лічильники приховані у новому UI */}
        </div>

        {showModal && selectedConnIdx !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-full max-w-5xl max-h-[85vh] overflow-y-auto">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-semibold">Знайдені профілі — {selectedConnIdx !== null ? (connections[selectedConnIdx]?.count || 0) : 0}</div>
                <div className="flex gap-2 items-center">
                  <button onClick={checkDuplicates} className="px-3 py-2 border rounded hover:bg-gray-50">Перевірити дублікати</button>
                  <select value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className="border p-2 rounded">
                    <option value="">Оберіть групу</option>
                    {groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                  </select>
                  <select value={importMode} onChange={e => setImportMode(e.target.value as any)} className="border p-2 rounded">
                    <option value="new_only">Перенести тільки нові</option>
                    <option value="replace_all">Перенести всі та замінити</option>
                    <option value="skip">Не переносити дублікати</option>
                  </select>
                  <button onClick={doImport} className="px-3 py-2 border rounded hover:bg-gray-50">Додати всі профілі</button>
                  <button onClick={() => setShowModal(false)} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">Закрити</button>
                </div>
              </div>
              <div className="p-4">
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
                      {(selectedConnIdx !== null && connections[selectedConnIdx]?.items ? (connections[selectedConnIdx]?.items || []) : []).map(i => (
                        <tr key={i.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border-t text-sm">{i.avatar ? <img src={i.avatar} alt="avatar" className="w-8 h-8 rounded" /> : <div className="w-8 h-8 rounded bg-gray-200" />}</td>
                          <td className="px-3 py-2 border-t text-sm">{i.name}{typeof i.age === 'number' ? `, ${i.age}` : ''}</td>
                          <td className="px-3 py-2 border-t text-sm">{i.email || ''}</td>
                          <td className="px-3 py-2 border-t text-sm">{i.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


