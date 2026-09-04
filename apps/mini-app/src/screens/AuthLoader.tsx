import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from '../api/client';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

interface AuthLoaderProps {
  children: React.ReactNode;
}

export function AuthLoader({ children }: AuthLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const token = useAuthStore(state => state.token);
  const setAuth = useAuthStore(state => state.setAuth);

  useEffect(() => {
    async function authenticate() {
      try {
        let initData = '';
        
        try {
          // Attempt to get initData from Telegram SDK
          const lp = retrieveLaunchParams();
          initData = lp.initDataRaw || '';
        } catch (e) {
          // Development fallback or not in Telegram
          console.warn('Not in Telegram environment or missing initData');
        }

        if (!initData) {
          if (import.meta.env.DEV) {
            // Development fallback mock initData if needed, or fail
            setError('No Telegram initData found (Local dev requires mocking)');
          } else {
            setError('Please open this app from Telegram.');
          }
          setLoading(false);
          return;
        }

        const res = await apiClient.post('/auth/telegram', { initData });
        if (res.ok && res.data) {
          setAuth(res.data.token, res.data.employee);
        } else {
          setError(res.error || 'Authentication failed');
        }
      } catch (err: any) {
        setError(err.message || 'Authentication error');
      } finally {
        setLoading(false);
      }
    }

    // Only authenticate if we don't have a token, or if we want to refresh on every load
    // It's safer to re-auth on every full reload to verify access
    authenticate();
  }, [setAuth]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-tg-button border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 text-center">
        <div className="text-tg-destructive mb-4 text-4xl">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Ошибка доступа</h2>
        <p className="text-tg-hint">{error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
