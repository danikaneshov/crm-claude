import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Clock, Loader2, AlertCircle } from 'lucide-react';

export function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await apiClient.get('/shifts');
        if (res.ok) {
          setShifts(res.data.shifts);
        } else {
          setError(res.error);
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tg-button" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-tg-destructive p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Clock className="text-tg-button" size={24} />
        <h2 className="text-2xl font-bold text-tg-text">История смен</h2>
      </div>

      <div className="space-y-3">
        {shifts.map(shift => (
          <div key={shift.id} className="bg-tg-section rounded-xl p-4 border border-tg-hint/10 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start border-b border-tg-hint/10 pb-3">
              <div>
                <div className="font-bold text-tg-text">{shift.location_name}</div>
                <div className="text-xs text-tg-hint mt-1">{shift.date} • {shift.is_second_master ? 'Напарник' : 'Первый мастер'}</div>
              </div>
              <StatusBadge status={shift.status} isAnomalous={shift.is_anomalous} />
            </div>
            
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="text-xs text-tg-hint">Кальянов: <span className="text-tg-text font-medium">{shift.final_hookahs ?? '—'}</span></div>
                <div className="text-xs text-tg-hint">Замен: <span className="text-tg-text font-medium">{shift.final_replacements ?? '—'}</span></div>
              </div>
              
              <div className="text-right">
                <div className="text-xs text-tg-hint mb-1">Зарплата</div>
                <div className="font-bold text-green-500">
                  {shift.is_second_master 
                    ? (shift.second_master_salary ? `+${shift.second_master_salary} ₸` : '—') 
                    : (shift.first_master_salary ? `+${shift.first_master_salary} ₸` : '—')}
                </div>
              </div>
            </div>
          </div>
        ))}
        {shifts.length === 0 && (
          <div className="text-center text-tg-hint py-8">
            История пуста
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, isAnomalous }: { status: string; isAnomalous: boolean }) {
  if (isAnomalous && status === 'CLOSED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-500 rounded-md text-[10px] font-bold uppercase">
        <AlertCircle size={12} /> Аномалия
      </span>
    );
  }

  switch (status) {
    case 'OPEN':
    case 'PROCESSING':
      return <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-bold uppercase">В процессе</span>;
    case 'CLOSED':
      return <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-md text-[10px] font-bold uppercase">Закрыта</span>;
    case 'CORRECTED':
      return <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded-md text-[10px] font-bold uppercase">Исправлена</span>;
    case 'ERROR':
      return <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-[10px] font-bold uppercase">Ошибка</span>;
    default:
      return <span className="px-2 py-1 bg-gray-500/10 text-gray-500 rounded-md text-[10px] font-bold uppercase">{status}</span>;
  }
}
