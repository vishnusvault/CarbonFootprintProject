import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function getBestStreak(activities: Activity[], dailyAvg: number): number {
  if (!activities.length) return 0;
  const dayMap: Record<string, number> = {};
  for (const a of activities) {
    dayMap[a.date] = (dayMap[a.date] ?? 0) + a.co2e_kg;
  }
  const sortedDays = Object.keys(dayMap).sort();
  let best = 0;
  let current = 0;
  let prevDate: Date | null = null;
  for (const day of sortedDays) {
    const d = new Date(day);
    const isConsecutive = prevDate && (d.getTime() - prevDate.getTime()) === 86400000;
    const isBelowAvg = dayMap[day] < dailyAvg;
    if (isBelowAvg && isConsecutive) {
      current++;
    } else if (isBelowAvg) {
      current = 1;
    } else {
      current = 0;
    }
    if (current > best) best = current;
    prevDate = d;
  }
  return best;
}

export default function Journey() {
  const navigate = useNavigate();
  const allActivities = getActivities();

  const consciousActivities = allActivities.filter((a: Activity) => a.conscious_swap);
  const totalAvoided = consciousActivities.reduce((s: number, a: Activity) => s + (a.co2_avoided_kg ?? 0), 0);
  const swapCount = consciousActivities.length;

  const totalCO2 = allActivities.reduce((s: number, a: Activity) => s + a.co2e_kg, 0);
  const daysWithData = new Set(allActivities.map((a: Activity) => a.date)).size;
  const dailyAvg = daysWithData > 0 ? totalCO2 / daysWithData : 0;

  const bestStreak = useMemo(() => getBestStreak(allActivities, dailyAvg), [allActivities, dailyAvg]);

  // Monthly comparison
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;

  const thisMonthTotal = allActivities
    .filter((a: Activity) => getMonthKey(a.date) === thisMonthKey)
    .reduce((s: number, a: Activity) => s + a.co2e_kg, 0);
  const lastMonthTotal = allActivities
    .filter((a: Activity) => getMonthKey(a.date) === lastMonthKey)
    .reduce((s: number, a: Activity) => s + a.co2e_kg, 0);

  const monthDelta = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

  // Metaphors
  const flightsToDelhiEquiv = (totalAvoided / 0.255).toFixed(1); // ~0.255 kg per 100km, ~255kg Mumbai-Delhi
  const treesEquiv = (totalAvoided / 21).toFixed(1); // avg tree absorbs ~21kg/year

  // Avoided CO2 bar chart - last 6 months
  const monthKeys = getLast6MonthKeys();
  const avoidedChartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const { key } of monthKeys) grouped[key] = 0;
    for (const a of consciousActivities) {
      const key = getMonthKey(a.date);
      if (grouped[key] !== undefined) {
        grouped[key] += a.co2_avoided_kg ?? 0;
      }
    }
    return monthKeys.map(({ key, label }) => ({
      month: label,
      avoided: parseFloat(grouped[key].toFixed(2)),
    }));
  }, [consciousActivities, monthKeys]);

  return (
    <main className="page">
      <h1 className="page-title">My Impact Journey</h1>
      <p className="page-subtitle">Track your progress towards a greener lifestyle.</p>

      {allActivities.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <p className="empty-title">Your journey begins here</p>
            <p className="empty-desc">Log activities and make conscious swaps to build your impact story.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key stats */}
          <div className="row section">
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-600)' }}>
                {totalAvoided.toFixed(1)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                kg CO₂ avoided
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-800)' }}>
                {swapCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                conscious swaps
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-700)' }}>
                {bestStreak}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                day best streak
              </div>
            </div>
          </div>

          {/* Monthly trend */}
          {lastMonthTotal > 0 && (
            <div className="card section">
              <div className="section-title">Monthly Trend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                    {monthDelta > 5 ? (
                      <span className="delta-up">▲ {monthDelta.toFixed(0)}% this month</span>
                    ) : monthDelta < -5 ? (
                      <span className="delta-down">▼ {Math.abs(monthDelta).toFixed(0)}% less this month 🎉</span>
                    ) : (
                      <span className="delta-flat">→ Similar to last month</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                This month: {thisMonthTotal.toFixed(1)} kg · Last month: {lastMonthTotal.toFixed(1)} kg
              </div>
            </div>
          )}

          {/* Metaphor equivalents */}
          {totalAvoided > 0 && (
            <div className="card section" style={{ background: 'linear-gradient(135deg, var(--green-50), #f0faf2)', border: '1.5px solid var(--green-200)' }}>
              <div className="section-title">🌍 What You've Avoided</div>
              <div className="stack">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '1.5rem' }}>✈️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      = Not taking {flightsToDelhiEquiv} flights to Delhi
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Based on Mumbai–Delhi route (~255 kg CO₂e)
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                  <span style={{ fontSize: '1.5rem' }}>🌳</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      = {treesEquiv} trees absorbing CO₂ for a year
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Average tree absorbs ~21 kg CO₂/year
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Avoided CO2 chart */}
          <div className="card section">
            <div className="section-title">CO₂ Avoided per Month (kg)</div>
            {swapCount === 0 ? (
              <div className="text-center space-y-3 py-6" style={{ textAlign: 'center', padding: '24px 0' }}>
                <p className="text-gray-500" style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Make conscious swaps when logging activities to see this chart!
                  <br /><br />
                  <span style={{ fontSize: '0.85rem' }}>When you log a transport activity and tap 'Yes, I considered this', the CO₂ you avoided is tracked here.</span>
                </p>
                <button onClick={() => navigate('/log')} className="btn btn-primary" type="button">
                  + Log an Activity
                </button>
              </div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={avoidedChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(2)} kg CO₂e`, 'Avoided']}
                      contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                    />
                    <Bar dataKey="avoided" fill="var(--green-400)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
