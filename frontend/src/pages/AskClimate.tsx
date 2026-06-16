import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Bot } from 'lucide-react';
import { ragQuery } from '../lib/api';
import { getActivities } from '../lib/localStorage';
import type { Activity } from '../lib/api';

const SUGGESTED_QUESTIONS = [
  'How does my footprint compare to average?',
  'What is my biggest source of emissions?',
  'How can I reduce my transport emissions?',
  'What would happen if I went vegetarian?',
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { doc: string; excerpt: string }[];
}

function buildActivitySummary(activities: Activity[]): string {
  if (activities.length === 0) return "No activities logged yet.";
  const total = activities.reduce((s, a) => s + a.co2e_kg, 0).toFixed(1);
  const byCategory: Record<string, Activity[]> = {};
  activities.forEach(a => {
    byCategory[a.category] = byCategory[a.category] || [];
    byCategory[a.category].push(a);
  });
  const lines = Object.entries(byCategory).map(([cat, acts]) => {
    const catTotal = acts.reduce((s: number, a: Activity) => s + a.co2e_kg, 0).toFixed(1);
    return `${cat}: ${catTotal} kg CO₂e (${acts.length} activities)`;
  });
  return `Total logged: ${total} kg CO₂e\n${lines.join('\n')}`;
}

export default function AskClimate() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activities = getActivities();
  const userSummary = buildActivitySummary(activities);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSubmit(text: string) {
    if (!text.trim() || loading) return;
    
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Send last 6 messages as history
      const historyToSend = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      
      const res = await ragQuery(historyToSend, userSummary, text);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.answer,
        sources: res.sources
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Failed to get an answer. Please try again.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit(input);
  }

  return (
    <main className="page" style={{ paddingBottom: 100, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flexShrink: 0 }}>
        <h1 className="page-title">Ask Leo</h1>
        <p className="page-subtitle">Your personal AI carbon footprint advisor.</p>
      </div>

      <div 
        ref={scrollRef}
        className="stack" 
        style={{ flex: 1, overflowY: 'auto', padding: '16px 0', gap: 16 }}
      >
        {messages.length === 0 ? (
          <div className="card text-center" style={{ padding: '40px 20px', background: 'transparent', boxShadow: 'none' }}>
            <Bot size={48} color="var(--green-600)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Hi, I'm Leo! 🌿</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 24 }}>
              I can answer questions about your footprint, suggest ways to reduce it, or explain climate science.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="btn btn-secondary"
                  onClick={() => handleSubmit(q)}
                  disabled={loading}
                  style={{ textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '12px' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div 
                style={{ 
                  maxWidth: '85%', 
                  padding: '12px 16px', 
                  borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  background: msg.role === 'user' ? 'var(--green-600)' : 'white',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {msg.content}
              </div>
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {msg.sources.map((s, i) => (
                    <span key={i} className="source-chip" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                      📄 {s.doc}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12 }}>
            <Loader2 size={16} className="spin" color="var(--green-600)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Leo is thinking...</span>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 0' }}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            type="text"
            placeholder="Ask Leo about your footprint..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !input.trim()}
            style={{ padding: '0 16px' }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}
