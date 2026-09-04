import { Outlet, NavLink } from 'react-router-dom';
import { Play, CheckCircle, Clock, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/useAuthStore';

export function Layout() {
  const employee = useAuthStore(state => state.employee);

  return (
    <div className="flex flex-col min-h-screen bg-tg-secondary pb-16">
      {/* Header */}
      <header className="bg-tg-header p-4 shadow-sm z-10 sticky top-0 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-tg-text">CRM Hookah</h1>
        {employee && (
          <span className="text-sm text-tg-hint font-medium">{employee.name}</span>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-tg-header border-t border-tg-hint/20 flex justify-around items-center p-2 pb-safe z-50">
        <NavItem to="/" icon={<Play size={24} />} label="Смена" />
        <NavItem to="/history" icon={<Clock size={24} />} label="История" />
        <NavItem to="/salary" icon={<Wallet size={24} />} label="Зарплата" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex flex-col items-center p-2 text-xs font-medium transition-colors',
          isActive ? 'text-tg-button' : 'text-tg-hint hover:text-tg-text'
        )
      }
    >
      <div className="mb-1">{icon}</div>
      {label}
    </NavLink>
  );
}
