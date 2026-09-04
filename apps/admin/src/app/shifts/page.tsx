'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/api/client';
import { Loader2, Edit2, AlertTriangle, Eye, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);

  // Correction Form
  const [form, setForm] = useState({
    final_hookahs: 0,
    final_replacements: 0,
    correction_reason: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await apiClient.get('/shifts'); // In a real app this would have pagination or filters
      if (res.ok) setShifts(res.data.shifts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const openModal = (shift: any) => {
    setEditingShift(shift);
    setForm({
      final_hookahs: shift.final_hookahs || shift.ai_parsed_hookahs || 0,
      final_replacements: shift.final_replacements || shift.ai_parsed_replacements || 0,
      correction_reason: ''
    });
    setIsModalOpen(true);
  };

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await apiClient.post(`/shifts/${editingShift.id}/correction`, form);
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении корректировки');
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusBadge = (status: string, isAnomalous: boolean) => {
    if (isAnomalous && status === 'CLOSED') {
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-semibold">
          <AlertTriangle size={14} /> Аномалия
        </span>
      );
    }
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold"><Clock size={14} /> Открыта</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-semibold"><Loader2 size={14} className="animate-spin" /> Обработка ИИ</span>;
      case 'CLOSED':
        return <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold"><CheckCircle size={14} /> Закрыта</span>;
      case 'CORRECTED':
        return <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-semibold"><Edit2 size={14} /> Скорректирована</span>;
      default:
        return <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Управление сменами</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600">Дата / Точка</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Мастера</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Статус</th>
                <th className="px-6 py-4 font-semibold text-gray-600">К/З</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map(shift => (
                <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{shift.location_name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {shift.start_time ? format(new Date(shift.start_time), 'dd.MM.yyyy HH:mm') : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{shift.first_master_name}</div>
                    {shift.second_master_name && <div className="text-gray-500 text-xs">+ {shift.second_master_name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(shift.status, shift.is_anomalous)}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-mono">
                    {shift.final_hookahs ?? shift.ai_parsed_hookahs ?? '—'} / {shift.final_replacements ?? shift.ai_parsed_replacements ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openModal(shift)}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                      >
                        <Edit2 size={14} /> Правка
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Смены не найдены
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
        title="Корректировка смены"
      >
        {editingShift && (
          <form onSubmit={handleCorrection} className="space-y-5">
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-gray-500 block mb-1">Точка</span>
                  <span className="font-medium">{editingShift.location_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Мастера</span>
                  <span className="font-medium">{editingShift.first_master_name} {editingShift.second_master_name ? `и ${editingShift.second_master_name}` : ''}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                <div>
                  <span className="text-gray-500 block mb-1">ИИ Кальяны</span>
                  <span className="font-mono text-gray-900">{editingShift.ai_parsed_hookahs ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">ИИ Замены</span>
                  <span className="font-mono text-gray-900">{editingShift.ai_parsed_replacements ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фактические Кальяны</label>
                <input 
                  type="number"
                  required
                  min="0"
                  value={form.final_hookahs}
                  onChange={e => setForm(prev => ({...prev, final_hookahs: parseInt(e.target.value) || 0}))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фактические Замены</label>
                <input 
                  type="number"
                  required
                  min="0"
                  value={form.final_replacements}
                  onChange={e => setForm(prev => ({...prev, final_replacements: parseInt(e.target.value) || 0}))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Причина корректировки</label>
              <textarea 
                required
                value={form.correction_reason}
                onChange={e => setForm(prev => ({...prev, correction_reason: e.target.value}))}
                placeholder="Опишите, почему значения ИИ были неверны..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none" 
              />
            </div>

            {editingShift.r_keeper_report_image_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Отчет r_keeper</label>
                <img 
                  src={editingShift.r_keeper_report_image_url} 
                  alt="r_keeper report" 
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}

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
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center min-w-[150px] transition-colors"
              >
                {formLoading ? <Loader2 className="animate-spin" size={18} /> : 'Сохранить правки'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
