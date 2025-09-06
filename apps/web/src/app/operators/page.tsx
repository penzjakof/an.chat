'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';
import { getRole, getAgencyCode } from '../../lib/session';
import { Header } from '@/components/Header';

interface Operator {
  id: string;
  username: string;
  name: string;
  operatorCode: string;
  status: string;
  createdAt: string;
  operatorLinks: Array<{
    group: {
      id: string;
      name: string;
    };
  }>;
}

interface Group {
  id: string;
  name: string;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<boolean>(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    operatorCode: '',
    groupId: ''
  });

  useEffect(() => {
    const role = getRole();
    if (role !== 'OWNER') {
      setError('Доступ заборонено');
      setLoading(false);
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [operatorsData, groupsData, shiftStatus] = await Promise.all([
        apiGet<Operator[]>('/users/operators'),
        apiGet<Group[]>('/groups'),
        apiGet<{ active: boolean }>('/api/shifts/is-active')
      ]);
      setOperators(operatorsData);
      setGroups(groupsData);
      setActive(!!shiftStatus?.active);
    } catch (err) {
      setError('Помилка завантаження даних');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const agencyCode = getAgencyCode();
    if (!agencyCode) {
      setError('Не вдалося отримати код агенції');
      return;
    }

    try {
      await apiPost('/users/operator', {
        agencyCode,
        ...formData
      });
      setShowCreateForm(false);
      setFormData({ username: '', name: '', password: '', operatorCode: '', groupId: '' });
      loadData();
    } catch (err) {
      setError('Помилка створення оператора');
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator) return;

    try {
      await apiPut(`/users/operators/${editingOperator.id}`, formData);
      setEditingOperator(null);
      setFormData({ username: '', name: '', password: '', operatorCode: '', groupId: '' });
      loadData();
    } catch (err) {
      setError('Помилка оновлення оператора');
      console.error(err);
    }
  };

  const handleDelete = async (operatorId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цього оператора?')) return;

    try {
      await apiDelete(`/users/operators/${operatorId}`);
      loadData();
    } catch (err) {
      setError('Помилка видалення оператора');
      console.error(err);
    }
  };

  const startEdit = (operator: Operator) => {
    setEditingOperator(operator);
    setFormData({
      username: operator.username,
      name: operator.name,
      password: '',
      operatorCode: operator.operatorCode,
      groupId: operator.operatorLinks[0]?.group.id || ''
    });
  };

  const cancelEdit = () => {
    setEditingOperator(null);
    setShowCreateForm(false);
    setFormData({ username: '', name: '', password: '', operatorCode: '', groupId: '' });
  };

  if (loading) return <div className="p-6">Завантаження...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="flex flex-col h-screen">
      <Header showBackButton={true} showChatsButton={true} isActive={active} currentPath="/operators" />

      {/* Основний контент */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Управління операторами</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:opacity-90"
          >
            Додати оператора
          </button>
        </div>

      {/* Форма створення/редагування */}
      {(showCreateForm || editingOperator) && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">
            {editingOperator ? 'Редагувати оператора' : 'Створити оператора'}
          </h3>
          <form onSubmit={editingOperator ? handleUpdate : handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Юзернейм</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ім&apos;я</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Пароль {editingOperator && '(залишити порожнім, щоб не змінювати)'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full p-2 border rounded"
                required={!editingOperator}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Реф код</label>
              <input
                type="text"
                value={formData.operatorCode}
                onChange={(e) => setFormData({ ...formData, operatorCode: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Група</label>
              <select
                value={formData.groupId}
                onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                className="w-full p-2 border rounded"
              >
                <option value="">Без групи</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-primary text-white px-4 py-2 rounded hover:opacity-90"
              >
                {editingOperator ? 'Оновити' : 'Створити'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:opacity-90"
              >
                Скасувати
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Таблиця операторів */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Юзернейм</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Ім&apos;я</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Реф код</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Група</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Статус</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Створено</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Дії</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((operator) => (
              <tr key={operator.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">{operator.username}</td>
                <td className="border border-gray-300 px-4 py-2">{operator.name}</td>
                <td className="border border-gray-300 px-4 py-2">{operator.operatorCode}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {operator.operatorLinks[0]?.group.name || 'Без групи'}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    operator.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {operator.status === 'ACTIVE' ? 'Активний' : 'Заблокований'}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {new Date(operator.createdAt).toLocaleDateString('uk-UA')}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(operator)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:opacity-90"
                    >
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDelete(operator.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:opacity-90"
                    >
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        {operators.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Операторів не знайдено
          </div>
        )}
      </div>
    </div>
  );
}
