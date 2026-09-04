'use client';

import { DashboardLayout } from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const now = new Date();
        const res = await apiClient.get('/admin/dashboard', {
          params: { year: now.getFullYear(), month: now.getMonth() + 1 },
        });
        if (res.ok) {
          setData(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-red-500">Ошибка загрузки дашборда.</div>
      </DashboardLayout>
    );
  }

  const { stats, charts } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Всего продаж (₸)" value={stats.total_sales.toLocaleString()} />
          <StatCard title="Кальянов / Замен" value={`${stats.total_hookahs} / ${stats.total_replacements}`} />
          <StatCard title="Смен за месяц" value={stats.total_shifts} />
          <StatCard title="Фонд ЗП (₸)" value={stats.total_salary_fund.toLocaleString()} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Динамика продаж</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.daily_sales}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => val.split('-').slice(1).join('.')} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{fill: '#6b7280', fontSize: 12}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{fill: '#6b7280', fontSize: 12}}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="sales" name="Продажи (₸)" stroke="#2563eb" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Выручка по мастерам</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.master_stats} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 12}} width={100} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{fill: '#f8fafc'}}
                  />
                  <Bar dataKey="sales" name="Продажи (₸)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="text-sm font-medium text-gray-500 mb-2">{title}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
