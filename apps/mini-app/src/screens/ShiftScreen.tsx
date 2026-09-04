import { useEffect, useState, useRef } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { useAuthStore } from '../store/useAuthStore';
import { Camera, Users, PlayCircle, Loader2, CheckCircle2 } from 'lucide-react';

export function ShiftScreen() {
  const { currentShift, fetchCurrentShift, loading, error } = useShiftStore();

  useEffect(() => {
    fetchCurrentShift();
  }, [fetchCurrentShift]);

  if (loading && !currentShift) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-tg-button" />
      </div>
    );
  }

  if (currentShift) {
    return <ActiveShiftView />;
  }

  return <OpenShiftForm />;
}

function OpenShiftForm() {
  const { locations, colleagues, fetchLocations, fetchColleagues, openShift, loading, error } = useShiftStore();
  const { selectedLocationId, setLocation } = useAuthStore();
  
  const [isDuo, setIsDuo] = useState(false);
  const [secondMasterId, setSecondMasterId] = useState<string>('');

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchColleagues(selectedLocationId);
    }
  }, [selectedLocationId, fetchColleagues]);

  const handleOpen = () => {
    if (!selectedLocationId) return;
    openShift(selectedLocationId, isDuo ? secondMasterId || null : null);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-tg-text">Открытие смены</h2>
        <p className="text-tg-hint text-sm">Выберите точку и формат работы</p>
      </div>

      {error && (
        <div className="bg-tg-destructive/10 text-tg-destructive p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-tg-hint">Локация</label>
          <select 
            className="w-full bg-tg-section border border-tg-hint/20 rounded-xl p-3 text-tg-text outline-none focus:border-tg-button transition-colors appearance-none"
            value={selectedLocationId || ''}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="" disabled>Выберите точку</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-tg-hint">Формат работы</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setIsDuo(false); setSecondMasterId(''); }}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${!isDuo ? 'border-tg-button bg-tg-button/10 text-tg-button font-medium' : 'border-tg-hint/20 text-tg-text bg-tg-section'}`}
            >
              Соло
            </button>
            <button
              onClick={() => setIsDuo(true)}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isDuo ? 'border-tg-button bg-tg-button/10 text-tg-button font-medium' : 'border-tg-hint/20 text-tg-text bg-tg-section'}`}
            >
              <Users size={18} />
              Вдвоем
            </button>
          </div>
        </div>

        {isDuo && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-sm font-medium text-tg-hint">Второй мастер</label>
            <select 
              className="w-full bg-tg-section border border-tg-hint/20 rounded-xl p-3 text-tg-text outline-none focus:border-tg-button transition-colors appearance-none"
              value={secondMasterId}
              onChange={(e) => setSecondMasterId(e.target.value)}
            >
              <option value="" disabled>Выберите напарника</option>
              {colleagues.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        onClick={handleOpen}
        disabled={!selectedLocationId || (isDuo && !secondMasterId) || loading}
        className="mt-4 w-full bg-tg-button text-tg-button-text py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-tg-button/20"
      >
        {loading ? <Loader2 className="animate-spin" size={20} /> : <PlayCircle size={20} />}
        Начать смену
      </button>
    </div>
  );
}

function ActiveShiftView() {
  const { currentShift, closeShift, loading, error, fetchCurrentShift } = useShiftStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-in zoom-in duration-500">
        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-2xl font-bold text-tg-text mb-2">Смена закрыта!</h2>
        
        <div className="w-full bg-tg-section rounded-2xl p-4 mb-6 shadow-sm border border-tg-hint/10">
          <div className="flex justify-between py-2 border-b border-tg-hint/10">
            <span className="text-tg-hint">Кальяны</span>
            <span className="font-bold text-tg-text">{successResult.results.total_sales.hookahs}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-tg-hint/10">
            <span className="text-tg-hint">Замены</span>
            <span className="font-bold text-tg-text">{successResult.results.total_sales.replacements}</span>
          </div>
          <div className="flex justify-between py-2 mt-2">
            <span className="text-tg-hint">Ваша зарплата</span>
            <span className="font-bold text-green-500">{successResult.results.first_master.salary} ₸</span>
          </div>
          {successResult.results.second_master && (
            <div className="flex justify-between py-2">
              <span className="text-tg-hint">Зарплата напарника</span>
              <span className="font-bold text-green-500">{successResult.results.second_master.salary} ₸</span>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => { setSuccessResult(null); fetchCurrentShift(); }}
          className="w-full bg-tg-button text-tg-button-text py-4 rounded-2xl font-bold active:scale-95 transition-all"
        >
          Отлично
        </button>
      </div>
    );
  }

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentShift) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const result = await closeShift(currentShift.id, base64String);
        setSuccessResult(result);
      } catch (e) {
        // Error handled in store
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex-1 space-y-6">
        <div className="text-center space-y-2 mt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-tg-button/10 text-tg-button rounded-full mb-2">
            <PlayCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-tg-text">Смена идёт</h2>
          <p className="text-tg-hint">{currentShift?.location_name}</p>
        </div>

        {error && (
          <div className="bg-tg-destructive/10 text-tg-destructive p-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <div className="bg-tg-section rounded-2xl p-4 shadow-sm border border-tg-hint/10">
          <div className="flex items-center justify-between py-2 border-b border-tg-hint/10">
            <span className="text-tg-hint text-sm">Напарник</span>
            <span className="text-tg-text font-medium">{currentShift?.second_master_name || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-tg-hint text-sm">Статус</span>
            <span className="text-tg-button font-medium">В процессе</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleCapture}
        />
        
        {currentShift?.is_second_master ? (
          <div className="bg-tg-section p-4 rounded-2xl text-center text-tg-hint text-sm border border-tg-hint/10">
            Только первый мастер может загрузить отчёт r_keeper и закрыть смену.
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="w-full bg-tg-text text-tg-bg py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Camera size={20} />
            )}
            {loading ? 'Обработка отчёта ИИ...' : 'Сфотографировать отчёт'}
          </button>
        )}
      </div>
    </div>
  );
}
