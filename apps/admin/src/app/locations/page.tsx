'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/api/client';
import { Loader2, Plus, Edit2, MapPin } from 'lucide-react';
import type { Location } from '@crm/shared';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    address: '',
    r_keeper_mapping: {
      hookah_category_id: '',
      replacement_category_id: ''
    }
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await apiClient.get('/locations');
      if (res.ok) setLocations(res.data.locations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const openModal = (loc?: Location) => {
    if (loc) {
      setEditingLocation(loc);
      setForm({
        name: loc.name,
        address: loc.address || '',
        r_keeper_mapping: {
          hookah_category_id: loc.r_keeper_mapping.hookah_category_id || '',
          replacement_category_id: loc.r_keeper_mapping.replacement_category_id || ''
        }
      });
    } else {
      setEditingLocation(null);
      setForm({
        name: '',
        address: '',
        r_keeper_mapping: { hookah_category_id: '', replacement_category_id: '' }
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingLocation) {
        await apiClient.patch(`/locations/${editingLocation.id}`, form);
      } else {
        await apiClient.post('/locations', form);
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

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Точки</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map(loc => (
            <div key={loc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => openModal(loc)}
                  className="text-gray-400 hover:text-blue-600 bg-gray-50 p-2 rounded-lg"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <MapPin size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{loc.name}</h3>
              <p className="text-sm text-gray-500 mb-4 h-10">{loc.address || 'Адрес не указан'}</p>
              
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-100">
                <div className="font-semibold text-gray-700 mb-2">r_keeper категории:</div>
                <div className="flex justify-between py-1">
                  <span>Кальяны:</span>
                  <span className="font-mono bg-gray-200 px-1 rounded">{loc.r_keeper_mapping.hookah_category_id || '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Замены:</span>
                  <span className="font-mono bg-gray-200 px-1 rounded">{loc.r_keeper_mapping.replacement_category_id || '—'}</span>
                </div>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100">
              Точки не найдены
            </div>
          )}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingLocation ? "Редактировать точку" : "Новая точка"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название точки</label>
            <input 
              required
              value={form.name}
              onChange={e => setForm(prev => ({...prev, name: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
            <input 
              value={form.address}
              onChange={e => setForm(prev => ({...prev, address: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div className="pt-2">
            <h4 className="text-sm font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">Маппинг r_keeper</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ключ категории кальянов (prompt hint)</label>
                <input 
                  value={form.r_keeper_mapping.hookah_category_id}
                  onChange={e => setForm(prev => ({...prev, r_keeper_mapping: {...prev.r_keeper_mapping, hookah_category_id: e.target.value}}))}
                  placeholder="Например: Кальяны, Hookah"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ключ категории замен (prompt hint)</label>
                <input 
                  value={form.r_keeper_mapping.replacement_category_id}
                  onChange={e => setForm(prev => ({...prev, r_keeper_mapping: {...prev.r_keeper_mapping, replacement_category_id: e.target.value}}))}
                  placeholder="Например: Замены, Replace"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" 
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Эти ключи используются ИИ (Gemini) для правильного парсинга фото отчетов из r_keeper на этой точке.</p>
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
