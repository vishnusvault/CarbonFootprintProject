import { useState } from 'react';
import { getProfile, saveProfile, getMonthActivities } from '../lib/localStorage';

export default function BudgetRing() {
  const profile = getProfile();
  const [budget, setBudget] = useState<number | null>(profile?.monthly_budget_kg || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budget?.toString() || '');

  const monthActivities = getMonthActivities();
  const currentTotal = monthActivities.reduce((s, a) => s + a.co2e_kg, 0);

  function handleSaveBudget() {
    if (!profile) return;
    const num = parseFloat(editValue);
    if (!isNaN(num) && num > 0) {
      const updated = { ...profile, monthly_budget_kg: num };
      saveProfile(updated);
      setBudget(num);
      setIsEditing(false);
    }
  }

  // If no budget set and not editing, show prompt
  if (budget === null && !isEditing) {
    return (
      <div className="card text-center section">
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎯</div>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Set a Carbon Goal</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
          Stay on track by setting a monthly CO₂e limit.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
          Set Monthly Budget
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="card section">
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Monthly Budget (kg CO₂e)</h3>
        <div className="row">
          <input 
            type="number" 
            className="form-input" 
            style={{ flex: 1 }}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            placeholder="e.g. 200"
          />
          <button className="btn btn-primary" onClick={handleSaveBudget}>Save</button>
          {budget !== null && <button className="btn btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>}
        </div>
      </div>
    );
  }

  // Draw budget ring
  const b = budget as number;
  const pct = Math.min((currentTotal / b) * 100, 100);
  const isOver = currentTotal > b;
  const remain = Math.max(b - currentTotal, 0);
  
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const color = isOver ? 'var(--red)' : pct > 80 ? '#f59e0b' : 'var(--green-600)';

  return (
    <div className="card section" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle 
            cx="70" cy="70" r={radius} 
            stroke="var(--bg-secondary)" 
            strokeWidth={strokeWidth} 
            fill="none" 
          />
          <circle 
            cx="70" cy="70" r={radius} 
            stroke={color} 
            strokeWidth={strokeWidth} 
            fill="none" 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div style={{ 
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
        }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color }}>
            {Math.round(pct)}%
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>used</span>
        </div>
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Monthly Goal</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {currentTotal.toFixed(1)} / {b} kg
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)} style={{ padding: 4, height: 'auto' }}>
            ✏️
          </button>
        </div>
        
        <div style={{ 
          marginTop: 12, 
          padding: '8px 12px', 
          background: isOver ? '#fff5f5' : 'var(--bg-secondary)', 
          borderRadius: 8,
          fontSize: '0.85rem',
          color: isOver ? 'var(--red)' : 'var(--text-primary)',
          fontWeight: 600
        }}>
          {isOver ? `Exceeded by ${(currentTotal - b).toFixed(1)} kg` : `${remain.toFixed(1)} kg remaining`}
        </div>
      </div>
    </div>
  );
}
