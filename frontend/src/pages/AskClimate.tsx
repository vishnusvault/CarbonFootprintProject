import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { ragQuery } from '../lib/api';
import type { RAGQueryResponse } from '../lib/api';

const SUGGESTED_QUESTIONS = [
  'How much CO2 does a flight emit?',
  'What foods have lowest carbon footprint?',
  "How does India's grid compare?",
  'What is the carbon cost of beef vs vegetables?',
  'How can I reduce my transport emissions?',
];

export default function AskClimate() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RAGQueryResponse | null>(null);

  async function handleSubmit(q: string) {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await ragQuery(q.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get an answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit(question);
  }

  return (
    <main className="page">
      <h1 className="page-title">Ask Climate AI</h1>
      <p className="page-subtitle">Get science-backed answers about climate & carbon emissions.</p>

      {/* Input */}
      <form onSubmit={handleFormSubmit} className="stack" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Your Question</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. How much CO2 does a flight emit?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
          <span className="form-hint">Powered by RAG — answers grounded in climate science documents.</span>
        </div>
        <button
          className="btn btn-primary btn-full"
          type="submit"
          disabled={loading || !question.trim()}
        >
          {loading ? (
            <><Loader2 size={18} className="spin" /> Searching…</>
          ) : (
            <><Send size={18} /> Ask</>
          )}
        </button>
      </form>

      {/* Suggested questions */}
      <div className="section">
        <div className="section-title">Suggested Questions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              className="btn btn-ghost btn-sm"
              onClick={() => handleSubmit(q)}
              type="button"
              disabled={loading}
              style={{ fontSize: '0.8rem' }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="card">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
            <Loader2 size={16} className="spin" />
            Searching climate knowledge base…
          </div>
          <div className="stack">
            <div className="skeleton" style={{ height: 16 }} />
            <div className="skeleton" style={{ height: 16, width: '90%' }} />
            <div className="skeleton" style={{ height: 16, width: '75%' }} />
            <div className="skeleton" style={{ height: 16, width: '85%' }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--red)', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Answer */}
      {result && !loading && (
        <div className="stack">
          <div className="card">
            <div className="section-title">Answer</div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.75, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {result.answer}
            </p>
          </div>

          {result.sources.length > 0 && (
            <div className="insight-section">
              <div className="insight-section-title">Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.sources.map((src, i) => (
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
