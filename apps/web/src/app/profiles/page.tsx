'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { getRole } from '../../lib/session';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';

interface Group {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  provider: string;
  displayName: string | null;
  credentialLogin: string | null;
  profileId?: string | null;
  status: string;
  createdAt: string;
  group: Group | null;
}

interface FormData {
  displayName: string;
  credentialLogin: string;
  credentialPassword?: string;
  provider: string;
  groupId: string;
}

const PROVIDERS = [
  { value: 'TALKYTIMES', label: 'TalkyTimes' }
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [active, setActive] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    credentialLogin: '',
    credentialPassword: '',
    provider: 'TALKYTIMES',
    groupId: '',
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Array<{
    displayName: string;
    credentialLogin: string;
    credentialPassword?: string;
    provider?: string;
    groupId?: string;
    groupName?: string;
    status?: 'pending' | 'success' | 'error';
    errorMessage?: string;
  }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  // Datame
  const [dmCookie, setDmCookie] = useState('');
  const [dmItems, setDmItems] = useState<Array<{ id: number; name: string; age?: number; avatar_xxs?: string }>>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmLastId, setDmLastId] = useState<number | undefined>(undefined);
  const router = useRouter();
  const userRole = getRole();
  // UI фільтри/сортування/пагінація
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'login_asc'>('created_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (userRole !== 'OWNER') {
      router.replace('/login');
      return;
    }
    loadData();
  }, [userRole, router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedProfiles, fetchedGroups, shiftStatus] = await Promise.all([
        apiGet<Profile[]>('/profiles'),
        apiGet<Group[]>('/groups'),
        apiGet<{ active: boolean }>('/api/shifts/is-active')
      ]);
      setProfiles(fetchedProfiles);
      setGroups(fetchedGroups);
      setActive(!!shiftStatus?.active);
    } catch (err) {
      setError('Не вдалося завантажити дані');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Datame: отримати пачку approved
  const fetchDatameBatch = async (reset = false) => {
    if (!dmCookie.trim()) return;
    setDmLoading(true);
    try {
      const body: any = { cookieHeader: dmCookie, status: 'approved', limit: 25 };
      if (!reset && dmLastId) body.id_last = dmLastId;
      const res = await apiPost<any>('/datame/collection', body);
      const items = (res?.data || []).map((x: any) => ({ id: x.id, name: x.name, age: x.age, avatar_xxs: x.avatar_xxs }));
      const merged = reset ? items : [...dmItems, ...items];
      setDmItems(merged);
      setDmLastId(items?.length ? items[items.length - 1].id : dmLastId);
    } catch (e) {
      // ignore simple UI
    } finally {
      setDmLoading(false);
    }
  };

  const fetchFemaleDetails = async (id: number) => {
    if (!dmCookie.trim()) return;
    try {
      const data = await apiPost<any>('/datame/female', { id, cookieHeader: dmCookie });
      const d = data?.data || data;
      const mapped = { id, name: d?.name ?? '', age: d?.age ?? undefined, avatar_xxs: d?.avatar_xxs ?? '' };
      setDmItems(prev => prev.map(i => (i.id === id ? { ...i, ...mapped } : i)));
    } catch {}
  };

  // Створення профілю на базі Datame email: беремо email з form-data, пароль = email
  const createProfileFromDatame = async (datameId: number) => {
    if (!dmCookie.trim()) return;
    try {
      const fd = await apiPost<any>('/datame/form-data', { id: datameId, cookieHeader: dmCookie });
      const email = fd?.data?.profile?.email || '';
      if (!email) return alert('Email не знайдено у form-data');
      setShowCreateForm(true);
      setFormData(prev => ({ ...prev, credentialLogin: email, credentialPassword: email, provider: 'TALKYTIMES' }));
    } catch (e: any) {
      alert(e?.message || 'Помилка form-data');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const newGroup = await apiPost<Group>('/groups', { name: newGroupName });
      setGroups([...groups, newGroup]);
      setFormData({ ...formData, groupId: newGroup.id });
      setNewGroupName('');
      setShowCreateGroup(false);
    } catch (err) {
      setError('Помилка створення групи');
      console.error(err);
    }
  };

  // ===== CSV Import =====
  const handleDownloadTemplate = () => {
    const headers = ['displayName','credentialLogin','credentialPassword','provider','groupName'];
    const example = ['Anna Example','anna_login','secret123','TALKYTIMES','Default Group'];
    const csv = `${headers.join(',')}\n${example.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profiles_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          // Escaped quote
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === ',') {
          result.push(current);
          current = '';
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result.map(v => v.trim());
  }

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      setImportRows([]);
      return;
    }
    const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
    const rows: Array<any> = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = fields[idx] || '';
      });
      const item = {
        displayName: row['displayname'] || '',
        credentialLogin: row['credentiallogin'] || '',
        credentialPassword: row['credentialpassword'] || '',
        provider: row['provider'] || 'TALKYTIMES',
        groupId: row['groupid'] || '',
        groupName: row['groupname'] || '',
        status: 'pending' as const
      };
      // Відфільтровуємо порожні рядки
      if (item.displayName || item.credentialLogin) {
        rows.push(item);
      }
    }
    setImportRows(rows);
    setShowImportModal(true);
  };

  const resolveGroupId = async (groupId: string | undefined, groupName: string | undefined): Promise<string> => {
    if (groupId && groups.some(g => g.id === groupId)) return groupId;
    if (groupName) {
      const existing = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
      if (existing) return existing.id;
      // створюємо нову групу
      try {
        const newGroup = await apiPost<Group>('/groups', { name: groupName });
        setGroups(prev => [...prev, newGroup]);
        return newGroup.id;
      } catch {
        throw new Error(`Не вдалося створити групу: ${groupName}`);
      }
    }
    // якщо нічого не задано — помилка
    throw new Error('Потрібно вказати groupId або groupName');
  };

  const handleImport = async () => {
    setIsImporting(true);
    const updated: typeof importRows = [...importRows];
    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      try {
        const gid = await resolveGroupId(r.groupId, r.groupName);
        await apiPost('/profiles', {
          displayName: r.displayName,
          credentialLogin: r.credentialLogin,
          credentialPassword: r.credentialPassword,
          provider: r.provider || 'TALKYTIMES',
          groupId: gid
        } as any);
        updated[i] = { ...r, status: 'success', errorMessage: undefined };
      } catch (e: any) {
        updated[i] = { ...r, status: 'error', errorMessage: e?.message || 'Помилка' };
      }
      setImportRows([...updated]);
    }
    setIsImporting(false);
    // Оновлюємо список профілів
    loadData();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setIsValidating(true);
    
    try {
      await apiPost('/profiles', formData);
      setShowCreateForm(false);
      setFormData({ displayName: '', credentialLogin: '', credentialPassword: '', provider: 'TALKYTIMES', groupId: '' });
      loadData();
            } catch (err: unknown) {
      // Перевіряємо, чи це помилка валідації облікових даних
      const errorMessage = err instanceof Error ? err.message : 'Невідома помилка';
      if (errorMessage.includes('Не вдалось залогінитись')) {
        setValidationError(errorMessage);
        // НЕ очищуємо форму, щоб користувач міг виправити дані
      } else {
        setError('Помилка створення профілю');
        console.error(err);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    try {
      await apiPut(`/profiles/${editingProfile.id}`, formData);
      setEditingProfile(null);
      setFormData({ displayName: '', credentialLogin: '', credentialPassword: '', provider: 'TALKYTIMES', groupId: '' });
      loadData();
    } catch (err) {
      setError('Помилка оновлення профілю');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей профіль?')) return;
    try {
      await apiDelete(`/profiles/${id}`);
      loadData();
    } catch (err) {
      setError('Помилка видалення профілю');
      console.error(err);
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      displayName: profile.displayName || '',
      credentialLogin: profile.credentialLogin || '',
      provider: profile.provider,
      groupId: profile.group?.id || '',
      credentialPassword: '', // Password should not be pre-filled for security
    });
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    setFormData({ displayName: '', credentialLogin: '', credentialPassword: '', provider: 'TALKYTIMES', groupId: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Очищуємо помилку валідації при зміні даних
    if (validationError) {
      setValidationError(null);
    }
  };

  // Виведення списку з фільтрами/сортуванням/пагінацією
  const filteredSortedProfiles = (() => {
    let list = [...profiles];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.displayName || '').toLowerCase().includes(q) || (p.credentialLogin || '').toLowerCase().includes(q));
    }
    if (groupFilter) {
      list = list.filter(p => p.group?.id === groupFilter);
    }
    switch (sortBy) {
      case 'created_asc':
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'name_asc':
        list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        break;
      case 'login_asc':
        list.sort((a, b) => (a.credentialLogin || '').localeCompare(b.credentialLogin || ''));
        break;
      default:
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  })();

  const total = filteredSortedProfiles.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageProfiles = filteredSortedProfiles.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, groupFilter, sortBy, pageSize]);

  if (loading) return <div className="p-6">Завантаження...</div>;
  if (error) return <div className="p-6 text-red-500">Помилка: {error}</div>;
  if (userRole !== 'OWNER') return <div className="p-6 text-red-500">Доступ заборонено</div>;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Управління Профілями" showChatsButton={true} isActive={active} currentPath="/profiles" />

      {/* Основний контент */}
      <div className="flex-1 overflow-y-auto p-6 custom-scroll">

      {/* Тулбар з пошуком/фільтрами/сортуванням та діями */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук по імені або логіну..."
              className="border p-2 pr-9 rounded min-w-[260px]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          </div>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="border p-2 rounded min-w-[200px]"
          >
            <option value="">Всі групи</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="border p-2 rounded min-w-[180px]"
          >
            <option value="created_desc">Нові зверху</option>
            <option value="created_asc">Старі зверху</option>
            <option value="name_asc">Ім'я (А→Я)</option>
            <option value="login_asc">Логін (А→Я)</option>
          </select>
          <button onClick={() => loadData()} className="px-4 py-2 rounded border hover:bg-gray-50" title="Оновити дані">Оновити</button>
        </div>
        <div className="flex gap-3">
          {/* Datame controls */}
          <div className="hidden md:flex items-center gap-2">
            <input value={dmCookie} onChange={e => setDmCookie(e.target.value)} placeholder="Cookie datame (tld-token; user; _csrf)" className="border p-2 rounded min-w-[280px]" />
            <button onClick={() => fetchDatameBatch(true)} className="px-3 py-2 border rounded hover:bg-gray-50">DM: Завантажити</button>
            <button onClick={() => fetchDatameBatch(false)} disabled={dmLoading} className="px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50">Ще</button>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          >
            {showCreateForm ? 'Приховати форму' : 'Створити новий профіль'}
          </button>
          <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
            Імпорт CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button onClick={handleDownloadTemplate} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Шаблон CSV</button>
        </div>
      </div>

      {/* Підсумок і розмір сторінки */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 text-sm text-gray-600">
        <div>Знайдено: <span className="font-semibold text-gray-900">{total}</span></div>
        <div className="flex items-center gap-2">
          <span>На сторінці:</span>
          <select className="border p-1 rounded" value={pageSize} onChange={e => setPageSize(parseInt(e.target.value) || 10)}>
            {[10,20,50,100].map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-3">Новий Профіль</h2>
          
          {validationError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Помилка валідації:</strong> {validationError}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <select
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              className="border p-2 rounded"
              required
            >
              <option value="">Оберіть платформу</option>
              {PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="displayName"
              placeholder="Ім&apos;я профілю"
              value={formData.displayName}
              onChange={handleChange}
              className="border p-2 rounded"
              required
            />
            <input
              type="text"
              name="credentialLogin"
              placeholder="Логін"
              value={formData.credentialLogin}
              onChange={handleChange}
              className="border p-2 rounded"
              required
            />
            <input
              type="password"
              name="credentialPassword"
              placeholder="Пароль"
              value={formData.credentialPassword}
              onChange={handleChange}
              className="border p-2 rounded"
              required
            />
            <div className="flex gap-2">
              <select
                name="groupId"
                value={formData.groupId}
                onChange={handleChange}
                className="border p-2 rounded flex-1"
                required
              >
                <option value="">Оберіть групу</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
              >
                Створити групу
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isValidating}
            className={`px-4 py-2 rounded text-white ${
              isValidating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isValidating ? 'Перевіряємо дані...' : 'Створити'}
          </button>
          <button type="button" onClick={() => setShowCreateForm(false)} className="ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
            Скасувати
          </button>
        </form>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Створити нову групу</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                placeholder="Назва групи"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="border p-2 rounded w-full mb-4"
                required
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                  Створити
                </button>
                <button type="button" onClick={() => setShowCreateGroup(false)} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-3">Імпорт профілів з CSV</h3>
            <p className="text-sm text-gray-600 mb-3">
              Підтримувані колонки: <code>displayName</code>, <code>credentialLogin</code>, <code>credentialPassword</code>, <code>provider</code> (за замовчуванням TALKYTIMES),
              <code>groupId</code> або <code>groupName</code>.
            </p>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-3 border-b text-left">Ім'я</th>
                    <th className="py-2 px-3 border-b text-left">Логін</th>
                    <th className="py-2 px-3 border-b text-left">Пароль</th>
                    <th className="py-2 px-3 border-b text-left">Платформа</th>
                    <th className="py-2 px-3 border-b text-left">Група (ID/Name)</th>
                    <th className="py-2 px-3 border-b text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-3 border-b">{r.displayName}</td>
                      <td className="py-2 px-3 border-b">{r.credentialLogin}</td>
                      <td className="py-2 px-3 border-b">{r.credentialPassword ? '••••••' : ''}</td>
                      <td className="py-2 px-3 border-b">{r.provider || 'TALKYTIMES'}</td>
                      <td className="py-2 px-3 border-b">{r.groupId || r.groupName || ''}</td>
                      <td className="py-2 px-3 border-b">
                        {r.status === 'pending' && <span className="text-gray-600">Очікує</span>}
                        {r.status === 'success' && <span className="text-green-600">Імпортовано</span>}
                        {r.status === 'error' && <span className="text-red-600">Помилка: {r.errorMessage}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                className={`px-4 py-2 rounded text-white ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                onClick={handleImport}
                disabled={isImporting || importRows.length === 0}
              >
                {isImporting ? 'Імпорт триває...' : 'Імпортувати'}
              </button>
              <button
                className="px-4 py-2 rounded text-white bg-gray-600 hover:bg-gray-700"
                onClick={() => { setShowImportModal(false); setImportRows([]); }}
                disabled={isImporting}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Datame table if cookie present */}
      {dmCookie.trim() && (
        <div className="overflow-x-auto border rounded mb-4">
          <table className="min-w-full bg-white">
            <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
              <tr>
                <th className="py-2 px-4 border-b text-left">ID</th>
                <th className="py-2 px-4 border-b text-left">Аватар</th>
                <th className="py-2 px-4 border-b text-left">Імʼя</th>
                <th className="py-2 px-4 border-b text-left">Вік</th>
                <th className="py-2 px-4 border-b text-left">Деталі</th>
                <th className="py-2 px-4 border-b text-left">Створити TT</th>
              </tr>
            </thead>
            <tbody>
              {dmItems.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{u.id}</td>
                  <td className="py-2 px-4 border-b">
                    {u.avatar_xxs ? <img src={u.avatar_xxs} alt="avatar" className="w-8 h-8 rounded" /> : <div className="w-8 h-8 bg-gray-200 rounded" />}
                  </td>
                  <td className="py-2 px-4 border-b">{u.name}</td>
                  <td className="py-2 px-4 border-b">{u.age ?? ''}</td>
                  <td className="py-2 px-4 border-b">
                    <button onClick={() => fetchFemaleDetails(u.id)} className="px-3 py-1 border rounded hover:bg-gray-50 text-sm">Оновити</button>
                  </td>
                  <td className="py-2 px-4 border-b">
                    <button onClick={() => createProfileFromDatame(u.id)} className="px-3 py-1 border rounded hover:bg-gray-50 text-sm">Вставити email</button>
                  </td>
                </tr>
              ))}
              {dmItems.length === 0 && (
                <tr><td colSpan={5} className="py-3 px-4 text-sm text-gray-500">Даних немає. Вкажіть cookie та натисніть “DM: Завантажити”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full bg-white">
          <thead className="sticky top-0 bg-white/90 backdrop-blur z-10">
            <tr>
              <th className="py-2 px-4 border-b text-left">Ім&apos;я</th>
              <th className="py-2 px-4 border-b text-left">Логін</th>
              <th className="py-2 px-4 border-b text-left">Статус</th>
              <th className="py-2 px-4 border-b text-left">Група</th>
              <th className="py-2 px-4 border-b text-left">Платформа</th>
              <th className="py-2 px-4 border-b text-left">Створено</th>
              <th className="py-2 px-4 border-b text-left">Дії</th>
            </tr>
          </thead>
          <tbody>
            {pageProfiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50">
                {editingProfile?.id === profile.id ? (
                  <>
                    <td className="py-2 px-4 border-b">
                      <input
                        type="text"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleChange}
                        className="border p-1 rounded w-full"
                        required
                      />
                    </td>
                    <td className="py-2 px-4 border-b">
                      <input
                        type="text"
                        name="credentialLogin"
                        value={formData.credentialLogin}
                        onChange={handleChange}
                        className="border p-1 rounded w-full"
                        required
                      />
                    </td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded text-xs ${profile.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{profile.status}</span>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <select
                        name="groupId"
                        value={formData.groupId}
                        onChange={handleChange}
                        className="border p-1 rounded w-full"
                        required
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-4 border-b"><span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">{profile.provider}</span></td>
                    <td className="py-2 px-4 border-b">{new Date(profile.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-4 border-b">
                      <button onClick={handleUpdate} className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600">
                        Зберегти
                      </button>
                      <button onClick={cancelEdit} className="ml-2 bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600">
                        Скасувати
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-4 border-b">{profile.displayName || 'Немає'}</td>
                    <td className="py-2 px-4 border-b">{profile.credentialLogin || 'Немає'}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded text-xs ${profile.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {profile.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">{profile.group?.name || 'Без групи'}</span></td>
                    <td className="py-2 px-4 border-b">{profile.provider}</td>
                    <td className="py-2 px-4 border-b">{new Date(profile.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-4 border-b">
                      <button onClick={() => startEdit(profile)} className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600">
                        Редагувати
                      </button>
                      <button onClick={() => handleDelete(profile.id)} className="ml-2 bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">
                        Видалити
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагінація */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-600">Показано {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} з {total}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Попередня</button>
          <span className="text-sm">Сторінка {page} / {totalPages}</span>
          <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Наступна</button>
        </div>
      </div>
      </div>
    </div>
  );
}
