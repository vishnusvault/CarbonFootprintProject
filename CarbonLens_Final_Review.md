# CarbonLens — Final Review & Remaining Fixes
**Reviewed:** June 17, 2026  
**Build:** Post all-fixes deployment  
**URL:** https://carbonlens-814809066973.asia-south1.run.app  

---

## Summary

The app is in very good shape. The core flow — log an activity → see CO₂e → confirmation screen → dashboard with chart and benchmarks — works cleanly end to end. The UX is polished and the architecture is sound. Three issues remain before submission: a Gemini API quota problem (account-level fix, not a code fix), the timeframe switcher not filtering data, and the "Type it out" button not navigating.

---

## ✅ Confirmed Working — Full List

| Feature | Observation |
|---|---|
| Donut chart renders | Transport ring with legend visible on dashboard |
| Header badge updates live | Jumped from 342.4 → 505.6 kg instantly after saving — no page reload needed |
| Save button always visible | "Save Activity" shows even when AI suggestion fails |
| Activity Logged confirmation screen | Shows activity name, CO₂e, date, "View Dashboard" and "Log Another Activity" buttons |
| Delete button on activity cards | Trash icon present on every card in Recent Activities |
| Benchmark units corrected | Now reads "BENCHMARK (VS WEEKLY AVERAGES)" — India 36.4 kg, Global 90.3 kg |
| Date picker at Step 1 | Shown upfront before category selection — better placement than originally specced |
| Empty state with CTA | Dashboard shows leaf icon + "Log Activity" button when no data exists |
| Journey tab empty state | Has explainer text + "+ Log an Activity" button |
| Carbon Goal / Monthly Budget | New feature built — "Set a Carbon Goal" card visible on dashboard with "Set Monthly Budget" button |
| Ask Leo page | Chat UI built — starter prompt chips, correct layout, input field at bottom |
| Insights + Journey merged into tabs | Single page with "AI Insights" and "My Journey" tab toggle — clean design |
| Gemini API key connected | Error reads "Gemini API quota reached" — key IS wired correctly, quota is the issue not the connection |
| Emission factor corrected | Short Flight Chennai → Mumbai shows 163.23 kg CO₂e (correct: 1033 × 0.158) |

---

## 🔴 Issue 1 — Gemini API Quota Exhausted

### What happens
Every AI-powered feature — inline suggestions after logging, AI Insights button, Ask Leo chat — hits the same error. The inline suggestion shows "AI suggestion unavailable right now." The Insights page shows "⚠️ Gemini API quota reached. Please wait a minute and try again." Ask Leo sends the message but the response bubble never fills in.

### Why this is not a code bug
The Gemini API key is correctly connected to Cloud Run. The error message itself proves this — a missing or invalid key would produce a 401/403 authentication error, not a quota message. The free tier of Gemini 1.5 Flash allows 15 requests per minute and 1,500 requests per day. Testing the app multiple times during development has exhausted this.

### Fix Option A — Enable billing and use paid tier (recommended before submission)

This costs effectively nothing for a hackathon demo. Gemini 1.5 Flash is priced at $0.075 per 1 million input tokens. A full demo session with 10–15 API calls costs less than $0.01.

```bash
# Step 1 — enable billing on the project in Google Cloud Console
# Go to: https://console.cloud.google.com/billing
# Link a billing account to your project

# Step 2 — no code changes needed
# The same API key and the same GEMINI_API_KEY env var continue to work
# Billing removes the free tier quota cap automatically
```

### Fix Option B — Add response caching (free, buys time for the demo)

Cache the last successful AI response in localStorage per activity type. If a cached response is less than 30 minutes old, return it instead of calling the API. This means each unique activity type (Short Flight, Petrol Car, etc.) only calls the API once per 30 minutes regardless of how many times a judge clicks.

**File: wherever the suggestion fetch happens** (likely `services/suggestions.ts` or inside `ActivityLogWizard.tsx`):

```typescript
async function fetchSuggestionWithCache(
  activityType: string,
  origin: string,
  destination: string,
  co2eKg: number
): Promise<string> {
  // Build a cache key from the activity details
  const cacheKey = `suggestion_cache_${activityType}_${origin}_${destination}`;
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  // Check cache first
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { text, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        console.log('[Cache] Returning cached suggestion');
        return text;
      }
    }
  } catch {
    // Cache read failed — continue to API call
  }

  // Call the API
  const result = await callGeminiSuggestionAPI({ activityType, origin, destination, co2eKg });

  // Store in cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      text: result,
      timestamp: Date.now()
    }));
  } catch {
    // Cache write failed — non-critical
  }

  return result;
}
```

Apply the same pattern for AI Insights — cache the full insight response keyed on a hash of the activities array. If activities haven't changed, return the cached insight.

```typescript
// Cache key for insights — based on total CO2e and activity count
const insightsCacheKey = `insights_cache_${totalCo2e.toFixed(1)}_${activityCount}`;
```

### Fix Option C — Switch to Gemini 2.0 Flash (higher free quota)

Gemini 2.0 Flash has a more generous free tier (30 requests/minute). If you can't enable billing, update the model name in the backend:

```python
# backend/services/llm.py
# Change this:
model = genai.GenerativeModel("gemini-1.5-flash")
# To this:
model = genai.GenerativeModel("gemini-2.0-flash-exp")
```

**Recommended approach:** Do Option A (enable billing) AND Option B (add caching). Option A ensures it works. Option B ensures it stays fast and doesn't re-call for every judge interaction.

---

## 🟡 Issue 2 — Timeframe Switcher Does Not Filter Data

### What happens
Switching between Daily / Weekly / Monthly changes the label correctly:
- Daily → "TODAY'S CARBON FOOTPRINT"
- Weekly → "THIS WEEK'S CARBON FOOTPRINT"  
- Monthly → "THIS MONTH'S CARBON FOOTPRINT"

But the number **does not change** — all three tabs show the same total (505.6 kg in testing). The filter logic is not being applied to the data before computing the sum.

### Fix

**File: wherever the dashboard total is computed** (likely `pages/Home.tsx` or `hooks/useActivities.ts`):

**Step 1 — Add the filter function** (if not already present):

```typescript
// utils/filterActivities.ts
export function filterActivitiesByTimeframe(
  activities: Activity[],
  timeframe: 'daily' | 'weekly' | 'monthly'
): Activity[] {
  const now = new Date();

  return activities.filter(a => {
    // Parse date safely — append T00:00:00 to avoid timezone shifts
    const activityDate = new Date(a.date + 'T00:00:00');

    if (timeframe === 'daily') {
      return activityDate.toDateString() === now.toDateString();
    }

    if (timeframe === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday = 0
      startOfWeek.setHours(0, 0, 0, 0);
      return activityDate >= startOfWeek;
    }

    if (timeframe === 'monthly') {
      return (
        activityDate.getMonth() === now.getMonth() &&
        activityDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });
}
```

**Step 2 — Wire it into the dashboard component:**

```typescript
// In Home.tsx / Dashboard component
const allActivities = getActivitiesFromLocalStorage();

// Apply timeframe filter before computing anything
const filteredActivities = filterActivitiesByTimeframe(allActivities, activeTab);

// Use filteredActivities everywhere — total, chart, recent list
const total = filteredActivities.reduce((sum, a) => sum + a.co2e_kg, 0);
const categoryData = buildCategoryData(filteredActivities);
const recentActivities = filteredActivities.slice(-5).reverse();
```

**Step 3 — Fix the donut chart disappearing on tab switch:**

The donut chart renders on Daily but disappears when switching to Weekly even with the same data. Add a `key` prop to force React to remount the chart component when the tab changes:

```tsx
<CategoryChart
  key={activeTab}          // ← forces remount on tab change
  activities={filteredActivities}
/>
```

---

## 🟡 Issue 3 — "Type it out" Button Does Not Navigate

### What happens
Clicking "Type it out" on the Log Activity page highlights the card briefly but nothing happens — no navigation, no modal, no new screen. The route `/log/natural` returns a completely blank page (only the nav bar renders).

### Root cause
One of two things:
1. The button's `onClick` handler calls `navigate('/log/natural')` but the route is not registered in the router
2. The route is registered but the component it points to is empty or has a rendering error

### Fix — two parts

**Part 1: Register the route in the router** (file: `App.tsx` or wherever routes are defined):

```tsx
// In your router configuration — add this route
<Route path="/log/natural" element={<NaturalLanguageLog />} />

// Also add the scan receipt route if not present
<Route path="/log/scan" element={<ScanReceipt />} />
```

**Part 2: Create the NaturalLanguageLog component** (file: `pages/NaturalLanguageLog.tsx` or `components/NaturalLanguageLog.tsx`):

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function NaturalLanguageLog() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedActivity[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  async function handleParse() {
    if (!input.trim()) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/activities/parse-natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, date: new Date().toISOString().split("T")[0] }),
      });
      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setParsedItems(data.items);
        setSelected(new Set(data.items.map((_: any, i: number) => i)));
      } else {
        setError("No carbon activities found. Try being more specific, e.g. 'drove 20 km to work'.");
      }
    } catch {
      setError("Could not parse activities. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function confirmLog() {
    const toLog = parsedItems.filter((_, i) => selected.has(i));
    const stored = JSON.parse(localStorage.getItem("activities") || "[]");
    toLog.forEach(item => stored.push({
      ...item,
      id: crypto.randomUUID(),
      conscious_swap: false,
      created_at: new Date().toISOString(),
    }));
    localStorage.setItem("activities", JSON.stringify(stored));
    window.dispatchEvent(new Event("carbonlens:activity-saved"));
    navigate("/log/saved", { state: { count: toLog.length } });
  }

  // Show review screen if items parsed
  if (parsedItems.length > 0) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold">We found {parsedItems.length} activities</h2>
        <div className="space-y-2">
          {parsedItems.map((item, i) => (
            <div key={i}
              className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center
                ${selected.has(i) ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"}`}
              onClick={() => {
                const next = new Set(selected);
                next.has(i) ? next.delete(i) : next.add(i);
                setSelected(next);
              }}
            >
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-sm text-gray-500">{item.quantity} {item.unit}</p>
              </div>
              <p className="font-bold text-green-800">{item.co2e_kg.toFixed(2)} kg</p>
            </div>
          ))}
        </div>
        <button onClick={confirmLog}
          className="w-full bg-green-700 text-white rounded-xl py-4 font-semibold">
          Log {selected.size} {selected.size === 1 ? "Activity" : "Activities"}
        </button>
        <button onClick={() => setParsedItems([])}
          className="w-full border border-gray-200 rounded-xl py-3 text-gray-600">
          Try Again
        </button>
      </div>
    );
  }

  // Input screen
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Type it out</h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe what you did — we'll figure out the carbon cost.
        </p>
      </div>

      {/* Example prompts */}
      <div className="space-y-2">
        {[
          "I drove 22 km to work and had chicken biryani for lunch",
          "Took a flight from Bangalore to Delhi",
          "Used 200 kWh of electricity this month",
        ].map(example => (
          <button key={example}
            onClick={() => setInput(example)}
            className="w-full text-left p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-green-50">
            "{example}"
          </button>
        ))}
      </div>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Today I drove to work, had a vegetarian lunch..."
        className="w-full border-2 border-gray-200 rounded-xl p-3 h-28 resize-none
                   focus:outline-none focus:border-green-600 text-sm"
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleParse}
        disabled={!input.trim() || isLoading}
        className="w-full bg-green-700 text-white rounded-xl py-4 font-semibold
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Analysing..." : "Parse Activities →"}
      </button>

      <button onClick={() => navigate("/log")}
        className="w-full border border-gray-200 rounded-xl py-3 text-gray-600 text-sm">
        ← Back to Log
      </button>
    </div>
  );
}
```

**Note:** This feature also depends on the Gemini API (Issue 1). Fix Issue 1 first, then verify this works.

---

## Fix Order — Before Submission

| # | Fix | Type | Time |
|---|---|---|---|
| 1 | Enable billing on Google Cloud project | Account setting | 5 min |
| 2 | Add response caching for suggestions + insights | Code | 1 hr |
| 3 | Wire `filterActivitiesByTimeframe` into dashboard total + chart | Code | 1 hr |
| 4 | Add `key={activeTab}` to CategoryChart to fix disappearing donut | Code | 5 min |
| 5 | Register `/log/natural` route in App.tsx | Code | 5 min |
| 6 | Build NaturalLanguageLog component (code above) | Code | 1 hr |

---

## What a Judge Sees After These Fixes

```
1. Lands on dashboard → sees 505.6 kg this week, donut chart,
   benchmark bars, Carbon Goal card                              ✅ Already works

2. Switches to Daily → sees only today's activities summed      ✅ After fix #3

3. Taps Log → Transport → Short Flight → Chennai → Mumbai
   → Confirm → Calculate → 163.23 kg
   → Suggestion loads: "Take the train, saves ~130 kg"           ✅ After fix #1
   → Taps Save → "Activity Logged!" screen                      ✅ Already works
   → Header badge updates instantly                             ✅ Already works

4. Goes to Insights → Get AI Insights
   → Summary paragraph, 3 suggestions, Did You Know fact        ✅ After fix #1+#2

5. Goes to Ask Leo → taps starter chip
   → "How does my footprint compare to average?"
   → Leo responds with personalised answer using their data      ✅ After fix #1

6. Taps "Type it out" → types "drove 20km to work"
   → Review screen: Petrol Car 20km = 3.6 kg CO₂e
   → Logs it                                                     ✅ After fix #5+#6
```

---

*Reviewed June 17, 2026 — live walkthrough of https://carbonlens-814809066973.asia-south1.run.app*
