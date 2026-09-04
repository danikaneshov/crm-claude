'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/api/client';
import { Loader2, Plus, Edit2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { Employee, Location } from '@crm/shared';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    role: 'MASTER',
    telegram_id: '',
    status: 'ACTIVE',
    location_ids: [] as string[]
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [empRes, locRes] = await Promise.all([
        apiClient.get('/employees'),
        apiClient.get('/locations')
      ]);
      if (empRes.ok) setEmployees(empRes.data.employees);
      if (locRes.ok) setLocations(locRes.data.locations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setForm({
        name: emp.name,
        role: emp.role,
        telegram_id: emp.telegram_id?.toString() || '',
        status: emp.status,
        location_ids: emp.location_ids
      });
    } else {
      setEditingEmployee(null);
      setForm({ name: '', role: 'MASTER', telegram_id: '', status: 'ACTIVE', location_ids: [] });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...form,
        telegram_id: form.telegram_id ? parseInt(form.telegram_id) : undefined,
      };

      if (editingEmployee) {
        await apiClient.patch(`/employees/${editingEmployee.id}`, payload);
      } else {
        await apiClient.post('/employees', payload);
      }
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleLocation = (locId: string) => {
    setForm(prev => ({
      ...prev,
      location_ids: prev.location_ids.includes(locId) 
        ? prev.location_ids.filter(id => id !== locId)
        : [...prev.location_ids, locId]
    }));
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Сотрудники</h2>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Добавить
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Имя</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Роль</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Telegram ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Статус</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{emp.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Точек: {emp.location_ids.length}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${emp.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-mono text-sm">
                    {emp.telegram_id || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {emp.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle2 size={16} /> Активен</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium"><ShieldAlert size={16} /> Уволен</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openModal(emp)}
                      className="text-gray-400 hover:text-blue-600 transition-colors p-2"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Сотрудники не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingEmployee ? "Редактировать сотрудника" : "Новый сотрудник"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
            <input 
              required
              value={form.name}
              onChange={e => setForm(prev => ({...prev, name: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
              <select 
                value={form.role}
                onChange={e => setForm(prev => ({...prev, role: e.target.value}))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="MASTER">Мастер</option>
                <option value="ADMIN">Админ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select 
                value={form.status}
                onChange={e => setForm(prev => ({...prev, status: e.target.value}))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ACTIVE">Активен</option>
                <option value="INACTIVE">Уволен</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telegram ID (опционально)</label>
            <input 
              type="number"
              value={form.telegram_id}
              onChange={e => setForm(prev => ({...prev, telegram_id: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Доступные точки</label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {locations.map(loc => (
                <label key={loc.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={form.location_ids.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={formLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center min-w-[120px] transition-colors"
            >
              {formLoading ? <Loader2 className="animate-spin" size={18} /> : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
