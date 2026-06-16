import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { getWeekActivities } from '../lib/localStorage';

export default function TopBar() {
  const [weekCO2, setWeekCO2] = useState(0);

  useEffect(() => {
    const activities = getWeekActivities();
    const total = activities.reduce((sum, a) => sum + a.co2e_kg, 0);
    setWeekCO2(total);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <div className="topbar-logo-icon">
          <Leaf size={18} color="white" />
        </div>
        <span className="topbar-logo-name">CarbonLens</span>
      </div>
      <div className="topbar-badge">
        🌍 {weekCO2.toFixed(1)} kg this week
      </div>
    </header>
  );
}
