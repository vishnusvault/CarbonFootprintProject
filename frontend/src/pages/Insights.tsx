import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { getWeekActivities, getProfile } from '../lib/localStorage';
import { generateInsights } from '../lib/api';
import type { InsightsResponse } from '../lib/api';

export default function Insights() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState<InsightsResponse | null>(null);

  const weekActivities = getWeekActivities();
  const totalCO2 = weekActivities.reduce((s, a) => s + a.co2e_kg, 0);
  const consciousSwaps = weekActivities.filter((a) => a.conscious_swap).length;

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const profile = getProfile();
      if (!profile) throw new Error('Profile not found. Please complete onboarding.');

      // Build summary object
      const summary: Record<string, number> = {};
      for (const a of weekActivities) {
        summary[a.activity_type] = (summary[a.activity_type] ?? 0) + a.co2e_kg;
      }

      const result = await generateInsights(summary, profile);
      setInsights(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Weekly Insights</h1>
      <p className="page-subtitle">AI-powered analysis of your carbon footprint.</p>

      {/* Summary Stats */}
      <div className="card section">
        <div className="section-title">This Week at a Glance</div>
        <div className="row">
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-800)' }}>
              {totalCO2.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>kg CO₂e total</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-800)' }}>
              {weekActivities.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>activities logged</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-600)' }}>
              {consciousSwaps}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>conscious swaps</div>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleGenerate}
        disabled={loading || weekActivities.length === 0}
        type="button"
        style={{ marginBottom: 20 }}
      >
        {loading ? (
          <><Loader2 size={20} className="spin" /> Analysing your footprint…</>
        ) : insights ? (
          <><RefreshCw size={18} /> Refresh Insights</>
        ) : (
          '🌍 Get AI Insights'
        )}
      </button>

      {weekActivities.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <p className="empty-title">No data yet</p>
            <p className="empty-desc">Log some activities this week to get personalised insights.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Loader2 size={16} className="spin" />
            🌍 Analysing your footprint — ~5s
          </p>
          <div className="stack">
            <div className="skeleton" style={{ height: 18 }} />
            <div className="skeleton" style={{ height: 18, width: '85%' }} />
            <div className="skeleton" style={{ height: 18, width: '70%' }} />
            <div style={{ marginTop: 12 }} />
            <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {insights && !loading && (
        <div className="stack">
          {/* Summary */}
          <div className="card">
            <div className="section-title">Summary</div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
              {insights.summary}
            </p>
          </div>

          {/* Suggestions */}
          <div className="insight-section">
            <div className="insight-section-title">Top Suggestions</div>
            {insights.suggestions.map((s, i) => (
              <div key={i} className="suggestion-pill">
                <div className="pill-num">{i + 1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>

          {/* Fact */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--green-50), #f0faf2)', border: '1.5px solid var(--green-200)' }}>
            <div className="section-title">🌿 Did You Know?</div>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {insights.fact}
            </p>
          </div>

          {/* Sources */}
          {insights.sources.length > 0 && (
            <div className="insight-section">
              <div className="insight-section-title">Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {insights.sources.map((src, i) => (
                  <span key={i} className="source-chip" title={src.excerpt}>
                    📄 {src.doc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
