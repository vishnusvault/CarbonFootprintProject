# CarbonLens — Personal Carbon Footprint Tracker
### Product Requirements & Technical Architecture Document
**Promptwars Hackathon · Google Cloud + Hack2Skill · Version 1.1 · June 2026**
Prepared for: Vibecoding / AI Coding Platform (Cursor, Windsurf, VS Code + Copilot, etc.)

---

## Table of Contents
1. [Document Control & Overview](#1-document-control--overview)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Users & Personas](#3-users--personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [RAG Knowledge Base](#7-rag-knowledge-base)
8. [Backend API Specification](#8-backend-api-specification)
9. [Data Models](#9-data-models)
10. [Frontend & UX Specification](#10-frontend--ux-specification)
11. [Deployment — Google Cloud Run](#11-deployment--google-cloud-run)
12. [Hackathon Evaluation Mapping](#12-hackathon-evaluation-mapping)
13. [README Template](#13-readme-template)
14. [Assumptions & Risks](#14-assumptions--risks)

---

## 1. Document Control & Overview

| Field | Value |
|---|---|
| Project Name | CarbonLens – Personal Carbon Footprint Tracker |
| Document Type | PRD + Technical Architecture Spec |
| Challenge | Promptwars – Google Cloud x Hack2Skill, June 2026 |
| Problem Statement | Design a solution that helps individuals understand, track, and reduce their carbon footprint through simple actions and personalized insights |
| Deployment Target | Google Cloud Run (containerised) |
| Document Version | 1.1 |
| Audience | Vibecoding platform, developers, evaluators |

### 1.1 Purpose

This document is the single source of truth for building CarbonLens. It covers functional requirements, non-functional requirements, technical architecture, data models, API contracts, UI/UX guidelines, and deployment instructions in a format directly consumable by an AI-assisted coding platform.

**Philosophy: simple, correct, and architecturally sound — not feature-heavy.** Every decision is biased toward clarity and real-world usability over novelty.

---

## 2. Product Vision & Goals

> *"Give every individual a clear, honest picture of their daily carbon impact — and one concrete action to improve it."*

### 2.1 Goals

- Help individuals log carbon-emitting activities quickly and without friction
- Show inline, contextual alternatives immediately after each log entry
- Present personalised insights grounded in authoritative global climate data (via RAG)
- Track conscious choices made and CO2 avoided — turning data into a personal impact story
- Provide a dashboard with Daily / Weekly / Monthly timeframe switching
- Generate a weekly digest calling out increases, reductions, and recommended swaps
- Deploy as a stateless, scalable Cloud Run service — no heavy infra required

### 2.2 Out of Scope (Explicit)

- Social / community features, leaderboards, friend sharing
- Gamification, badges, streaks
- Marketplace or carbon-offset purchasing
- Business / enterprise multi-user tenancy
- Mobile-native apps (iOS/Android) — web-only responsive
- Complex financial instruments

---

## 3. Users & Personas

### 3.1 Primary Persona — Priya

| Field | Detail |
|---|---|
| Name | Priya, 28, Software Engineer, Chennai |
| Frustration | Knows flying and meat consumption are bad but has no idea of the actual scale |
| Goal | Reduce her monthly footprint by 20% over 3 months |
| Device | Mobile-first browser |
| Tech skill | High, but wants zero config |

### 3.2 Secondary Persona — Ravi

| Field | Detail |
|---|---|
| Name | Ravi, 42, Business Manager, Bangalore |
| Frustration | Takes several flights a month; wants to know equivalent tree offset |
| Goal | Log work travel, see cumulative yearly impact, understand what he could swap |
| Device | Desktop browser |
| Tech skill | Moderate |

---

## 4. Functional Requirements

> Tags: **[HIGH]** = most important, **[MEDIUM]** = check how well solution works under the surface, **[LOW]** = final polish layer. These map directly to hackathon evaluation tiers.

---

### FR-01 — Activity Logging `[HIGH]`

Users log carbon-emitting activities across four categories:

| Category | Activity Types | Quantity + Unit |
|---|---|---|
| Transport | Car (petrol/diesel/EV), flight, bus, metro, train | km travelled |
| Home Energy | Electricity, LPG/gas, generator | kWh, litres, hours |
| Food | Meat-heavy meal, mixed, vegetarian, vegan | meals per day |
| Purchases | Electronics (small/large), clothing | item count |

**For transport (flight/car/train):** The log form accepts origin city + destination city. The backend computes the great-circle distance using a city-distance utility (haversine formula or a small bundled dataset of major Indian/global city pairs). This distance is then used both for the CO2e calculation AND for generating the inline alternative suggestion (FR-02).

Each log entry stores:
```
category, activity_type, origin?, destination?, distance_km?, quantity, unit, date, co2e_kg
```

Emission factors come from a single hardcoded `emission_factors.json` sourced from IPCC AR6 / GHG Protocol (see Section 9).

---

### FR-02 — Inline Alternative Suggestion `[HIGH]`

**Trigger:** Immediately after the user taps "Save" on a log entry.

**Behaviour:**
- The system calls `POST /api/v1/activities/suggest-alternative` with the saved entry
- An LLM prompt is constructed with the activity details + RAG context and asks: *"What is the lower-carbon alternative to this specific activity, and what is the CO2 saving?"*
- A suggestion card slides up / appears below the confirmation toast

**Example outputs:**

| Logged Activity | Inline Suggestion |
|---|---|
| Flight Chennai → Mumbai (1,330 km) | "The Tejas Express covers this route in ~7.5 h and emits ~92% less CO₂ (saves ~147 kg). Worth considering for your next trip." |
| Car trip 40 km (petrol) | "The same trip by metro would save ~6.1 kg CO₂ and cost less. Chennai Metro covers parts of this corridor." |
| Meat-heavy meal | "Swapping to a vegetarian meal saves ~4 kg CO₂ — equivalent to charging your phone ~500 times." |

**Rules:**
- If no meaningful alternative exists (e.g. vegan meal, electric car), show a positive reinforcement card: *"Great choice — this is already one of the lowest-carbon options for this activity."*
- Suggestion is non-blocking. User can dismiss it.
- Suggestion is stored alongside the log entry so the weekly report can reference it.

---

### FR-03 — Dashboard with Timeframe Switcher `[HIGH]`

The dashboard is the home screen and must support three timeframes via a toggle/tab:

| Timeframe | What Shows |
|---|---|
| **Daily** | Today's total CO₂e, breakdown by category, activity log for today |
| **Weekly** | This week's total, day-by-day bar chart, biggest single activity |
| **Monthly** | This month's total, week-by-week bar chart, comparison to last month |

**All timeframes show:**
- Total CO₂e (kg) as a large prominent number
- Category breakdown as a donut chart (Transport / Energy / Food / Purchases)
- A "biggest contributor" call-out card (e.g. "✈ Your Tuesday flight accounts for 68% of this week's footprint")
- Comparison to India average (1.9 tCO₂e/year → ~5.2 kg/day) and global average (~11 kg/day)

**Default timeframe:** Weekly on first load; user's last selected timeframe remembered via localStorage.

---

### FR-04 — AI-Powered Personalised Insights `[HIGH]`

**Trigger:** User taps "Get Insights" button (not automatic — avoids unnecessary LLM calls).

**Input to LLM:**
- User's activity summary for the selected timeframe
- Top-3 RAG-retrieved passages from the knowledge base
- User profile (country, diet, transport mode)

**LLM outputs (structured JSON):**
```json
{
  "summary": "One paragraph comparing user's footprint to benchmarks",
  "suggestions": ["Ranked suggestion 1", "Ranked suggestion 2", "Ranked suggestion 3"],
  "fact": "One 'did you know' fact cited from RAG context",
  "sources": [{"doc": "IPCC AR6", "excerpt": "...short cited passage..."}]
}
```

The three suggestions must be **specific to the user's logged activities**, not generic advice.

---

### FR-05 — Weekly Report & Conscious Choices Digest `[MEDIUM]`

**Trigger:** Automatically available every Monday (or on-demand via "View Weekly Report" button). No email/push required — it's an in-app page.

**Report contains:**

#### 5a. Activity Delta Summary
- Table of all logged activities this week with CO₂e
- Each row tagged: 🔴 **Increased** (vs. your baseline) | 🟢 **Reduced** | ⚪ **Neutral**
- Baseline = user's average from previous 4 weeks (or global average if < 4 weeks of data)

#### 5b. Wins — Activities to Keep Doing
- List of activities where the user chose a lower-carbon option
- Example: *"You took the metro twice this week instead of driving — saved 12.4 kg CO₂"*
- Example: *"3 out of 5 meals logged were vegetarian — well above your average"*

#### 5c. Opportunities — Activities to Improve
- List of the top 3 highest-emission activities with their inline alternatives (from FR-02)
- Example: *"Your Wednesday flight was your single biggest emitter (163 kg). The train alternative would have saved 150 kg."*

#### 5d. Week-in-a-Number
- Total CO₂e this week vs. last week (e.g. "↓ 18% vs last week")
- Equivalent metaphor (e.g. "= driving 420 km in a petrol car" or "= 2.3 trees absorbing for a year")

---

### FR-06 — Conscious Choices Tracker / Impact Story `[MEDIUM]`

This feature answers: *"How am I improving over time? What good choices have I made?"*

**Location:** A dedicated "My Journey" tab or section within the Trends page.

**Displays:**

| Metric | Description |
|---|---|
| Total CO₂ Avoided | Sum of (baseline emission − actual emission) for every entry where the user chose a greener alternative. This is calculated when the user logs an activity that was flagged as a "conscious swap" (e.g. they logged train instead of flight for a similar route). |
| Conscious Swaps Made | Count of log entries where the user explicitly picked a lower-carbon option (detected by comparing activity_type to baseline pattern or flagged by the inline suggestion acceptance) |
| Best Streak | Longest consecutive days where daily CO₂e was below personal average |
| Monthly Trend Arrow | Simple up/down + % vs. previous month |
| Equivalent Impact | E.g. "Your avoided CO₂ equals planting 4 trees" or "= 3 return flights from Chennai to Delhi not taken" |

**How "conscious swap" is detected:**
- When a user logs an activity and the inline suggestion (FR-02) appears, they see a button: **"Yes, I considered this"**
- Tapping it marks the log entry with `conscious_swap: true` and records the `co2_avoided_kg` (baseline − actual)
- If the user skips the suggestion, the entry remains untagged
- The impact story aggregates all `conscious_swap: true` entries

**Tone:** Positive, non-judgmental. Never show a "score" or "grade" — just facts and comparisons.

---

### FR-07 — Historical Trend View `[MEDIUM]`

- Monthly CO₂e bar chart for the last 6 months
- Week-on-week delta badge (↑/↓ arrow + %)
- Historical actual only — no forecasting
- Option to filter by category (show only Transport trend, etc.)

---

### FR-08 — RAG Knowledge Q&A `[MEDIUM]`

- Free-text question input (e.g. "How much does one short-haul flight cost in carbon?")
- Returns a grounded answer with source citation
- Not a chatbot — single-turn Q&A only
- Response includes: answer paragraph + up to 2 source citations (doc name + excerpt)

---

### FR-09 — Onboarding & Profile `[MEDIUM]`

- First-visit 3-question wizard: country, primary transport mode, diet type
- Profile stored in localStorage (no login required)
- Country drives the electricity emission factor used
- Onboarding re-triggers gracefully if localStorage is cleared

---

### FR-10 — CSV Export `[LOW]`

- Download all logged entries for the current month as a CSV
- Columns: date, category, activity_type, origin, destination, quantity, unit, co2e_kg, conscious_swap
- No PDF or chart export required

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Page initial load: < 2 seconds on 4G
- Insight generation (LLM + RAG): < 6 seconds end-to-end
- Inline alternative suggestion: < 4 seconds
- All other API endpoints: p95 < 800 ms

### 5.2 Scalability
- Cloud Run: min 0 instances, max 5
- Stateless backend — any instance handles any request
- ChromaDB runs in-process (no separate server)

### 5.3 Security
- No PII stored server-side — localStorage only for profile and activity data
- All LLM API keys stored as Cloud Run environment secrets, never in code
- HTTPS enforced via Cloud Run's default TLS
- Input sanitised before LLM prompt construction (strip HTML, limit to 500 chars per field)
- CORS restricted to the deployment domain

### 5.4 Code Quality (Hackathon Criterion — HIGH)
- Monorepo: `/frontend`, `/backend`, `/rag`, `/infra` folders at root
- Linting: ESLint + Prettier (frontend), Ruff (Python backend)
- TypeScript strict mode; Python type hints on all functions
- `.env.example` with all required vars — no hardcoded secrets
- README with architecture diagram, setup steps, deploy command

### 5.5 Accessibility (Hackathon Criterion — LOW)
- WCAG 2.1 AA: sufficient colour contrast ratios
- All charts have accessible text/table fallback
- Keyboard navigable (tab order, focus rings)
- Minimum font sizes: 16px body, 14px secondary

### 5.6 Maintainability
- Emission factors isolated in a single `emission_factors.json` — easy to update
- RAG ingestion is a separate, re-runnable script (`rag/ingest.py`)
- Config via environment variables, not code changes

---

## 6. Technical Architecture

### 6.1 Overview

CarbonLens uses a clean three-tier architecture: a React SPA (static files), a Python FastAPI backend (business logic + LLM orchestration), and an in-process ChromaDB vector store for RAG. All three run inside a **single Docker container on Cloud Run**.

### 6.2 Architecture Diagram

```
Browser (React SPA)
    │
    │  HTTPS REST  /api/v1/*
    │  Static files served by FastAPI
    ▼
┌─────────────────────────────────────────────────────┐
│  Google Cloud Run Container                         │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  FastAPI Backend (Python 3.12)               │   │
│  │  ├── /activities  – log + calculate CO₂e    │   │
│  │  ├── /activities/suggest-alternative         │   │
│  │  ├── /insights    – LLM insight generation  │   │
│  │  ├── /rag/query   – RAG Q&A                 │   │
│  │  ├── /report/weekly – weekly digest          │   │
│  │  └── /factors     – emission factor lookup   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  ChromaDB (in-process vector store)          │   │
│  │  Pre-built index baked into Docker image     │   │
│  │  ~20 document chunks, sentence-transformers  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Static file server                          │   │
│  │  FastAPI StaticFiles → Vite build output     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
    │
    │  HTTPS
    ▼
External APIs
├── Anthropic Claude API  (claude-sonnet-4-6)
└── (optional) Google Vertex AI Gemini
```

### 6.3 Why This Architecture — Learning Notes

**Single Container on Cloud Run:**
Cloud Run runs Docker images. Bundling the frontend and backend into one container avoids load balancers, API gateways, and service-mesh complexity. Cloud Run auto-handles HTTPS, scales to zero (cost = $0 when idle), and gives you a public URL immediately. The trade-off is that you can't scale frontend and backend independently — acceptable for a hackathon.

**FastAPI (Python, async):**
FastAPI is asynchronous, type-safe, and auto-generates OpenAPI docs at `/docs`. Python is essential here because the LLM and ML libraries (anthropic, sentence-transformers, chromadb) are Python-first. `async def` endpoints are critical — LLM API calls are I/O-bound (you're waiting for a network response), and async means the server can handle other requests while waiting, instead of blocking an entire thread.

**React SPA + Vite:**
Vite produces a highly optimised static bundle (HTML/CSS/JS). These files are served by FastAPI's `StaticFiles` mount — no separate CDN, Nginx, or web server needed. The SPA handles routing client-side; FastAPI only receives API calls.

**ChromaDB (in-process):**
ChromaDB can run fully in-process — no separate server, no Docker Compose, no network hop. Documents are embedded once at container build time and the vector index is persisted to disk at `/rag/db/`, then baked into the Docker image. At runtime, ChromaDB loads this index into memory. Cold-start cost = negligible. The trade-off: if you need to update the knowledge base, you rebuild the image. Acceptable for a hackathon.

**RAG (Retrieval-Augmented Generation):**
Instead of the LLM relying on what it memorised during training, we supply it with retrieved, authoritative passages at query time. This grounds responses in real data, reduces hallucination, and allows source citation. Flow:
1. Embed user query → vector
2. Cosine similarity search in ChromaDB → top-3 chunks
3. Inject chunks into LLM system prompt under "Relevant Climate Context"
4. LLM reasons from provided context, not memory

**localStorage for user data:**
Storing activity logs and profile in the browser eliminates the need for a database, user authentication, sessions, and GDPR compliance — all out of scope. Data persists across sessions on the same device. The backend is stateless: it receives data in request bodies, computes, and returns results. No server-side state.

**City Distance Utility:**
For transport activities with origin/destination cities, the backend uses the haversine formula on a bundled dataset of ~500 major city coordinates (a small static JSON, ~50 KB). This avoids any external geocoding API dependency and works offline.

### 6.4 Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast build, type safety, component model |
| Styling | Tailwind CSS | Utility-first, no separate CSS files |
| Charts | Recharts | Lightweight, declarative, accessible |
| Backend | Python 3.12 + FastAPI | Async, auto-docs, LLM/ML ecosystem |
| LLM | Anthropic Claude API (claude-sonnet-4-6) | Strong reasoning, structured output, cost-effective |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | Small (80 MB), runs in-process, no API cost |
| Vector Store | ChromaDB (in-process) | Zero infra, fits ~20 document RAG corpus |
| City distances | Bundled JSON + haversine | No external API, works offline |
| Containerisation | Docker (python:3.12-slim base) | Cloud Run requirement |
| Cloud | Google Cloud Run | Hackathon requirement; serverless, autoscale |
| CI | Cloud Build (cloudbuild.yaml) | Build → push → deploy in one trigger |

---

## 7. RAG Knowledge Base

### 7.1 What is RAG — Learning Note

RAG stands for **Retrieval-Augmented Generation**. Instead of relying purely on what the LLM memorised during training, we:

1. Take a corpus of authoritative documents and split them into chunks (~500 tokens each)
2. Embed each chunk into a vector (a list of numbers capturing semantic meaning) using a sentence-transformer model
3. Store all vectors in ChromaDB
4. At query time, embed the user's question the same way, then find the top-N most similar chunks by cosine similarity
5. Inject those chunks as context into the LLM prompt

The LLM can then cite and reason from real, specific data rather than hallucinating statistics. For CarbonLens, this means responses like "According to IPCC AR6, aviation accounts for 2.5% of global CO₂ emissions" instead of vague generalizations.

### 7.2 Recommended Source Documents

Download, chunk, embed, and load these five sources into ChromaDB at Docker build time. All are freely available.

| # | Organisation | Document | Why It Matters |
|---|---|---|---|
| 1 | IPCC (UN) | AR6 Synthesis Report Summary for Policymakers, 2022 — ipcc.ch/report/ar6/syr | Authoritative global emission budgets, temperature targets, sector-level data. The gold standard for climate science citations. |
| 2 | IEA | CO2 Emissions in 2023 (free report) — iea.org/reports/co2-emissions-in-2023 | Country-level and sector energy CO₂ figures; India-specific electricity grid emission factors. Grounds the per-kWh calculations. |
| 3 | GHG Protocol | Emission Factors from Cross-Sector Tools — ghgprotocol.org/calculation-tools | The industry-standard emission factor tables used by all corporate carbon accounting. Directly maps to our emission_factors.json. |
| 4 | Our World in Data | CO2 and GHG Emissions dataset — ourworldindata.org/co2-emissions | Per-capita country comparisons; historical trends. The prose explanations are accessible and great for the "did you know" fact feature. |
| 5 | UNEP | Making Peace with Nature, 2021 — unep.org/resources/making-peace-nature | Quantified lifestyle changes and their impact. Directly useful for generating the inline alternative suggestions and weekly report. |

### 7.3 Ingestion Pipeline

**File: `/rag/ingest.py` — run during Docker build.**

```python
# High-level flow:
# 1. Load PDFs/HTML from /rag/data/
# 2. Split into 500-token chunks, 50-token overlap
#    (LangChain RecursiveCharacterTextSplitter)
# 3. Embed with sentence-transformers all-MiniLM-L6-v2
# 4. Persist ChromaDB collection to /rag/db/
```

For the hackathon, pre-download the documents and commit them to `/rag/data/`. The Docker build runs `ingest.py`, producing the ChromaDB index at `/rag/db/`, which is baked into the final image. No runtime download needed.

### 7.4 RAG Retrieval at Query Time

**File: `/rag/retriever.py`**

```python
def retrieve(query: str, top_k: int = 3) -> list[dict]:
    # Input: user query string
    # 1. Embed query with same sentence-transformer model
    # 2. Query ChromaDB: cosine similarity, top_k=3
    # 3. Return: [{"chunk_text": ..., "source_doc": ..., "page": ...}]
```

Returned chunks are injected into the LLM system prompt under a `## Relevant Climate Context` heading.

---

## 8. Backend API Specification

**Base URL:** `/api/v1`  
**Content-Type:** `application/json`  
**Response envelope:** `{ "data": ..., "error": null }` or `{ "data": null, "error": "message" }`

### 8.1 Endpoints

| Method | Path | Request Body | Response |
|---|---|---|---|
| `POST` | `/activities/calculate` | `{ category, activity_type, origin?, destination?, quantity, unit, date }` | `{ co2e_kg, distance_km? }` |
| `POST` | `/activities/suggest-alternative` | `{ activity }` (full Activity object) | `{ suggestion, co2_saving_kg, is_positive_reinforcement }` |
| `POST` | `/insights/generate` | `{ activities: Activity[], profile: Profile }` | `{ summary, suggestions: string[3], fact, sources }` |
| `POST` | `/report/weekly` | `{ activities: Activity[], baseline_activities: Activity[] }` | `{ delta_summary, wins, opportunities, week_total, equivalent }` |
| `POST` | `/rag/query` | `{ question: string }` | `{ answer, sources: [{doc, excerpt}] }` |
| `GET`  | `/factors` | — | `{ emission_factors }` |
| `GET`  | `/cities/distance` | `?origin=Chennai&destination=Mumbai` | `{ distance_km, bearing }` |
| `GET`  | `/health` | — | `{ status: "ok", version }` |

### 8.2 Emission Calculation Logic

`POST /api/v1/activities/calculate`

```python
def calculate(category, activity_type, origin, destination, quantity, unit):
    if origin and destination:
        distance_km = city_distance(origin, destination)
        quantity = distance_km  # override user input with computed distance
    co2e_kg = quantity * FACTORS[category][activity_type][unit]
    return round(co2e_kg, 3)
```

### 8.3 Alternative Suggestion — LLM Prompt Template

```
SYSTEM:
You are CarbonLens, a climate advisor. The user just logged an activity.
Suggest the single most practical lower-carbon alternative for this specific activity.
Be concrete: name the alternative, estimate the CO₂ saving in kg, and mention one real-world detail
(route name, time difference, cost comparison if obvious).
If no meaningful lower-carbon alternative exists, write a positive reinforcement message.

Use ONLY the context below. Do not invent statistics.

## Relevant Climate Context
{{ rag_chunks }}

## Logged Activity
{{ activity_json }}

USER: Suggest a lower-carbon alternative.
RESPOND in JSON: { "suggestion": "...", "co2_saving_kg": 0.0, "is_positive_reinforcement": false }
```

### 8.4 Insights Generation — LLM Prompt Template

```
SYSTEM:
You are CarbonLens. Use ONLY the context provided. Be specific and cite numbers.
Respond only in JSON with keys: summary, suggestions (array of 3 strings), fact.

## Relevant Climate Context
{{ rag_chunks }}

## User Activity Summary
{{ activity_summary }}

## User Profile
Country: {{ country }} | Diet: {{ diet }} | Primary transport: {{ transport }}

USER: Generate personalised insights.
```

### 8.5 Weekly Report — LLM Prompt Template

```
SYSTEM:
You are CarbonLens. Generate a weekly digest.
Output JSON with keys:
- wins: array of strings (activities where user chose lower-carbon option)
- opportunities: array of max 3 strings (highest-emission activities + alternatives)
- week_summary: one sentence with total CO₂e and % change vs baseline

## User's This-Week Activities
{{ this_week_json }}

## User's Baseline (4-week average or global average)
{{ baseline_json }}

## Inline Suggestions Already Shown
{{ suggestions_shown }}
```

---

## 9. Data Models

### 9.1 Activity Entry (stored in browser localStorage)

```typescript
interface Activity {
  id: string;                  // uuid v4
  date: string;                // "YYYY-MM-DD"
  category: "transport" | "energy" | "food" | "purchase";
  activity_type: string;       // e.g. "flight_economy", "car_petrol"
  origin?: string;             // city name (transport only)
  destination?: string;        // city name (transport only)
  distance_km?: number;        // computed from origin/destination
  quantity: number;
  unit: string;                // "km" | "kWh" | "meal" | "item" | "litre"
  co2e_kg: number;             // returned by backend, stored here
  conscious_swap: boolean;     // true if user tapped "Yes, I considered this"
  co2_avoided_kg?: number;     // baseline_co2e - actual co2e (if conscious_swap)
  inline_suggestion?: string;  // the suggestion shown after logging
  created_at: string;          // ISO-8601
}
```

### 9.2 User Profile (browser localStorage)

```typescript
interface Profile {
  country: string;             // ISO 3166-1 alpha-2, e.g. "IN"
  primary_transport: "car" | "public" | "cycle" | "walk";
  diet: "meat_heavy" | "mixed" | "vegetarian" | "vegan";
  onboarded_at: string;
}
```

### 9.3 Emission Factors Config (`/backend/emission_factors.json`)

```json
{
  "transport": {
    "car_petrol":     { "km": 0.180 },
    "car_diesel":     { "km": 0.171 },
    "car_ev":         { "km": 0.053 },
    "flight_short":   { "km": 0.255 },
    "flight_long":    { "km": 0.195 },
    "bus":            { "km": 0.089 },
    "metro":          { "km": 0.041 },
    "train":          { "km": 0.041 }
  },
  "energy": {
    "electricity_IN": { "kWh": 0.820 },
    "electricity_EU": { "kWh": 0.233 },
    "electricity_US": { "kWh": 0.386 },
    "lpg":            { "litre": 1.560 },
    "generator":      { "hour": 2.600 }
  },
  "food": {
    "meal_meat_heavy":  { "meal": 6.0 },
    "meal_mixed":       { "meal": 3.5 },
    "meal_vegetarian":  { "meal": 2.0 },
    "meal_vegan":       { "meal": 1.5 }
  },
  "purchase": {
    "electronics_small": { "item": 30 },
    "electronics_large": { "item": 200 },
    "clothing":          { "item": 10 }
  },
  "_sources": {
    "car_petrol": "IPCC AR6 Table 10.SM.4",
    "flight_short": "GHG Protocol Cross-Sector Tool 2023",
    "electricity_IN": "CEA India Emission Factor 2024 (0.82 kgCO2/kWh)",
    "meal_meat_heavy": "Poore & Nemecek 2018, Science"
  }
}
```

> **Note:** Every factor has a `_sources` entry. This documents where each number comes from — important for hackathon judges questioning accuracy.

### 9.4 City Distance Dataset (`/backend/cities.json`)

A static JSON of ~500 major cities with lat/lon coordinates. The haversine formula computes great-circle distance. No external API call.

```json
{
  "Chennai": { "lat": 13.0827, "lon": 80.2707 },
  "Mumbai":  { "lat": 19.0760, "lon": 72.8777 },
  ...
}
```

---

## 10. Frontend & UX Specification

### 10.1 Pages & Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Dashboard | Timeframe switcher (Daily/Weekly/Monthly), total CO₂e, category donut chart, biggest contributor card, quick-add button |
| `/log` | Log Activity | Step-by-step wizard: pick category → pick type → enter origin/destination or quantity → confirm → see inline suggestion |
| `/insights` | AI Insights | User-triggered, shows summary paragraph + 3 ranked suggestions + 1 RAG fact + source citations |
| `/trends` | Trends | 6-month bar chart, week-on-week delta, category filter, link to "My Journey" |
| `/journey` | My Journey | Conscious choices tracker: total CO₂ avoided, swap count, best streak, equivalent metaphors |
| `/report` | Weekly Report | Wins list, opportunities list, week-in-a-number, delta vs. last week |
| `/ask` | Ask Climate | Single-turn RAG Q&A with source citation |
| `/onboarding` | Onboarding | 3-step first-run wizard (country, transport, diet) |

### 10.2 Dashboard Timeframe Switcher — Detailed Spec

```
┌─────────────────────────────────────────────┐
│  CarbonLens              [Daily|Weekly|Monthly] ◀ tab toggle
├─────────────────────────────────────────────┤
│  📊 This Week                                │
│  ┌──────────────────┐                        │
│  │  47.3 kg CO₂e    │  ↓ 18% vs last week   │
│  └──────────────────┘                        │
│                                              │
│  [Donut chart: Transport 68% | Food 22% | Energy 8% | Other 2%]
│                                              │
│  🔴 Biggest contributor                      │
│  ✈ Tuesday flight: 32.1 kg (68% of total)  │
│                                              │
│  vs India avg: 36.4 kg/week  ▲ 30% over avg │
│  vs Global avg: 77 kg/week   ▼ 39% below    │
│                                              │
│  [+ Log Activity]  [Get Insights]            │
└─────────────────────────────────────────────┘
```

Switching the tab re-renders all stats and the chart for the selected timeframe. No page reload.

### 10.3 Log Activity Wizard — Step Flow

```
Step 1: Category
[🚗 Transport] [⚡ Energy] [🥗 Food] [🛍 Purchase]

Step 2 (Transport selected): Activity Type
[✈ Flight] [🚗 Car] [🚌 Bus] [🚇 Metro] [🚆 Train]

Step 3 (Flight selected): Origin & Destination
From: [Chennai        ▼]   To: [Mumbai         ▼]
      Computed distance: 1,328 km (shown after selection)

Step 4: Confirm
  Carbon footprint: 33.9 kg CO₂e
  [← Back]  [Save Entry]

Step 5: Inline Suggestion (slides up after Save)
  ┌──────────────────────────────────────────────────┐
  │ 🌱 Lower-carbon alternative                       │
  │ The Tejas Express covers Chennai→Mumbai in ~7h   │
  │ and emits ~92% less CO₂ (saves ~31 kg).          │
  │                                                  │
  │ [Yes, I'll consider this ✓]  [Dismiss]           │
  └──────────────────────────────────────────────────┘
```

### 10.4 My Journey Page — Layout

```
┌─────────────────────────────────────────────┐
│  🌱 My Impact Journey                        │
├─────────────────────────────────────────────┤
│  CO₂ Avoided to Date                        │
│  ┌──────────────┐                           │
│  │  147.3 kg    │  = not taking 1 return    │
│  └──────────────┘    flight to Delhi        │
│                                              │
│  Conscious Swaps Made:   12                  │
│  Best Low-Carbon Streak: 5 days              │
│  This Month vs Last:     ↓ 23%              │
│                                              │
│  [Bar chart: monthly CO₂ avoided, 6 months] │
└─────────────────────────────────────────────┘
```

### 10.5 Design Principles

- **Green-earth palette:** Primary `#1B6B3A` (forest green), background `#F7FAF8`, accent `#4CAF50`, neutral `#4A5568`
- **Mobile-first:** Single column on mobile, two-column on tablet+. Touch targets ≥ 44px.
- **One action per screen:** Log flow is a wizard — not a giant form.
- **Progressive disclosure:** Large total number, drill into categories on tap.
- **No spinner hell:** LLM calls show skeleton loader with estimated wait: *"Analysing your footprint — ~5 s"*
- **No empty states without a CTA:** Always show a Log Activity button prominently if no data exists
- **Positive framing:** Never show a "bad score". Show progress, not judgment.

### 10.6 Component Inventory

| Component | File | Purpose |
|---|---|---|
| `TimeframeSwitcher` | components/TimeframeSwitcher.tsx | Daily/Weekly/Monthly tab toggle |
| `DashboardStats` | components/DashboardStats.tsx | Total CO₂e + comparisons |
| `CategoryChart` | components/CategoryChart.tsx | Recharts donut + accessible table fallback |
| `BiggestContributorCard` | components/BiggestContributorCard.tsx | Highlighted top emitter |
| `ActivityLogWizard` | components/ActivityLogWizard.tsx | Multi-step logging form |
| `CitySelector` | components/CitySelector.tsx | Searchable dropdown from cities.json |
| `InlineSuggestionCard` | components/InlineSuggestionCard.tsx | Slides up after save; conscious swap button |
| `InsightCard` | components/InsightCard.tsx | Summary + 3 suggestions + fact + sources |
| `WeeklyReport` | components/WeeklyReport.tsx | Wins + opportunities + delta |
| `JourneyStats` | components/JourneyStats.tsx | CO₂ avoided, swaps, streak, metaphor |
| `TrendChart` | components/TrendChart.tsx | Recharts bar chart, 6 months |
| `RAGQueryBox` | components/RAGQueryBox.tsx | Q&A input + answer + source chips |
| `OnboardingWizard` | components/OnboardingWizard.tsx | 3-step first-run setup |
| `TopBar` | components/TopBar.tsx | App name + weekly total badge + nav |

---

## 11. Deployment — Google Cloud Run

### 11.1 Folder Structure

```
carbonlens/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/           # useActivities, useProfile, useInsights
│   │   ├── lib/
│   │   │   ├── localStorage.ts
│   │   │   └── api.ts       # typed fetch wrappers
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── routers/
│   │   ├── activities.py
│   │   ├── insights.py
│   │   ├── report.py
│   │   └── rag.py
│   ├── services/
│   │   ├── calculator.py    # emission calc logic
│   │   ├── llm.py           # Anthropic API calls
│   │   ├── cities.py        # haversine distance
│   │   └── prompts.py       # all LLM prompt templates
│   ├── emission_factors.json
│   ├── cities.json
│   ├── requirements.txt
│   └── tests/
├── rag/
│   ├── ingest.py
│   ├── retriever.py
│   └── data/                # source PDFs (committed, ~10 MB total)
├── Dockerfile
├── cloudbuild.yaml
├── .env.example
└── README.md
```

### 11.2 Dockerfile

```dockerfile
# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist ./static

# Copy RAG pipeline + pre-downloaded source docs
COPY rag/ ./rag/

# Pre-build the ChromaDB index at image build time
RUN python rag/ingest.py

ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 11.3 Cloud Run Deploy Commands

```bash
# 1. Set your project ID
export PROJECT_ID=your-gcp-project-id

# 2. Build and push image to Google Container Registry
gcloud builds submit --tag gcr.io/$PROJECT_ID/carbonlens

# 3. Deploy to Cloud Run
gcloud run deploy carbonlens \
  --image gcr.io/$PROJECT_ID/carbonlens \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

# 4. Get your deployment URL
gcloud run services describe carbonlens \
  --region asia-south1 \
  --format 'value(status.url)'
```

### 11.4 Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — set as Cloud Run secret |
| `APP_ENV` | `production` or `development` |
| `RAG_DB_PATH` | `/app/rag/db` (default ChromaDB persistence dir) |
| `LOG_LEVEL` | `INFO` |
| `CORS_ORIGIN` | Cloud Run service URL |

### 11.5 requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
anthropic==0.28.0
chromadb==0.5.0
sentence-transformers==3.0.0
langchain-text-splitters==0.2.0
pydantic==2.7.0
httpx==0.27.0
python-dotenv==1.0.1
pytest==8.2.0
ruff==0.4.5
```

---

## 12. Hackathon Evaluation Mapping

| Criterion | How CarbonLens Addresses It | Evidence Location | Tier |
|---|---|---|---|
| Code Quality | TypeScript strict + Python type hints + Ruff; clean monorepo structure; no dead code; meaningful commit messages | `/frontend/src`, `/backend/*.py` | HIGH |
| Security | No PII server-side; API keys as Cloud Run secrets; input sanitised before LLM prompt; HTTPS default; CORS restricted | `.env.example`, `services/llm.py sanitise()` | HIGH |
| Efficiency | In-process ChromaDB (no network hop); async FastAPI; Vite tree-shaking; Docker multi-stage build; static emission factor lookup is O(1) | `Dockerfile`, `rag/retriever.py` | HIGH |
| Testing | Unit tests: emission calculation, haversine distance, RAG retrieval smoke test, API contract tests via pytest | `/backend/tests/*.py` | MEDIUM |
| Accessibility | WCAG 2.1 AA colours; keyboard nav; chart table fallback; semantic HTML; 16px min font | `/frontend/src/components/*.tsx` | LOW |

---

## 13. README Template (for GitHub Submission)

The submitted README must contain these sections:

```markdown
# CarbonLens — Personal Carbon Footprint Tracker

**Live Demo:** https://carbonlens-xxxx.run.app

## Vertical
Sustainability / Climate Action — helping individuals track, understand,
and reduce their personal carbon footprint.

## Approach & Logic
Users log daily activities across four categories (transport, energy, food,
purchases). A backend emission calculator converts each entry to kg CO₂e
using IPCC/GHG Protocol emission factors. When a transport activity is
logged with origin/destination cities, the system computes the actual route
distance and immediately suggests a lower-carbon alternative via an LLM
prompt grounded in RAG-retrieved climate data.

The dashboard shows totals across Daily/Weekly/Monthly timeframes.
A weekly report calls out improvements and areas to improve.
A "My Journey" page tracks CO₂ avoided and conscious choices made over time.

## How the Solution Works
React SPA → FastAPI backend (emission calc, city distances, LLM calls)
→ ChromaDB RAG (sentence-transformers embeddings of 5 authoritative
climate reports) → Anthropic Claude API → structured JSON → rendered UI.

## Architecture
[Include Mermaid diagram from Section 6.2]

## RAG Knowledge Sources
1. IPCC AR6 Synthesis Report (2022)
2. IEA CO2 Emissions in 2023
3. GHG Protocol Emission Factors
4. Our World in Data – CO2 Emissions
5. UNEP Making Peace with Nature (2021)

## Assumptions
- No user authentication; data persists in browser localStorage
- India electricity grid factor (0.82 kgCO₂/kWh) used as default
- Emission factors sourced from IPCC AR6 and GHG Protocol
- LLM used only for insight/suggestion generation, never for calculations
- City distances computed via haversine on bundled coordinate dataset

## Local Setup
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
python ../rag/ingest.py  # build RAG index once
uvicorn main:app --reload

# Or with Docker:
docker build -t carbonlens . && docker run -p 8080:8080 carbonlens
```

---

## 14. Assumptions & Risks

### 14.1 Key Assumptions

- Anthropic API key is available as a Cloud Run secret during evaluation
- Evaluator tests on a modern browser (Chrome/Firefox/Safari, latest)
- RAG source documents are pre-downloaded and committed to `/rag/data/` — no runtime internet download needed for RAG
- localStorage provides sufficient persistence for demo (single device)
- India (IN) is the default country unless changed in onboarding
- City dataset covers all major Indian cities and global capitals

### 14.2 Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM API rate limit during demo | Medium | Cache last insight + last suggestion in localStorage for 10 min |
| ChromaDB cold-start latency | Low | Index pre-built in Docker; loads from disk in < 1 s |
| Cloud Run cold start > 5 s | Low | Multi-stage Docker keeps image ~500 MB; uvicorn starts in < 1 s |
| Emission factor accuracy questioned | Medium | Every factor documented with source in `_sources` key of emission_factors.json |
| City not found in dataset | Low | Fallback to manual km entry; show "City not found — enter distance manually" |
| localStorage cleared mid-demo | Low | Graceful empty state with re-onboarding prompt |

---

*CarbonLens PRD v1.1 — Promptwars 2026 — Built for vibecoding platforms*
