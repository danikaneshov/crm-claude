import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthLoader } from './screens/AuthLoader';
import { ShiftScreen } from './screens/ShiftScreen';
import { SalaryScreen } from './screens/SalaryScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { useEffect } from 'react';
import { init } from '@telegram-apps/sdk-react';

function App() {
  useEffect(() => {
    try {
      init();
    } catch (e) {
      console.warn('Could not init Telegram SDK:', e);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthLoader>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ShiftScreen />} />
            <Route path="salary" element={<SalaryScreen />} />
            <Route path="history" element={<HistoryScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthLoader>
    </BrowserRouter>
  );
}

export default App;
