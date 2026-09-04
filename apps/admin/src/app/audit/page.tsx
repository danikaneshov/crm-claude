'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/api/client';
import { Loader2, Activity, Shield, Edit2, PlayCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await apiClient.get('/audit'); // Should be paginated in a real app
        if (res.ok) setLogs(res.data.logs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'SHIFT_CORRECTION': return <Edit2 size={16} className="text-purple-500" />;
      case 'SHIFT_OPEN': return <PlayCircle size={16} className="text-blue-500" />;
      case 'REVISION_CREATED': return <Plus size={16} className="text-red-500" />;
      default: return <Activity size={16} className="text-gray-500" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Журнал действий</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600">Дата и время</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Действие</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Администратор</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Объект</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      {getActionIcon(log.action)}
                      {log.action}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Shield size={14} className="text-blue-600" />
                      {log.admin_email || 'Система'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                    {log.target_id || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <pre className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 max-w-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Журнал пуст
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
