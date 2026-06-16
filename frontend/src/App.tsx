import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getProfile } from './lib/localStorage';

import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import LogActivity from './pages/LogActivity';
import Insights from './pages/Insights';
import Trends from './pages/Trends';
import Journey from './pages/Journey';
import Report from './pages/Report';
import AskClimate from './pages/AskClimate';
import Onboarding from './pages/Onboarding';

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOnboarding = location.pathname === '/onboarding';
  const isLog = location.pathname === '/log';

  useEffect(() => {
    const profile = getProfile();
    if (!profile && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate]);

  if (isOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <TopBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/log" element={<LogActivity />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/report" element={<Report />} />
        <Route path="/ask" element={<AskClimate />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
      <BottomNav />
      {!isLog && (
        <Link to="/log" className="fab" aria-label="Log activity">
          <Plus size={28} />
        </Link>
      )}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
