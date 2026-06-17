import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FileText, Loader2, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { scanReceipt, parseNatural } from '../lib/api';
import { saveActivity } from '../lib/localStorage';
import { getDisplayName } from '../lib/activityDisplayNames';

interface AILoggerProps {
  entryDate: string;
}

export default function AILogger({ entryDate }: AILoggerProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'idle' | 'natural' | 'uploading' | 'reviewing' | 'saved'>('idle');
  const [naturalText, setNaturalText] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMode('uploading');
    setError('');
    try {
      const res = await scanReceipt(file);
      setItems(res.items);
      setSelected(new Set(res.items.map((_, i) => i)));
      setMode('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan receipt');
      setMode('idle');
    }
    // reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleNaturalParse() {
    if (!naturalText.trim()) return;
    setMode('uploading');
    setError('');
    try {
      const res = await parseNatural(naturalText);
      setItems(res.items);
      setSelected(new Set(res.items.map((_, i) => i)));
      setMode('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse text');
      setMode('natural');
    }
  }

  function toggleSelect(index: number) {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  }

  function confirmLog() {
    const toLog = items.filter((_, i) => selected.has(i));
    toLog.forEach(item => {
      saveActivity({
        id: crypto.randomUUID(),
        date: entryDate,
        category: item.category,
        activity_type: item.activity_type,
        quantity: item.quantity,
        unit: item.unit,
        co2e_kg: item.co2e_kg,
        conscious_swap: false,
        created_at: new Date().toISOString()
      });
    });
    setMode('saved');
  }

  const totalCO2 = items.filter((_, i) => selected.has(i)).reduce((sum, item) => sum + item.co2e_kg, 0);

  if (mode === 'uploading') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--green-600)' }} />
        <h3 style={{ fontWeight: 600 }}>Analyzing with AI...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>This usually takes 5-10 seconds.</p>
      </div>
    );
  }

  if (mode === 'reviewing') {
    return (
      <div className="stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')} style={{ padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Review Found Activities</h2>
        </div>
        
        {items.length === 0 ? (
          <div className="card text-center" style={{ padding: '30px 20px', color: 'var(--text-muted)' }}>
            No carbon-relevant activities found.
          </div>
        ) : (
          <div className="card stack" style={{ gap: 0, padding: 0 }}>
            {items.map((item, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, padding: '16px', 
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  background: selected.has(i) ? 'transparent' : 'var(--bg-secondary)',
                  opacity: selected.has(i) ? 1 : 0.6
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selected.has(i)} 
                  onChange={() => toggleSelect(i)}
                  style={{ width: 20, height: 20, accentColor: 'var(--green-600)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{getDisplayName(item.activity_type)}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {item.quantity} {item.unit}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  {item.co2e_kg.toFixed(1)} kg
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0', padding: '0 8px' }}>
            <span style={{ fontWeight: 600 }}>Date: <strong>{entryDate}</strong></span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--green-700)' }}>{totalCO2.toFixed(1)} kg CO₂e</span>
          </div>
        )}

        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmLog} disabled={selected.size === 0}>
            Log {selected.size} Activities
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'saved') {
    return (
      <div className="stack" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-800)' }}>Logged Successfully!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          {selected.size} activities added to your footprint.
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary btn-full btn-lg">
          View Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR USE AI</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: '0.9rem', padding: '12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {mode === 'natural' ? (
        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Describe your day</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')} style={{ padding: 4 }}><Trash2 size={16}/></button>
          </div>
          <textarea
            className="form-input"
            rows={3}
            placeholder="e.g. I drove 20km to work and had a veg lunch..."
            value={naturalText}
            onChange={(e) => setNaturalText(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleNaturalParse} disabled={!naturalText.trim()}>
            Parse Activities <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 10px', height: 'auto' }} onClick={() => fileInputRef.current?.click()}>
            <Camera size={24} color="var(--green-600)" />
            <span style={{ fontSize: '0.9rem' }}>Scan Receipt</span>
          </button>
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileSelect}
          />

          <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 10px', height: 'auto' }} onClick={() => setMode('natural')}>
            <FileText size={24} color="var(--green-600)" />
            <span style={{ fontSize: '0.9rem' }}>Type it out</span>
          </button>
        </div>
      )}
    </div>
  );
}
