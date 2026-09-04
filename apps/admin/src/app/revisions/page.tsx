'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/api/client';
import { Loader2, Plus, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function RevisionsPage() {
  const [revisions, setRevisions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    location_id: '',
    shortage_amount: 0,
    description: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [revRes, locRes] = await Promise.all([
        apiClient.get('/revisions'),
        apiClient.get('/locations')
      ]);
      if (revRes.ok) setRevisions(revRes.data.revisions);
      if (locRes.ok) setLocations(locRes.data.locations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const openModal = () => {
    setForm({ location_id: '', shortage_amount: 0, description: '' });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await apiClient.post('/revisions', form);
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении ревизии');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Ревизии</h2>
        <button 
          onClick={openModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Добавить недостачу
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {revisions.map(rev => (
            <div key={rev.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-3">
                <Calendar size={14} />
                {format(new Date(rev.created_at), 'dd.MM.yyyy HH:mm')}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{rev.location_name}</h3>
              <p className="text-sm text-gray-600 flex-1 mb-4">{rev.description || 'Без описания'}</p>
              
              <div className="bg-red-50 text-red-700 rounded-xl p-4 flex items-center justify-between border border-red-100">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <span className="text-sm font-semibold">Недостача</span>
                </div>
                <span className="font-bold text-lg">{rev.shortage_amount.toLocaleString()} ₸</span>
              </div>
            </div>
          ))}
          {revisions.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100">
              Ревизий не найдено
            </div>
          )}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Добавить ревизию (недостачу)"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Точка</label>
            <select 
              required
              value={form.location_id}
              onChange={e => setForm(prev => ({...prev, location_id: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="" disabled>Выберите точку</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сумма недостачи (₸)</label>
            <input 
              type="number"
              required
              min="0"
              value={form.shortage_amount || ''}
              onChange={e => setForm(prev => ({...prev, shortage_amount: parseInt(e.target.value) || 0}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание / Причина</label>
            <textarea 
              value={form.description}
              onChange={e => setForm(prev => ({...prev, description: e.target.value}))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none" 
              placeholder="Подробности недостачи..."
            />
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
              {formLoading ? <Loader2 className="animate-spin" size={18} /> : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
