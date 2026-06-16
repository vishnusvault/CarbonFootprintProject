# CarbonLens — Bug Fixes & New Features Brief
**For:** Vibecoding / AI Coding Platform  
**App:** https://carbonlens-814809066973.asia-south1.run.app  
**Version reviewed:** Live deployment, June 17 2026  
**Status:** Post-deployment review — fix critical bugs first, then build new features

---

## HOW TO USE THIS DOCUMENT

Work through the sections in order:
1. **Part A — Critical Bugs** (fix these before anything else — judges will hit all of them)
2. **Part B — Medium Issues** (polish that affects usability)
3. **Part C — Minor Issues** (quick wins)
4. **Part D — New Features** (build after all bugs are resolved)

Each item has: what the problem is, exactly where in the code to look, and what the fix or implementation should be.

---

# PART A — CRITICAL BUGS 🔴

---

## BUG-01 — Wrong Emission Factor for Short Flight

**Severity:** Critical  
**Page:** Log Activity → Transport → Short Flight, and anywhere CO₂e is displayed  
**What the user sees:** Chennai → Mumbai (1,033 km) shows **263.44 kg CO₂e**. The correct value is ~**163 kg CO₂e**.

**Root cause:**  
The short flight emission factor in `emission_factors.json` is set to `0.255 kg/km`. This is the IPCC long-haul factor. The correct short-haul economy factor (IPCC AR6 / GHG Protocol) is **0.158 kg/km**.

```
Current (wrong):   1033 km × 0.255 = 263.4 kg  ❌
Correct:           1033 km × 0.158 = 163.2 kg  ✅
```

**Fix — file: `/backend/emission_factors.json`**

```json
"transport": {
  "flight_short": { "km": 0.158 },   // was 0.255 — IPCC AR6 short-haul economy
  "flight_long":  { "km": 0.195 },   // keep as-is
  ...
}
```

Also update the `_sources` comment entry:
```json
"_sources": {
  "flight_short": "IPCC AR6 WG3 Table 10.SM.4 — short-haul economy class 0.158 kgCO2e/pkm"
}
```

**Impact:** This is the most-tested entry in the whole app. Every judge who tries "Log a flight" will see an obviously wrong number. Fix this first.

---

## BUG-02 — Donut Chart Not Rendering on Dashboard

**Severity:** Critical  
**Page:** Home `/` — the "BY CATEGORY" section  
**What the user sees:** The legend text loads correctly (e.g. "Transport — 526.88 kg · Food — 0.1 kg") but the actual donut chart area is **completely blank/empty**.

**Root cause:**  
Recharts `PieChart` / `DonutChart` requires its parent container to have an **explicit pixel height**. If the container's height is `0`, `auto`, or a percentage without a pixel ancestor, Recharts renders nothing. The container likely has no height set or is set to `height: 100%` inside a flex parent that has no defined height.

**Fix — file: `/frontend/src/components/CategoryChart.tsx`** (or wherever the chart component is)

Wrap the chart in a container with an explicit height:

```tsx
// WRONG — no height, Recharts renders blank
<div className="w-full">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>

// CORRECT — explicit pixel height on the ResponsiveContainer
<div className="w-full">
  <ResponsiveContainer width="100%" height={260}>
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>
```

If using Tailwind, add `h-64` (256px) or `h-72` (288px) to the wrapper div AND set `height="100%"` on `ResponsiveContainer`:

```tsx
<div className="w-full h-64">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>
```

**Verify:** After fix, the donut chart should render with Transport taking ~99.9% and Food ~0.1% of the ring.

---

## BUG-03 — Timeframe Switcher (Daily/Weekly/Monthly) Does Not Filter Data

**Severity:** Critical  
**Page:** Home `/` — the Daily / Weekly / Monthly tab toggle  
**What the user sees:** Switching from Weekly → Daily changes the header text from "THIS WEEK'S CARBON FOOTPRINT" to "TODAY'S CARBON FOOTPRINT" but the **number stays identical** (527.0 kg both tabs). Daily should only sum activities from today. Monthly should only sum activities from this calendar month.

**Root cause:**  
The `activities` array from localStorage is being summed in full regardless of which tab is active. The timeframe filter is applied to the label text but not to the data aggregation.

**Fix — file: `/frontend/src/pages/Home.tsx`** (or the Dashboard component)

```tsx
// Add a filtering utility
function filterActivitiesByTimeframe(
  activities: Activity[],
  timeframe: 'daily' | 'weekly' | 'monthly'
): Activity[] {
  const now = new Date();
  return activities.filter(a => {
    const date = new Date(a.date);
    if (timeframe === 'daily') {
      return date.toDateString() === now.toDateString();
    }
    if (timeframe === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
    }
    if (timeframe === 'monthly') {
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }
    return true;
  });
}

// Use it when computing totals and category breakdown
const filteredActivities = filterActivitiesByTimeframe(allActivities, activeTab);
const total = filteredActivities.reduce((sum, a) => sum + a.co2e_kg, 0);
```

Apply the same `filteredActivities` to the category chart data and the Recent Activities list.

---

## BUG-04 — Duplicate Activity Entries Being Created

**Severity:** Critical  
**Page:** Log Activity `/log`  
**What the user sees:** In Recent Activities on the dashboard, the same "Short Flight Chennai → Mumbai 263.44 kg" appears **twice** (and will appear more times each time the user goes through the wizard). There is no explicit save confirmation — the entry is saved automatically at the "Calculate CO₂e" step, so any re-visit or accidental re-submission creates a duplicate.

**Root cause:**  
The activity is saved to localStorage at the "Calculate CO₂e" step (Step 4/5). There is no final explicit "Save" step. Also no deduplication check exists.

**Fix — two changes needed:**

**Change 1: Add an explicit Step 6 "Saved" screen**

After the inline suggestion card (current last step), add a final confirmation screen:

```tsx
// Step 6 — SavedScreen component
<div className="text-center space-y-4">
  <div className="text-5xl">✅</div>
  <h2 className="text-xl font-bold text-green-800">Activity Logged!</h2>
  <p className="text-gray-600">
    <strong>{activityDisplayName}</strong> — {co2e_kg} kg CO₂e saved
  </p>
  <button onClick={() => navigate('/')} className="btn-primary w-full">
    View Dashboard
  </button>
  <button onClick={resetWizard} className="btn-secondary w-full">
    Log Another Activity
  </button>
</div>
```

Move the `localStorage.setItem(...)` call to trigger only on this screen (not on Calculate).

**Change 2: Add delete button on each activity card in Recent Activities**

```tsx
// In RecentActivityCard component
<div className="flex items-center justify-between">
  <div>...</div>
  <button
    onClick={() => deleteActivity(activity.id)}
    className="text-gray-400 hover:text-red-500 p-2"
    aria-label="Delete activity"
  >
    🗑
  </button>
</div>

// deleteActivity function
function deleteActivity(id: string) {
  const stored = JSON.parse(localStorage.getItem('activities') || '[]');
  const updated = stored.filter((a: Activity) => a.id !== id);
  localStorage.setItem('activities', JSON.stringify(updated));
}
```

---

## BUG-05 — RAG "Did You Know" Returns No Context

**Severity:** Critical  
**Page:** Insights `/insights` — the "DID YOU KNOW?" section  
**What the user sees:** *"No specific climate context was provided in the reference documents to extract a verified fact."* — the RAG retrieval is returning empty chunks to the LLM, so the LLM correctly reports it has no sourced facts to cite.

**Root cause (most likely):** One of:
1. ChromaDB index was not built correctly during Docker build — `rag/ingest.py` may have failed silently
2. The collection name in `retriever.py` doesn't match the one created in `ingest.py`
3. The `rag_chunks` variable is being passed as an empty string or `None` into the LLM prompt

**Diagnostic steps:**

**Step 1:** Add a health check endpoint to confirm the RAG index exists:

```python
# In backend/routers/rag.py
@router.get("/health")
def rag_health():
    collection = chroma_client.get_collection("climate_docs")
    count = collection.count()
    return {"document_chunks": count, "status": "ok" if count > 0 else "EMPTY INDEX"}
```

Visit `/api/v1/rag/health` — if it returns `count: 0`, the index wasn't built.

**Step 2:** Add a debug log in `retriever.py`:

```python
def retrieve(query: str, top_k: int = 3) -> list[dict]:
    results = collection.query(query_texts=[query], n_results=top_k)
    print(f"[RAG] Query: '{query}' → {len(results['documents'][0])} chunks returned")
    # If this prints 0, the index is empty or the collection name is wrong
    ...
```

**Step 3:** If the index is empty, ensure `ingest.py` is called in the Dockerfile:

```dockerfile
# In Dockerfile — confirm this line exists AFTER COPY rag/
RUN python rag/ingest.py
```

And confirm `ingest.py` has no import errors by running it locally:
```bash
cd backend && python ../rag/ingest.py
```

**Step 4:** Check collection name consistency:

```python
# ingest.py must use the same name as retriever.py
# ingest.py:
collection = client.get_or_create_collection("climate_docs")  # ← name

# retriever.py:
collection = client.get_collection("climate_docs")  # ← must match exactly
```

---

# PART B — MEDIUM ISSUES 🟡

---

## ISSUE-06 — Raw Activity Key Names Showing in UI

**Severity:** Medium  
**Pages:** Home (Recent Activities list), Insights ("this week at a glance"), Dashboard  
**What the user sees:** Activity names show as raw keys like **"food_samosa"** instead of human-readable names like "Food — Samosa" or just "Samosa".

**Fix — file: `/frontend/src/lib/activityDisplayNames.ts`** (create this file)

```typescript
export const ACTIVITY_DISPLAY_NAMES: Record<string, string> = {
  // Transport
  car_petrol:    "Petrol Car",
  car_diesel:    "Diesel Car",
  car_ev:        "Electric Car",
  flight_short:  "Short Flight",
  flight_long:   "Long Flight",
  bus:           "Bus",
  metro:         "Metro",
  train:         "Train",
  cycling:       "Cycling",
  walking:       "Walking",
  // Energy
  electricity:   "Electricity",
  lpg:           "LPG / Gas",
  generator:     "Generator",
  // Food
  meal_meat_heavy:  "Meal (Meat-heavy)",
  meal_mixed:       "Meal (Mixed)",
  meal_vegetarian:  "Meal (Vegetarian)",
  meal_vegan:       "Meal (Vegan)",
  food_samosa:      "Food — Samosa",   // handle this specific case
  // Purchase
  electronics_small: "Electronics (Small)",
  electronics_large: "Electronics (Large)",
  clothing:          "Clothing",
};

export function getDisplayName(activityType: string): string {
  return ACTIVITY_DISPLAY_NAMES[activityType] 
    ?? activityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    // fallback: converts "food_samosa" → "Food Samosa"
}
```

Import and use `getDisplayName(activity.activity_type)` everywhere an activity name is rendered.

---

## ISSUE-07 — No Explicit Save Step in Log Wizard — Entry Saved Silently

**Severity:** Medium  
**Page:** Log Activity `/log`  
**What the user sees:** After "Calculate CO₂e" the inline suggestion appears, but the entry is already saved — the user doesn't know this happened. There is no "Done" or "Save" button visible, so users assume nothing was saved and repeat the flow (causing BUG-04 duplicates).

**Fix:**  
Move `localStorage.setItem(...)` to fire only when the user explicitly acts on the suggestion screen (taps "Yes, I considered this" OR "Dismiss"). Both buttons should save the entry and then navigate to the Saved confirmation screen (see BUG-04 fix). The wizard must not save silently at the calculate step.

```tsx
// On the suggestion card
<button onClick={() => { markConsciousSwap(); saveAndFinish(); }}>
  ✓ Yes, I considered this
</button>
<button onClick={() => { saveAndFinish(); }}>
  Dismiss
</button>

function saveAndFinish() {
  const entry = buildActivityEntry(); // builds from wizard state
  const stored = JSON.parse(localStorage.getItem('activities') || '[]');
  stored.push(entry);
  localStorage.setItem('activities', JSON.stringify(stored));
  navigate('/log/saved'); // go to Step 6 saved screen
}
```

---

## ISSUE-08 — Benchmark Comparison Uses Wrong Unit (Daily vs Weekly mismatch)

**Severity:** Medium  
**Page:** Home `/` — "BENCHMARK (DAILY AVG)" section  
**What the user sees:** The section is labelled "BENCHMARK (DAILY AVG)" and shows "Your avg: 75.3 kg" vs "India avg: 5.2 kg". But "your avg" is being computed as `weeklyTotal / 7 = 527 / 7 = 75.3`. The comparison is misleading — it makes the user look 14× worse than India on the same bar chart, even though you're comparing a daily average that includes a one-off flight to a structural daily average.

**Fix:** Change the benchmark section to compare **totals for the active timeframe** against equivalent period averages:

```tsx
// Benchmarks by timeframe
const benchmarks = {
  daily:   { india: 5.2,  global: 12.9 },  // kg/day
  weekly:  { india: 36.4, global: 90.3 },  // kg/week (× 7)
  monthly: { india: 158,  global: 392  },  // kg/month (× 30.4)
};

// Label changes too
const label = {
  daily:   "vs Daily Averages",
  weekly:  "vs Weekly Averages",
  monthly: "vs Monthly Averages",
};
```

Show: `Your total this {period}: X kg` vs `India avg this {period}: Y kg`.

---

## ISSUE-09 — No Delete Button on Activity Entries

**Severity:** Medium  
**Pages:** Home (Recent Activities), any activity list  
**What the user sees:** Activities can be created but never deleted. Combined with BUG-04 (duplicates), users are stuck with wrong entries permanently.

**Fix:** Already covered in BUG-04 Change 2 above — add a trash icon (🗑) to each activity card. Additionally, consider adding a long-press or swipe-left gesture on mobile for deletion. Minimum viable: a visible trash icon on the right side of each row.

---

## ISSUE-10 — Journey Page Has No CTA When Empty

**Severity:** Medium  
**Page:** Journey `/journey`  
**What the user sees:** Three "0.0" stats with a chart area that says "Make conscious swaps when logging activities to see this chart!" — but there is **no button** to go log an activity. The user is stranded.

**Fix:** Add a CTA button below the empty state message:

```tsx
{totalCO2Avoided === 0 && (
  <div className="text-center space-y-3 py-6">
    <p className="text-gray-500">
      Make conscious swaps when logging activities to see this chart!
    </p>
    <button onClick={() => navigate('/log')} className="btn-primary">
      + Log an Activity
    </button>
  </div>
)}
```

Also add a short explainer: *"When you log a transport activity and tap 'Yes, I considered the alternative', the CO₂ you avoided is tracked here."*

---

## ISSUE-11 — Header Badge Shows Stale Number

**Severity:** Medium  
**Pages:** All pages — the top-right "🌍 X kg this week" badge  
**What the user sees:** After logging new activities, the badge still shows the old total (e.g. shows 263.5 kg while the dashboard shows 527.0 kg). The badge is not reacting to state changes.

**Root cause:** The badge reads from localStorage once on mount but doesn't subscribe to updates made later in the same session.

**Fix:** Use a custom hook that listens for the `storage` event, or use a global state solution (React Context or Zustand):

```tsx
// Simple solution — custom hook that re-reads on storage change
function useWeeklyTotal(): number {
  const [total, setTotal] = useState(() => computeWeeklyTotal());

  useEffect(() => {
    const handler = () => setTotal(computeWeeklyTotal());
    window.addEventListener('storage', handler);
    // Also re-compute when navigating back to any page
    return () => window.removeEventListener('storage', handler);
  }, []);

  return total;
}

function computeWeeklyTotal(): number {
  const activities = JSON.parse(localStorage.getItem('activities') || '[]');
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return activities
    .filter((a: Activity) => new Date(a.date) >= startOfWeek)
    .reduce((sum: number, a: Activity) => sum + a.co2e_kg, 0);
}
```

Note: `window.storage` event only fires for changes from *other* tabs. For same-tab updates, call `setTotal(computeWeeklyTotal())` directly after every `localStorage.setItem` in the save flow.

---

# PART C — MINOR ISSUES 🟢

---

## ISSUE-12 — Weekly Report Page Missing

**Severity:** Minor (but visible gap in PRD features)  
**Page:** Not built — route `/report` does not exist  
**What's missing:** The weekly digest page showing: wins (activities where user chose lower-carbon option), opportunities (top 3 highest emitters with alternatives), and a week-in-a-number summary.

**Fix:** Create `/frontend/src/pages/WeeklyReport.tsx`:

```tsx
// Page structure
<WeeklyReport>
  <WeekSummaryCard total={weekTotal} deltaVsLastWeek={delta} equivalent={equivalentMetaphor} />
  <WinsSection activities={consciousSwapActivities} />
  <OpportunitiesSection topEmitters={top3Activities} suggestions={cachedSuggestions} />
</WeeklyReport>
```

- **Wins:** Filter all activities where `conscious_swap === true` this week
- **Opportunities:** Sort activities by `co2e_kg` descending, take top 3, show their stored `inline_suggestion` text
- **Delta:** `(thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100`
- **Equivalent:** `weekTotal / 0.21` → km in a petrol car (or use a lookup table of equivalents)

Add a "Weekly Report" nav item or a link from the Trends page (which currently shows a "View My Journey →" button — also add "View Weekly Report →" here).

---

# PART D — NEW FEATURES ✨

---

## FEATURE-01 — Receipt / Invoice Scanner (Photo or PDF)

**Priority:** Highest — biggest wow factor for judges  
**Where to add:** Log Activity page `/log` — add a second option below the category cards

### What it does

User uploads a photo or PDF of an electricity bill, shopping receipt, or fuel receipt. The app uses Claude's vision API to extract all relevant items, maps them to emission categories, and shows a review screen where the user confirms before logging multiple entries at once.

### UI Changes

**On `/log` — Log Activity page, add below the 4 category cards:**

```
─────────────────────────────────────────
  OR
─────────────────────────────────────────

[📷 Scan a Receipt or Bill]
Upload a photo or PDF — we'll extract activities automatically
```

**New screen: Receipt Review**

```
📄 We found 3 activities in your receipt

[✓] ⚡ Electricity       245 kWh    → 200.9 kg CO₂e   [remove]
[✓] 🔥 LPG Refill        14.2 kg   → 22.2 kg CO₂e    [remove]
[✓] 🛍 Clothing (1 item) 1 item    → 10.0 kg CO₂e    [remove]

Total: 233.1 kg CO₂e

[Log All 3 Activities]   [Cancel]
```

### Backend Implementation

**New endpoint: `POST /api/v1/scan/receipt`**

```python
@router.post("/scan/receipt")
async def scan_receipt(file: UploadFile):
    # 1. Read file bytes
    image_data = await file.read()
    b64 = base64.b64encode(image_data).decode()

    # 2. Determine media type
    media_type = file.content_type  # "image/jpeg", "image/png", "application/pdf"

    # 3. Call Claude vision API
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64
                    }
                },
                {
                    "type": "text",
                    "text": """Extract all carbon-relevant items from this receipt or bill.
Return ONLY a JSON array, no other text:
[
  {
    "description": "human readable name",
    "category": "transport|energy|food|purchase",
    "activity_type": "one of the valid activity_type keys",
    "quantity": number,
    "unit": "km|kWh|litre|meal|item|kg",
    "confidence": "high|medium|low"
  }
]
Valid activity_type values: car_petrol, car_diesel, car_ev, flight_short, 
flight_long, bus, metro, train, electricity_IN, electricity_EU, lpg, 
generator, meal_meat_heavy, meal_mixed, meal_vegetarian, meal_vegan,
electronics_small, electronics_large, clothing.
If nothing relevant found, return [].
Only include items that have a carbon footprint."""
                }
            ]
        }]
    )

    # 4. Parse response
    raw = response.content[0].text.strip()
    items = json.loads(raw)

    # 5. Calculate CO2e for each item
    for item in items:
        factor = EMISSION_FACTORS.get(item["category"], {}) \
                                  .get(item["activity_type"], {}) \
                                  .get(item["unit"], 0)
        item["co2e_kg"] = round(item["quantity"] * factor, 3)

    return {"items": items, "count": len(items)}
```

### Frontend Implementation

**File: `/frontend/src/components/ReceiptScanner.tsx`**

```tsx
// State machine: idle → uploading → reviewing → saved
const [state, setState] = useState<'idle' | 'uploading' | 'reviewing' | 'saved'>('idle');
const [items, setItems] = useState<ScannedItem[]>([]);
const [selected, setSelected] = useState<Set<number>>(new Set());

async function handleUpload(file: File) {
  setState('uploading');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/v1/scan/receipt', { method: 'POST', body: form });
  const data = await res.json();
  setItems(data.items);
  setSelected(new Set(data.items.map((_: any, i: number) => i))); // all selected by default
  setState('reviewing');
}

function confirmLog() {
  const toLog = items.filter((_, i) => selected.has(i));
  const stored = JSON.parse(localStorage.getItem('activities') || '[]');
  toLog.forEach(item => stored.push({ 
    ...item, 
    id: crypto.randomUUID(), 
    date: new Date().toISOString().split('T')[0],
    conscious_swap: false 
  }));
  localStorage.setItem('activities', JSON.stringify(stored));
  setState('saved');
}
```

### Supported receipt types

- Electricity bills (TNEB, BESCOM, MSEB — extract kWh reading)
- LPG / fuel receipts (extract litres)
- Shopping receipts (extract clothing, electronics items)
- Fuel pump receipts (extract litres, map to car_petrol/diesel)

---

## FEATURE-02 — Natural Language Activity Log

**Priority:** High — low effort, very impressive to demo  
**Where to add:** Log Activity page `/log` — add as a third input option

### What it does

User types a plain English description of their day. The LLM parses it into structured activity entries and shows a confirmation screen before logging.

```
Input:  "I drove 18 km to office and had chicken biryani for lunch"

Output: 
  [✓] 🚗 Petrol Car      18 km    → 3.24 kg CO₂e
  [✓] 🍗 Meat-heavy meal  1 meal  → 6.0 kg CO₂e
  Total: 9.24 kg CO₂e
  [Log These 2 Activities]
```

### UI Changes

**On `/log` — add as a tab or option:**

```
[📝 Describe Your Day]

Today I... [                                          ]
           "e.g. drove 20km to work, had veg lunch"

[Parse Activities →]
```

### Backend Implementation

**New endpoint: `POST /api/v1/activities/parse-natural`**

```python
@router.post("/activities/parse-natural")
async def parse_natural(body: NaturalInputBody):
    prompt = f"""Parse the following description into carbon-emitting activities.
Return ONLY a valid JSON array, no other text or explanation.

Valid categories: transport, energy, food, purchase
Valid activity_type values: car_petrol, car_diesel, car_ev, flight_short,
flight_long, bus, metro, train, electricity_IN, lpg, generator,
meal_meat_heavy, meal_mixed, meal_vegetarian, meal_vegan,
electronics_small, electronics_large, clothing

Description: "{body.text}"

Return format:
[
  {{
    "description": "human readable label",
    "category": "transport",
    "activity_type": "car_petrol",
    "quantity": 18,
    "unit": "km"
  }}
]
If nothing carbon-relevant, return [].
Be conservative — only extract what is clearly stated."""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )
    
    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r'^```json\s*|\s*```$', '', raw, flags=re.MULTILINE)
    items = json.loads(raw)

    # Add CO2e calculations
    for item in items:
        factor = EMISSION_FACTORS \
            .get(item["category"], {}) \
            .get(item["activity_type"], {}) \
            .get(item["unit"], 0)
        item["co2e_kg"] = round(item["quantity"] * factor, 3)

    return {"items": items}
```

### Frontend

Reuse the same `ReviewScreen` component from FEATURE-01 (receipt scanner). Both features extract a list of items → show confirm screen → log all. The review screen is shared logic.

---

## FEATURE-03 — Conversational Carbon Assistant ("Ask Leo")

**Priority:** High — upgrades the existing `/ask` RAG Q&A with minimal backend change  
**Where:** Replace the existing single-turn RAG Q&A at `/ask` (or rename it to `/leo`)

### What it does

A multi-turn chat interface where Leo knows the user's actual logged activity data and answers questions contextually using RAG-grounded responses.

**Example conversation:**

```
User:  "How bad is my flight habit?"
Leo:   "You've logged 2 flights this month totalling 326 kg CO₂e —
        that's 17% of an average Indian's entire annual footprint.
        According to the IEA's 2023 report, aviation is one of the
        hardest sectors to decarbonise, making each avoided flight
        especially impactful."

User:  "What if I took the train next time?"
Leo:   "That single swap for Chennai→Mumbai would save ~100 kg CO₂e.
        Over a year of monthly trips, switching all of them to train
        would save ~1.2 tonnes — equivalent to planting 57 trees."
```

### UI Changes

**File: `/frontend/src/pages/Ask.tsx` — replace single Q&A with chat UI:**

```tsx
// Chat message list (bubbles)
<div className="flex flex-col gap-3 overflow-y-auto h-96">
  {messages.map(msg => (
    <div key={msg.id} className={`chat-bubble ${msg.role}`}>
      {msg.role === 'assistant' && <span className="avatar">🌿</span>}
      <p>{msg.content}</p>
      {msg.sources && <SourceChips sources={msg.sources} />}
    </div>
  ))}
  {isLoading && <ThinkingIndicator />}
</div>

// Input area
<div className="flex gap-2">
  <input
    value={input}
    onChange={e => setInput(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && sendMessage()}
    placeholder="Ask about your carbon footprint..."
  />
  <button onClick={sendMessage}>Send</button>
</div>
```

Keep a history of max 6 messages (3 turns) to stay within token limits.

### Backend Implementation

**Update: `POST /api/v1/rag/query`** — extend existing endpoint to accept conversation history and user data:

```python
class ConversationBody(BaseModel):
    messages: list[dict]          # [{ role, content }] — last 6 messages
    user_activities_summary: str  # pre-computed summary string from frontend
    question: str                 # latest user message

@router.post("/rag/query")
async def rag_query(body: ConversationBody):
    # 1. Retrieve RAG context for the latest question
    chunks = retriever.retrieve(body.question, top_k=3)
    rag_context = "\n\n".join([c["chunk_text"] for c in chunks])

    # 2. Build system prompt with user data + RAG context
    system_prompt = f"""You are Leo, a friendly carbon footprint advisor for CarbonLens.
You have access to the user's actual activity data below. Use it to give specific,
personalised answers. Back up statistics with the climate context provided.
Keep responses concise — 2-4 sentences max unless the user asks for detail.

## User's Activity Summary
{body.user_activities_summary}

## Relevant Climate Context (from IPCC, IEA, GHG Protocol)
{rag_context}

Answer only about carbon footprint and sustainability topics.
If asked anything unrelated, politely redirect."""

    # 3. Build messages array with history
    messages = body.messages + [{"role": "user", "content": body.question}]

    # 4. Call Claude
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=system_prompt,
        messages=messages
    )

    return {
        "answer": response.content[0].text,
        "sources": [{"doc": c["source_doc"], "excerpt": c["chunk_text"][:120]} 
                    for c in chunks]
    }
```

**Frontend: activity summary builder** (send this with every message):

```tsx
function buildActivitySummary(activities: Activity[]): string {
  const total = activities.reduce((s, a) => s + a.co2e_kg, 0).toFixed(1);
  const byCategory = groupBy(activities, 'category');
  const lines = Object.entries(byCategory).map(([cat, acts]) => {
    const catTotal = acts.reduce((s: number, a: Activity) => s + a.co2e_kg, 0).toFixed(1);
    return `${cat}: ${catTotal} kg CO₂e (${acts.length} activities)`;
  });
  return `Total logged: ${total} kg CO₂e\n${lines.join('\n')}`;
}
```

**Suggested starter prompts** (show as chips below the input when conversation is empty):

```
"How does my footprint compare to average?"
"What's my biggest source of emissions?"
"How can I reduce my transport emissions?"
"What would happen if I went vegetarian?"
```

---

## FEATURE-04 — Carbon Budget / Goal Setting

**Priority:** Medium — simple to build, adds emotional engagement  
**Where:** Add to Onboarding (optional step) and accessible from Journey page

### What it does

User sets a monthly CO₂e budget. The dashboard shows a progress ring against that budget. When a new activity would push them over, they see a warning.

### UI Changes

**Dashboard — add budget ring below the main total card:**

```
Monthly Budget
[========70%=====     ]
70.2 / 100 kg used · 14 days left
"You have 29.8 kg remaining"
```

**When logging an activity that exceeds remaining budget:**

```
⚠️ Budget Alert
This Short Flight (163 kg) exceeds your remaining 
monthly budget (29.8 kg) by 133 kg.

[Log Anyway]   [See Alternatives]
```

### Implementation

**Add to Profile (localStorage):**

```typescript
interface Profile {
  // ... existing fields
  monthly_budget_kg?: number;   // null = no budget set
}
```

**New component: `/frontend/src/components/BudgetRing.tsx`**

```tsx
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

function BudgetRing({ used, budget }: { used: number; budget: number }) {
  const pct = Math.min((used / budget) * 100, 100);
  const color = pct < 70 ? '#4CAF50' : pct < 90 ? '#FFA726' : '#EF5350';
  
  return (
    <div className="relative w-32 h-32">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: pct }]}>
          <RadialBar dataKey="value" fill={color} cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{Math.round(pct)}%</span>
        <span className="text-xs text-gray-500">of budget</span>
      </div>
    </div>
  );
}
```

**Budget setup on Journey page** (if no budget set):

```tsx
{!profile.monthly_budget_kg && (
  <div className="card">
    <p className="font-semibold">Set a monthly carbon budget</p>
    <p className="text-sm text-gray-500">Track progress against a personal goal</p>
    <div className="flex gap-2 mt-3">
      {[50, 100, 150, 200].map(kg => (
        <button key={kg} onClick={() => setBudget(kg)} className="btn-outline">
          {kg} kg
        </button>
      ))}
      <input type="number" placeholder="Custom" 
             onBlur={e => setBudget(Number(e.target.value))} />
    </div>
  </div>
)}
```

---

## Implementation Order Summary

Work through in this exact order to maximise score before submission:

| Step | Item | Type | Est. Time |
|---|---|---|---|
| 1 | BUG-01: Fix emission factor (0.255 → 0.158) | Bug | 5 min |
| 2 | BUG-02: Fix donut chart height | Bug | 30 min |
| 3 | BUG-03: Fix timeframe switcher data filter | Bug | 1.5 hrs |
| 4 | BUG-04: Add explicit save step + delete button | Bug | 1.5 hrs |
| 5 | BUG-05: Debug RAG index + health endpoint | Bug | 1–2 hrs |
| 6 | ISSUE-06: Activity display name mapping | Polish | 30 min |
| 7 | ISSUE-07: Move save to explicit action | Polish | 30 min |
| 8 | ISSUE-08: Fix benchmark unit alignment | Polish | 1 hr |
| 9 | ISSUE-09: Delete button (covered in BUG-04) | Polish | — |
| 10 | ISSUE-10: Journey empty state CTA | Polish | 15 min |
| 11 | ISSUE-11: Fix header badge stale state | Polish | 30 min |
| 12 | ISSUE-12: Weekly Report page | Feature | 3 hrs |
| 13 | FEATURE-01: Receipt / Invoice Scanner | Feature | 3–4 hrs |
| 14 | FEATURE-02: Natural Language Log | Feature | 2 hrs |
| 15 | FEATURE-03: Conversational Assistant (Ask Leo) | Feature | 2 hrs |
| 16 | FEATURE-04: Carbon Budget Goal Setting | Feature | 2 hrs |

---

## Shared Components to Build (used across multiple features)

These components are used by FEATURE-01, FEATURE-02, and potentially ISSUE-12. Build them once:

**`ReviewScreen.tsx`** — used by both receipt scanner and NL log
```tsx
// Props: items: ScannedItem[], onConfirm: (selected: ScannedItem[]) => void
// Renders a checkable list of activities with CO2e, confirm button
```

**`ActivitySummaryBuilder.ts`** — used by FEATURE-03 (Leo chat)
```tsx
// Takes Activity[] → returns human-readable summary string for LLM context
```

**`deleteActivity.ts`** — used by BUG-04, ISSUE-09
```tsx
// Takes id: string → removes from localStorage → triggers state update
```

**`filterActivitiesByTimeframe.ts`** — used by BUG-03, ISSUE-11
```tsx
// Takes activities + timeframe → returns filtered array
// Used by Dashboard, header badge, Insights "at a glance" count
```

---

*CarbonLens Fix & Feature Brief — generated June 17 2026*
*Based on live review of https://carbonlens-814809066973.asia-south1.run.app*
