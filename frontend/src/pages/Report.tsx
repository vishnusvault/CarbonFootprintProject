import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { getWeekActivities } from '../lib/localStorage';
import { getWeeklyReport } from '../lib/api';
import type { WeeklyReportResponse } from '../lib/api';

export default function Report() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<WeeklyReportResponse | null>(null);

  const weekActivities = getWeekActivities();

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await getWeeklyReport(weekActivities);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Weekly Report</h1>
      <p className="page-subtitle">Your personalised carbon footprint report for this week.</p>

      {/* Stats preview */}
      <div className="card section">
        <div className="section-title">This Week</div>
        <div className="row">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--green-800)' }}>
              {weekActivities.reduce((s, a) => s + a.co2e_kg, 0).toFixed(1)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>kg CO₂e</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--green-800)' }}>
              {weekActivities.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>activities</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--green-600)' }}>
              {weekActivities.filter((a) => a.conscious_swap).length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>swaps</div>
          </div>
        </div>
      </div>

      {weekActivities.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-title">No activities this week</p>
            <p className="empty-desc">Log some activities first to generate a weekly report.</p>
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleGenerate}
        disabled={loading || weekActivities.length === 0}
        type="button"
        style={{ marginBottom: 20 }}
      >
        {loading ? (
          <><Loader2 size={20} className="spin" /> Generating Report…</>
        ) : report ? (
          <><RefreshCw size={18} /> Regenerate Report</>
        ) : (
          '📊 Generate Weekly Report'
        )}
      </button>

      {loading && (
        <div className="card">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
            <Loader2 size={16} className="spin" />
            Analysing your week — ~5s
          </div>
          <div className="stack">
            <div className="skeleton" style={{ height: 20, width: '60%' }} />
            <div className="skeleton" style={{ height: 14 }} />
            <div className="skeleton" style={{ height: 14, width: '80%' }} />
            <div className="skeleton" style={{ height: 14, width: '70%' }} />
            <div style={{ marginTop: 12 }} />
            <div className="skeleton" style={{ height: 20, width: '50%' }} />
            <div className="skeleton" style={{ height: 14 }} />
            <div className="skeleton" style={{ height: 14, width: '75%' }} />
            <div style={{ marginTop: 12 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 16 }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {report && !loading && (
        <div className="stack">
          {/* Week-in-a-number */}
          <div className="hero-stat">
            <div className="hero-stat-label">Week in a Number</div>
            <div className="hero-stat-value">{weekActivities.reduce((s, a) => s + a.co2e_kg, 0).toFixed(1)}</div>
            <div className="hero-stat-unit">kg CO₂e this week</div>
            <div className="hero-stat-delta">{report.week_summary}</div>
          </div>

          {/* Equivalent */}
          {report.equivalent && (
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--green-50), #f0faf2)', border: '1.5px solid var(--green-200)' }}>
              <div className="section-title">🌍 That's equivalent to…</div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--green-800)' }}>{report.equivalent}</p>
            </div>
          )}

          {/* Wins */}
          {report.wins.length > 0 && (
            <div className="card">
              <div className="section-title">🟢 Wins This Week</div>
              <div className="stack">
                {report.wins.map((win, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < report.wins.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--green-600)', fontSize: '1.1rem', flexShrink: 0 }}>✅</span>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{win}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {report.opportunities.length > 0 && (
            <div className="card">
              <div className="section-title">🔴 Opportunities to Improve</div>
              <div className="stack">
                {report.opportunities.map((opp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < report.opportunities.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--red)', fontSize: '1.1rem', flexShrink: 0 }}>⚡</span>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{opp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
