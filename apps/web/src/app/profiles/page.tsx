'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { getRole, getAgencyCode } from '../../lib/session';
import { useRouter } from 'next/navigation';

interface Group {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  provider: string;
  displayName: string | null;
  credentialLogin: string | null;
  status: string;
  createdAt: string;
  group: Group;
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    credentialLogin: '',
    credentialPassword: '',
    provider: 'TALKYTIMES',
    groupId: '',
  });
  const [newGroupName, setNewGroupName] = useState('');
  const router = useRouter();
  const userRole = getRole();

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
      const fetchedProfiles = await apiGet<Profile[]>('/profiles');
      setProfiles(fetchedProfiles);
      const fetchedGroups = await apiGet<Group[]>('/groups');
      setGroups(fetchedGroups);
    } catch (err) {
      setError('Не вдалося завантажити дані');
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await apiPost('/profiles', formData);
      setShowCreateForm(false);
      setFormData({ displayName: '', credentialLogin: '', credentialPassword: '', provider: 'TALKYTIMES', groupId: '' });
      loadData();
    } catch (err) {
      setError('Помилка створення профілю');
      console.error(err);
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
      groupId: profile.group.id,
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
  };

  if (loading) return <div className="p-6">Завантаження...</div>;
  if (error) return <div className="p-6 text-red-500">Помилка: {error}</div>;
  if (userRole !== 'OWNER') return <div className="p-6 text-red-500">Доступ заборонено</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Управління Профілями</h1>

      <button
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="bg-primary text-white px-4 py-2 rounded mb-4 hover:bg-primary-dark"
      >
        {showCreateForm ? 'Приховати форму' : 'Створити новий профіль'}
      </button>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-3">Новий Профіль</h2>
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
              placeholder="Ім'я профілю"
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
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Створити
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

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Ім'я</th>
              <th className="py-2 px-4 border-b">Логін</th>
              <th className="py-2 px-4 border-b">Статус</th>
              <th className="py-2 px-4 border-b">Група</th>
              <th className="py-2 px-4 border-b">Платформа</th>
              <th className="py-2 px-4 border-b">Створено</th>
              <th className="py-2 px-4 border-b">Дії</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
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
                    <td className="py-2 px-4 border-b">{profile.status}</td>
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
                    <td className="py-2 px-4 border-b">{profile.provider}</td>
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
                    <td className="py-2 px-4 border-b">{profile.group.name}</td>
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
    </div>
  );
}
