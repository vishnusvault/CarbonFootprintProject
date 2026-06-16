import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import AILogger from '../components/AILogger';
import { calculateCO2e, suggestAlternative, getCities } from '../lib/api';
import { saveActivity } from '../lib/localStorage';
import type { Activity } from '../lib/api';

/* ──────────────────────── Data ──────────────────────── */

type Category = 'transport' | 'energy' | 'food' | 'purchase';

interface ActivityOption {
  value: string;
  label: string;
  unit: string;
  isRoute?: boolean; // uses origin/destination instead of quantity
}

const CATEGORIES: { value: Category; icon: string; label: string }[] = [
  { value: 'transport', icon: '🚗', label: 'Transport' },
  { value: 'energy', icon: '⚡', label: 'Energy' },
  { value: 'food', icon: '🥗', label: 'Food' },
  { value: 'purchase', icon: '🛍', label: 'Purchase' },
];

const ACTIVITY_OPTIONS: Record<Category, ActivityOption[]> = {
  transport: [
    { value: 'car_petrol', label: 'Petrol Car', unit: 'km', isRoute: true },
    { value: 'car_diesel', label: 'Diesel Car', unit: 'km', isRoute: true },
    { value: 'car_ev', label: 'Electric Car', unit: 'km', isRoute: true },
    { value: 'flight_short', label: 'Short Flight', unit: 'km', isRoute: true },
    { value: 'flight_long', label: 'Long Flight', unit: 'km', isRoute: true },
    { value: 'bus', label: 'Bus', unit: 'km', isRoute: true },
    { value: 'metro', label: 'Metro', unit: 'km', isRoute: true },
    { value: 'train', label: 'Train', unit: 'km', isRoute: true },
    { value: 'cycling', label: 'Cycling', unit: 'km', isRoute: false },
    { value: 'walking', label: 'Walking', unit: 'km', isRoute: false },
  ],
  energy: [
    { value: 'electricity_IN', label: 'Electricity (India)', unit: 'kWh' },
    { value: 'lpg', label: 'LPG/Gas', unit: 'kg' },
    { value: 'generator', label: 'Generator', unit: 'litre' },
  ],
  food: [
    { value: 'food_apples', label: 'Apples', unit: 'g' },
    { value: 'food_bananas', label: 'Bananas', unit: 'g' },
    { value: 'drink_beer', label: 'Beer', unit: 'ml' },
    { value: 'food_biryani', label: 'Biryani', unit: 'g' },
    { value: 'food_cheese', label: 'Cheese', unit: 'g' },
    { value: 'food_chicken', label: 'Chicken', unit: 'g' },
    { value: 'drink_coffee', label: 'Coffee', unit: 'ml' },
    { value: 'food_dal_makhani', label: 'Dal Makhani', unit: 'g' },
    { value: 'food_dosa', label: 'Dosa', unit: 'g' },
    { value: 'food_eggs', label: 'Eggs', unit: 'g' },
    { value: 'food_fish', label: 'Fish', unit: 'g' },
    { value: 'food_lamb', label: 'Lamb', unit: 'g' },
    { value: 'food_lentils', label: 'Lentils/Beans', unit: 'g' },
    { value: 'drink_milk', label: 'Milk', unit: 'ml' },
    { value: 'food_paneer_tikka', label: 'Paneer Tikka', unit: 'g' },
    { value: 'food_pork', label: 'Pork', unit: 'g' },
    { value: 'food_potatoes', label: 'Potatoes', unit: 'g' },
    { value: 'food_rice', label: 'Rice', unit: 'g' },
    { value: 'food_samosa', label: 'Samosa', unit: 'g' },
    { value: 'drink_cola', label: 'Soft Drink (Cola)', unit: 'ml' },
    { value: 'drink_tea', label: 'Tea', unit: 'ml' },
    { value: 'food_tofu', label: 'Tofu/Soy', unit: 'g' },
    { value: 'food_tomatoes', label: 'Tomatoes', unit: 'g' },
    { value: 'food_wheat', label: 'Wheat/Bread', unit: 'g' },
  ],
  purchase: [
    { value: 'electronics_small', label: 'Small Electronics', unit: 'item' },
    { value: 'electronics_large', label: 'Large Electronics', unit: 'item' },
    { value: 'clothing', label: 'Clothing', unit: 'item' },
  ],
};

/* ──────────────────────── Component ──────────────────── */

export default function LogActivity() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const totalSteps = 6;

  // Step 1
  const [category, setCategory] = useState<Category | null>(null);
  // Step 2
  const [activityType, setActivityType] = useState<ActivityOption | null>(null);
  // Step 3
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [cityOriginFilter, setCityOriginFilter] = useState('');
  const [cityDestFilter, setCityDestFilter] = useState('');
  // Step 4
  const [co2Result, setCo2Result] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [savedActivity, setSavedActivity] = useState<Activity | null>(null);
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  // Step 5
  const [suggestion, setSuggestion] = useState<{ suggestion: string; co2_saving_kg: number } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  // Load cities for transport route steps
  useEffect(() => {
    if (activityType?.isRoute) {
      getCities()
        .then((r) => setCities(r.data))
        .catch(() => setCities([]));
    }
  }, [activityType]);

  /* ── Navigation helpers ── */
  function goNext() { setStep((s) => Math.min(s + 1, totalSteps - 1)); }
  function goBack() { setStep((s) => Math.max(s - 1, 0)); }

  /* ── Step 4: Calculate CO2 ── */
  async function handleCalculate() {
    if (!category || !activityType) return;
    setCalcLoading(true);
    setCalcError('');
    try {
      const params = {
        category,
        activity_type: activityType.value,
        quantity: activityType.isRoute ? 1 : parseFloat(quantity) || 1,
        unit: activityType.unit,
        date: entryDate,
        ...(activityType.isRoute ? { origin, destination } : {}),
      };
      const result = await calculateCO2e(params);
      setCo2Result(result.co2e_kg);
      setDistanceKm(result.distance_km ?? null);

      // Save activity
      const act: Activity = {
        id: uuidv4(),
        date: entryDate,
        category,
        activity_type: activityType.value,
        quantity: activityType.isRoute ? (result.distance_km ?? 0) : parseFloat(quantity) || 1,
        unit: activityType.unit,
        co2e_kg: result.co2e_kg,
        conscious_swap: false,
        created_at: new Date().toISOString(),
        ...(activityType.isRoute ? { origin, destination, distance_km: result.distance_km } : {}),
      };
      setSavedActivity(act);
      setSavedActivity(act);
      goNext();
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Failed to calculate. Please try again.');
    } finally {
      setCalcLoading(false);
    }
  }

  /* ── Step 5: Get suggestion ── */
  async function handleGetSuggestion() {
    if (!savedActivity) return;
    setSuggestLoading(true);
    setSuggestError('');
    try {
      const result = await suggestAlternative(savedActivity);
      setSuggestion({ suggestion: result.suggestion, co2_saving_kg: result.co2_saving_kg });
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Could not load suggestion.');
    } finally {
      setSuggestLoading(false);
    }
  }

  useEffect(() => {
    if (step === 4 && savedActivity && !suggestion && !suggestLoading) {
      handleGetSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleConsciousSwap() {
    if (!savedActivity) return;
    const finalAct = {
      ...savedActivity,
      conscious_swap: true,
      co2_avoided_kg: suggestion?.co2_saving_kg ?? 0,
    };
    saveActivity(finalAct);
    goNext();
  }

  function handleDismiss() {
    if (!savedActivity) return;
    saveActivity(savedActivity);
    goNext();
  }

  const filteredOriginCities = cities.filter((c) =>
    c.toLowerCase().includes(cityOriginFilter.toLowerCase())
  ).slice(0, 8);

  const filteredDestCities = cities.filter((c) =>
    c.toLowerCase().includes(cityDestFilter.toLowerCase())
  ).slice(0, 8);

  const options = category ? ACTIVITY_OPTIONS[category] : [];

  return (
    <main className="page">
      <h1 className="page-title">Log Activity</h1>
      <p className="page-subtitle">Record your carbon-emitting activity.</p>

      {/* Step dots */}
      <div className="wizard-steps">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
          />
        ))}
      </div>

      {/* ── Step 0: Category ── */}
      {step === 0 && (
        <div className="stack">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Choose a category</p>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={`cat-card${category === c.value ? ' selected' : ''}`}
                onClick={() => setCategory(c.value)}
                type="button"
              >
                <span className="cat-card-icon">{c.icon}</span>
                <span className="cat-card-name">{c.label}</span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-full btn-lg"
            disabled={!category}
            onClick={goNext}
            type="button"
            style={{ marginTop: 16 }}
          >
            Next <ChevronRight size={18} />
          </button>
          
          <AILogger />
        </div>
      )}

      {/* ── Step 1: Activity Type ── */}
      {step === 1 && (
        <div className="stack">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Choose activity type</p>
          <div className="cat-grid">
            {options.map((opt) => (
              <button
                key={opt.value}
                className={`cat-card${activityType?.value === opt.value ? ' selected' : ''}`}
                onClick={() => setActivityType(opt)}
                type="button"
              >
                <span className="cat-card-name" style={{ fontSize: '0.82rem' }}>{opt.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>per {opt.unit}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={goBack} type="button">
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={!activityType}
              onClick={goNext}
              type="button"
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Details (route or quantity) ── */}
      {step === 2 && activityType && (
        <div className="stack">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {activityType.isRoute ? 'Enter your route' : 'Enter quantity'}
          </p>

          {activityType.isRoute ? (
            <>
              <div className="form-group">
                <label className="form-label">Origin City</label>
                <input
                  className="form-input"
                  placeholder="Search city..."
                  value={cityOriginFilter}
                  onChange={(e) => { setCityOriginFilter(e.target.value); setOrigin(''); }}
                />
                {cityOriginFilter && !origin && filteredOriginCities.length > 0 && (
                  <div className="card" style={{ padding: '8px', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {filteredOriginCities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', borderRadius: 6 }}
                        onClick={() => { setOrigin(c); setCityOriginFilter(c); }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {origin && <span className="form-hint">Selected: {origin}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Destination City</label>
                <input
                  className="form-input"
                  placeholder="Search city..."
                  value={cityDestFilter}
                  onChange={(e) => { setCityDestFilter(e.target.value); setDestination(''); }}
                />
                {cityDestFilter && !destination && filteredDestCities.length > 0 && (
                  <div className="card" style={{ padding: '8px', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {filteredDestCities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', borderRadius: 6 }}
                        onClick={() => { setDestination(c); setCityDestFilter(c); }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {destination && <span className="form-hint">Selected: {destination}</span>}
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">
                Quantity {activityType.unit === 'meal' || activityType.unit === 'item' ? '' : `(${activityType.unit})`}
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <span className="form-hint">Enter the amount in {activityType.unit}.</span>
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={goBack} type="button">
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={activityType.isRoute ? (!origin || !destination) : !quantity}
              onClick={goNext}
              type="button"
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirmation + Calculate ── */}
      {step === 3 && activityType && (
        <div className="stack">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Confirm & Calculate</p>
          <div className="card">
            <div className="stack">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="form-label">Category</span>
                <span>{category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="form-label">Activity</span>
                <span>{activityType.label}</span>
              </div>
              {activityType.isRoute ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Route</span>
                  <span>{origin} → {destination}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Quantity</span>
                  <span>{quantity} {activityType.unit}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <span className="form-label" style={{ marginBottom: 0 }}>Date</span>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ width: 'auto', padding: '4px 8px' }}
                  min={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                  max={new Date().toISOString().split('T')[0]}
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {calcLoading && (
            <div className="card">
              <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40, width: '40%' }} />
            </div>
          )}

          {calcError && (
            <div style={{ color: 'var(--red)', fontSize: '0.9rem', padding: '12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fca5a5' }}>
              ⚠️ {calcError}
            </div>
          )}

          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={goBack} type="button" disabled={calcLoading}>
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCalculate}
              disabled={calcLoading}
              type="button"
            >
              {calcLoading ? <><Loader2 size={18} className="spin" /> Calculating…</> : <><Check size={18} /> Calculate CO₂e</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Result & Suggestion ── */}
      {step === 4 && (
        <div className="stack">
          {co2Result !== null && (
            <div className="hero-stat" style={{ borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <div className="hero-stat-label">CO₂e Emitted</div>
              <div className="hero-stat-value">{co2Result.toFixed(2)}</div>
              <div className="hero-stat-unit">kg CO₂e</div>
              {distanceKm && (
                <div className="hero-stat-delta">📍 Distance: {distanceKm.toFixed(0)} km</div>
              )}
            </div>
          )}

          {suggestLoading && (
            <div className="card">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 12 }}>
                <Loader2 size={18} className="spin" />
                🌍 Getting a personalised suggestion…
              </div>
              <div className="skeleton" style={{ height: 16, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: '60%' }} />
            </div>
          )}

          {suggestError && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{suggestError}</p>
          )}

          {suggestion && !suggestLoading && (
            <div className="suggestion-card">
              <div className="suggestion-header">
                <span className="suggestion-tag">💡 Suggestion</span>
              </div>
              <p className="suggestion-text">{suggestion.suggestion}</p>
              {suggestion.co2_saving_kg > 0 && (
                <p className="suggestion-saving">
                  🌱 Could save ~{suggestion.co2_saving_kg.toFixed(2)} kg CO₂e
                </p>
              )}
              <div className="suggestion-actions">
                <button className="btn btn-primary btn-sm" onClick={handleConsciousSwap} type="button">
                  <Check size={15} /> Yes, I considered this ✓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDismiss} type="button">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Saved Confirmation ── */}
      {step === 5 && savedActivity && (
        <div className="stack" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-800)' }}>Activity Logged!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            <strong>{activityType?.label}</strong> — {savedActivity.co2e_kg.toFixed(2)} kg CO₂e saved
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary btn-full btn-lg" type="button" style={{ marginBottom: 12 }}>
            View Dashboard
          </button>
          <button onClick={() => {
            setStep(0);
            setCategory(null);
            setActivityType(null);
            setOrigin('');
            setDestination('');
            setQuantity('');
            setCo2Result(null);
            setDistanceKm(null);
            setSavedActivity(null);
            setSuggestion(null);
          }} className="btn btn-ghost btn-full" type="button">
            Log Another Activity
          </button>
        </div>
      )}
    </main>
  );
}
