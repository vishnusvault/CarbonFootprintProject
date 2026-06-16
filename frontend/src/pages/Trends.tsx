import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getActivities } from '../lib/localStorage';
import type { Activity } from '../lib/api';

type CategoryFilter = 'all' | 'transport' | 'energy' | 'food' | 'purchase';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function getLast6MonthKeys(): { key: string; label: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS[d.getMonth()],
    });
  }
  return result;
}

export default function Trends() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const allActivities = getActivities();

  const filtered = useMemo(
    () => (filter === 'all' ? allActivities : allActivities.filter((a: Activity) => a.category === filter)),
    [allActivities, filter]
  );

  const monthKeys = getLast6MonthKeys();

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const { key } of monthKeys) grouped[key] = 0;
    for (const a of filtered) {
      const key = getMonthKey(a.date);
      if (grouped[key] !== undefined) {
        grouped[key] += a.co2e_kg;
      }
    }
    return monthKeys.map(({ key, label }) => ({
      month: label,
      co2: parseFloat(grouped[key].toFixed(2)),
    }));
  }, [filtered, monthKeys]);

  // Week-on-week delta
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  const thisWeekTotal = filtered
    .filter((a: Activity) => {
      const d = a.date;
      return d >= thisWeekStart.toISOString().split('T')[0] && d <= now.toISOString().split('T')[0];
    })
    .reduce((s: number, a: Activity) => s + a.co2e_kg, 0);

  const lastWeekTotal = filtered
    .filter((a: Activity) => {
      const d = a.date;
      return d >= lastWeekStart.toISOString().split('T')[0] && d <= lastWeekEnd.toISOString().split('T')[0];
    })
    .reduce((s: number, a: Activity) => s + a.co2e_kg, 0);

  const weekDelta = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

  const FILTERS: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'transport', label: '🚗 Transport' },
    { value: 'energy', label: '⚡ Energy' },
    { value: 'food', label: '🥗 Food' },
    { value: 'purchase', label: '🛍 Purchase' },
  ];

  return (
    <main className="page">
      <h1 className="page-title">Trends</h1>
      <p className="page-subtitle">Your carbon footprint over the last 6 months.</p>

      {/* Week-on-week badge */}
      {lastWeekTotal > 0 && (
        <div className="card section" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Week-on-Week
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {weekDelta > 0 ? (
                <span className="delta-up">▲ {weekDelta.toFixed(0)}%</span>
              ) : weekDelta < 0 ? (
                <span className="delta-down">▼ {Math.abs(weekDelta).toFixed(0)}%</span>
              ) : (
                <span className="delta-flat">— no change</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            This week: {thisWeekTotal.toFixed(1)} kg
            <br />
            Last week: {lastWeekTotal.toFixed(1)} kg
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            className={`btn btn-sm${filter === value ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="card section">
        <div className="section-title">Monthly CO₂e (kg)</div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📉</div>
            <p className="empty-title">No data yet</p>
            <p className="empty-desc">Start logging activities to see your trends.</p>
          </div>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(2)} kg CO₂e`, 'Emissions']}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
                <Bar dataKey="co2" fill="var(--green-600)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Link to Journey */}
      <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 12 }}>
          🌟 See your full impact journey and conscious swaps
        </p>
        <Link to="/journey" className="btn btn-secondary btn-full">
          View My Journey →
        </Link>
      </div>
    </main>
  );
}
