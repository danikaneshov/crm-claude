import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Wallet, Loader2 } from 'lucide-react';
import type { SalarySummary } from '@crm/shared';

export function SalaryScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salary, setSalary] = useState<SalarySummary | null>(null);

  useEffect(() => {
    async function fetchSalary() {
      try {
        const now = new Date();
        const res = await apiClient.get('/salary', {
          params: { year: now.getFullYear(), month: now.getMonth() + 1 },
        });
        if (res.ok) {
          setSalary(res.data.salary);
        } else {
          setError(res.error);
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    fetchSalary();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tg-button" />
      </div>
    );
  }

  if (error || !salary) {
    return (
      <div className="text-center text-tg-destructive p-4">
        {error || 'Данные не найдены'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-tg-button to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2 opacity-90">
          <Wallet size={20} />
          <span className="text-sm font-medium">Зарплата за текущий месяц</span>
        </div>
        <div className="text-4xl font-bold mb-4">
          {salary.total_earned.toLocaleString()} ₸
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <div className="text-xs opacity-80 mb-1">Всего смен</div>
            <div className="font-semibold">{salary.total_shifts}</div>
          </div>
          <div>
            <div className="text-xs opacity-80 mb-1">Кальяны / Замены</div>
            <div className="font-semibold">{salary.total_hookahs} / {salary.total_replacements}</div>
          </div>
        </div>
      </div>

      <h3 className="font-bold text-tg-text mt-4 mb-2 px-1">Детализация</h3>
      
      <div className="space-y-3">
        {salary.shifts.map(shift => (
          <div key={shift.shift_id} className="bg-tg-section rounded-xl p-4 border border-tg-hint/10 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-tg-text">{shift.location_name}</div>
                <div className="text-xs text-tg-hint">{shift.date} • {shift.is_second_master ? 'Напарник' : 'Соло/Первый'}</div>
              </div>
              <div className="font-bold text-green-500">+{shift.salary.toLocaleString()} ₸</div>
            </div>
            <div className="flex gap-4 text-xs text-tg-hint mt-1">
              <span>Кальянов: {shift.hookahs}</span>
              <span>Замен: {shift.replacements}</span>
            </div>
          </div>
        ))}
        {salary.shifts.length === 0 && (
          <div className="text-center text-tg-hint py-8">
            В этом месяце еще не было смен.
          </div>
        )}
      </div>
    </div>
  );
}
