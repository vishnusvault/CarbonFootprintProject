import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import BudgetRing from '../components/BudgetRing';
import {
  getActivities,
  getTodayActivities,
  getWeekActivities,
  getMonthActivities,
  getTimeframe,
  saveTimeframe,
  deleteActivity,
} from '../lib/localStorage';
import { getDisplayName } from '../lib/activityDisplayNames';
import type { Activity } from '../lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  transport: '#1B6B3A',
  energy: '#3aaa63',
  food: '#4CAF50',
  purchase: '#a8e6b3',
};

const CATEGORY_ICONS: Record<string, string> = {
  transport: '🚗',
  energy: '⚡',
  food: '🥗',
  purchase: '🛍',
};

type Timeframe = 'daily' | 'weekly' | 'monthly';

function getActivitiesForTimeframe(tf: Timeframe): Activity[] {
  if (tf === 'daily') return getTodayActivities();
  if (tf === 'weekly') return getWeekActivities();
  return getMonthActivities();
}

function getPreviousPeriodTotal(tf: Timeframe): number {
  const allActivities = getActivities();
  const now = new Date();

  if (tf === 'daily') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    return allActivities.filter((a) => a.date === yStr).reduce((s, a) => s + a.co2e_kg, 0);
  }
  if (tf === 'weekly') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(monday);
    lastSunday.setDate(monday.getDate() - 1);
    const from = lastMonday.toISOString().split('T')[0];
    const to = lastSunday.toISOString().split('T')[0];
    return allActivities.filter((a) => a.date >= from && a.date <= to).reduce((s, a) => s + a.co2e_kg, 0);
  }
  // monthly
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(firstThisMonth.getTime() - 86400000);
  const from = firstLastMonth.toISOString().split('T')[0];
  const to = lastDayLastMonth.toISOString().split('T')[0];
  return allActivities.filter((a) => a.date >= from && a.date <= to).reduce((s, a) => s + a.co2e_kg, 0);
}

function buildCategoryData(activities: Activity[]) {
  const cats: Record<string, number> = { transport: 0, energy: 0, food: 0, purchase: 0 };
  for (const a of activities) {
    if (cats[a.category] !== undefined) cats[a.category] += a.co2e_kg;
  }
  return Object.entries(cats)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
}

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>(getTimeframe);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prevTotal, setPrevTotal] = useState(0);

  const loadData = useCallback(() => {
    setActivities(getActivitiesForTimeframe(timeframe));
    setPrevTotal(getPreviousPeriodTotal(timeframe));
  }, [timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleTimeframe(tf: Timeframe) {
    setTimeframe(tf);
    saveTimeframe(tf);
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this activity?')) {
      deleteActivity(id);
      loadData();
    }
  }

  const total = activities.reduce((s, a) => s + a.co2e_kg, 0);
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const categoryData = buildCategoryData(activities);
  const biggest = activities.reduce<Activity | null>(
    (max, a) => (!max || a.co2e_kg > max.co2e_kg ? a : max),
    null
  );
  const recent = [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  // Benchmark (daily equivalent)
  const benchmarks = {
    daily:   { india: 5.2,  global: 12.9 },
    weekly:  { india: 36.4, global: 90.3 },
    monthly: { india: 158,  global: 392  },
  };

  const labels = {
    daily:   "vs Daily Averages",
    weekly:  "vs Weekly Averages",
    monthly: "vs Monthly Averages",
  };

  const indiaAvg = benchmarks[timeframe].india;
  const globalAvg = benchmarks[timeframe].global;
  
  const indiaPercent = Math.min((total / (globalAvg * 1.5)) * 100, 100);
  const indiaRefPercent = Math.min((indiaAvg / (globalAvg * 1.5)) * 100, 100);
  const globalRefPercent = Math.min((globalAvg / (globalAvg * 1.5)) * 100, 100);

  return (
    <main className="page">
      {/* Timeframe switcher */}
      <div className="timeframe-switcher" style={{ marginBottom: 20 }}>
        {(['daily', 'weekly', 'monthly'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            className={`timeframe-btn${timeframe === tf ? ' active' : ''}`}
            onClick={() => handleTimeframe(tf)}
            type="button"
          >
            {tf.charAt(0).toUpperCase() + tf.slice(1)}
          </button>
        ))}
      </div>

      {/* Hero Stat */}
      <div className="hero-stat" style={{ marginBottom: 20 }}>
        <div className="hero-stat-label">
          {timeframe === 'daily' ? "Today's" : timeframe === 'weekly' ? "This Week's" : "This Month's"} Carbon Footprint
        </div>
        <div className="hero-stat-value">{total.toFixed(1)}</div>
        <div className="hero-stat-unit">kg CO₂e</div>
        {prevTotal > 0 && (
          <div className="hero-stat-delta">
            {delta > 5 ? (
              <><TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />{delta.toFixed(0)}% vs last period</>
            ) : delta < -5 ? (
              <><TrendingDown size={14} style={{ display: 'inline', marginRight: 4 }} />{Math.abs(delta).toFixed(0)}% less than last period 🎉</>
            ) : (
              <><Minus size={14} style={{ display: 'inline', marginRight: 4 }} />Similar to last period</>
            )}
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🌿</div>
            <p className="empty-title">No activities yet</p>
            <p className="empty-desc">Start logging your daily activities to track your carbon footprint.</p>
            <Link to="/log" className="btn btn-primary btn-lg">
              <PlusCircle size={20} /> Log Activity
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Donut Chart */}
          {categoryData.length > 0 && (
            <div className="card section">
              <div className="section-title">By Category</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#ccc'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(2)} kg CO₂e`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  {categoryData.map((entry) => (
                    <div key={entry.name} className="legend-item">
                      <div className="legend-dot" style={{ background: CATEGORY_COLORS[entry.name] }} />
                      {CATEGORY_ICONS[entry.name]} {entry.name.charAt(0).toUpperCase() + entry.name.slice(1)} — {entry.value} kg
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

      <BudgetRing />

          {/* Biggest contributor */}
          {biggest && (
            <div className="section">
              <div className="section-title">Biggest Contributor</div>
              <div className={`contributor-card${biggest.co2e_kg < 2 ? ' low' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.6rem' }}>{CATEGORY_ICONS[biggest.category]}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {getDisplayName(biggest.activity_type)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{biggest.date}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1.1rem', color: 'var(--green-800)' }}>
                    {biggest.co2e_kg.toFixed(2)} kg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benchmarks */}
          <div className="section">
            <div className="section-title">Benchmark ({labels[timeframe]})</div>
            <div className="stack">
              <div className="benchmark">
                <span className="benchmark-label">Your total this {timeframe === 'daily' ? 'day' : timeframe.replace('ly', '')}</span>
                <div className="benchmark-bar-wrap">
                  <div
                    className="benchmark-bar"
                    style={{ width: `${indiaPercent}%`, background: 'var(--green-600)' }}
                  />
                </div>
                <span className="benchmark-value">{total.toFixed(1)} kg</span>
              </div>
              <div className="benchmark">
                <span className="benchmark-label">India avg</span>
                <div className="benchmark-bar-wrap">
                  <div
                    className="benchmark-bar"
                    style={{ width: `${indiaRefPercent}%`, background: 'var(--amber)' }}
                  />
                </div>
                <span className="benchmark-value">{indiaAvg} kg</span>
              </div>
              <div className="benchmark">
                <span className="benchmark-label">Global avg</span>
                <div className="benchmark-bar-wrap">
                  <div
                    className="benchmark-bar"
                    style={{ width: `${globalRefPercent}%`, background: 'var(--red)' }}
                  />
                </div>
                <span className="benchmark-value" style={{ color: 'var(--red)' }}>{globalAvg} kg</span>
              </div>
            </div>
            <p className="form-hint" style={{ marginTop: 8 }}>
              India avg: {indiaAvg} kg · Global avg: {globalAvg} kg (World Bank 2023)
            </p>
          </div>

          {/* Recent Activities */}
          <div className="section">
            <div className="section-title">Recent Activities</div>
            <div className="card" style={{ padding: '8px 16px' }}>
              {recent.map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="activity-icon">{CATEGORY_ICONS[a.category]}</div>
                  <div className="activity-info">
                    <div className="activity-name">
                      {getDisplayName(a.activity_type)}
                      {a.conscious_swap && (
                        <span className="conscious-badge" style={{ marginLeft: 6 }}>♻️ conscious</span>
                      )}
                    </div>
                    <div className="activity-meta">
                      {a.date}
                      {a.origin && a.destination ? ` · ${a.origin} → ${a.destination}` : ` · ${a.quantity} ${a.unit}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="activity-co2">{a.co2e_kg.toFixed(2)} kg</div>
                    <button 
                      onClick={() => handleDelete(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem', opacity: 0.5 }}
                      aria-label="Delete activity"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
