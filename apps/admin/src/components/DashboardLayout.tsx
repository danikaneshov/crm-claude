'use client';

import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, MapPin, Clock, FileText, Activity, LogOut, Loader2 } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { getClientApp } from '@crm/firebase-config/client';
getClientApp();
import clsx from 'clsx';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleLogout = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    router.replace('/login');
  };

  const navItems = [
    { href: '/', label: 'Дашборд', icon: LayoutDashboard },
    { href: '/shifts', label: 'Смены', icon: Clock },
    { href: '/employees', label: 'Сотрудники', icon: Users },
    { href: '/locations', label: 'Точки', icon: MapPin },
    { href: '/revisions', label: 'Ревизии', icon: FileText },
    { href: '/audit', label: 'Журнал', icon: Activity },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">CRM Hookah</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon size={18} className={isActive ? 'text-blue-700' : 'text-gray-400'} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="px-3 mb-2 text-xs font-medium text-gray-500 truncate">
            {user.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            {navItems.find(i => i.href === pathname || (i.href !== '/' && pathname.startsWith(i.href)))?.label || 'CRM'}
          </h2>
        </header>
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
