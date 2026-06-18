import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { saveProfile } from '../lib/localStorage';
import type { Profile } from '../lib/api';

type Country = { code: string; label: string };
type Transport = Profile['primary_transport'];
type Diet = Profile['diet'];

const COUNTRIES: Country[] = [
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'US', label: '🇺🇸 USA' },
  { code: 'GB', label: '🇬🇧 UK' },
  { code: 'EU', label: '🇪🇺 European Union' },
];

const TRANSPORTS: { value: Transport; icon: string; label: string }[] = [
  { value: 'car', icon: '🚗', label: 'Car' },
  { value: 'public', icon: '🚌', label: 'Public Transit' },
  { value: 'cycle', icon: '🚲', label: 'Cycle' },
  { value: 'walk', icon: '🚶', label: 'Walk' },
];

const DIETS: { value: Diet; icon: string; label: string }[] = [
  { value: 'meat_heavy', icon: '🥩', label: 'Meat-Heavy' },
  { value: 'mixed', icon: '🍱', label: 'Mixed' },
  { value: 'vegetarian', icon: '🥗', label: 'Vegetarian' },
  { value: 'vegan', icon: '🌱', label: 'Vegan' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState('IN');
  const [transport, setTransport] = useState<Transport>('public');
  const [diet, setDiet] = useState<Diet>('mixed');

  const totalSteps = 3;

  function handleComplete() {
    const profile: Profile = {
      country,
      primary_transport: transport,
      diet,
      onboarded_at: new Date().toISOString(),
    };
    saveProfile(profile);
    navigate('/', { replace: true });
  }

  return (
    <div className="onboard-page">
      <div className="onboard-card">
        <div className="onboard-logo">🌱</div>
        <h1 className="onboard-title">CarbonFactors</h1>
        <p className="onboard-subtitle">Track your carbon footprint, one step at a time.</p>

        {/* Step dots */}
        <div className="wizard-steps" style={{ justifyContent: 'center' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
            />
          ))}
        </div>

        <p className="onboard-step-label">Step {step + 1} of {totalSteps}</p>

        {/* Step 1: Country */}
        {step === 0 && (
          <div className="stack">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Where are you based?</p>
            <div className="form-group">
              <label className="form-label">Country / Region</label>
              <select
                className="form-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <span className="form-hint">Used to localise your electricity grid emission factor.</span>
            </div>
          </div>
        )}

        {/* Step 2: Transport */}
        {step === 1 && (
          <div className="stack">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Primary mode of transport?</p>
            <div className="cat-grid">
              {TRANSPORTS.map((t) => (
                <button
                  key={t.value}
                  className={`cat-card${transport === t.value ? ' selected' : ''}`}
                  onClick={() => setTransport(t.value)}
                  type="button"
                >
                  <span className="cat-card-icon">{t.icon}</span>
                  <span className="cat-card-name">{t.label}</span>
                  {transport === t.value && <Check size={16} color="var(--green-600)" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Diet */}
        {step === 2 && (
          <div className="stack">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>What's your diet type?</p>
            <div className="cat-grid">
              {DIETS.map((d) => (
                <button
                  key={d.value}
                  className={`cat-card${diet === d.value ? ' selected' : ''}`}
                  onClick={() => setDiet(d.value)}
                  type="button"
                >
                  <span className="cat-card-icon">{d.icon}</span>
                  <span className="cat-card-name">{d.label}</span>
                  {diet === d.value && <Check size={16} color="var(--green-600)" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="row" style={{ marginTop: 24 }}>
          {step > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => setStep((s) => s - 1)}
              type="button"
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < totalSteps - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
              type="button"
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleComplete}
              type="button"
            >
              Get Started <Check size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
