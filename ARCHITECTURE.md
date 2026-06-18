# CarbonFactors — System Architecture

> Full technical breakdown of the CarbonFactors system: components, data flows, deployment, AI pipeline, and design rationale.

---

## High-Level System Diagram

```mermaid
graph TB
subgraph Client["🌐 Browser (Client)"]
  UI["React + TypeScript\nVite SPA"]
  LS["localStorage\n(Activities + Profile)"]
  UI <--> LS
end

subgraph CloudRun["☁️ Google Cloud Run — Single Container"]
  subgraph Frontend["Static File Server"]
    STATIC["Built React dist/\nserved by FastAPI"]
  end

  subgraph Backend["FastAPI Backend"]
    MAIN["main.py\nFastAPI App"]
    CALC["routers/activities.py\nCO₂e Calculator\nAI Suggestions\nNatural Language Parser"]
    INSIGHTS["routers/insights.py\nWeekly AI Insights"]
    RAG_R["routers/rag.py\nAsk Leafie (Chat)"]
    REPORT["routers/report.py\nWeekly Digest"]
    SCAN["routers/scan.py\nReceipt Scanner"]
  end

  subgraph Services["Services Layer"]
    CALC_SVC["calculator.py\nHaversine + Emission Factors"]
    LLM_SVC["llm.py\nGemini Client\n(JSON + Vision)"]
    PROMPTS["prompts.py\nPrompt Templates"]
    RAG_SVC["rag_ingest.py\nChromaDB Ingestor"]
  end

  subgraph RAG["RAG Knowledge Base"]
    CHROMA["ChromaDB\n(in-container vector store)"]
    DOCS["Climate Documents\n(ingested at build time)"]
  end

  MAIN --> CALC
  MAIN --> INSIGHTS
  MAIN --> RAG_R
  MAIN --> REPORT
  MAIN --> SCAN
  CALC --> CALC_SVC
  CALC --> LLM_SVC
  INSIGHTS --> LLM_SVC
  RAG_R --> LLM_SVC
  RAG_R --> CHROMA
  REPORT --> LLM_SVC
  SCAN --> LLM_SVC
  LLM_SVC --> PROMPTS
  RAG_SVC --> CHROMA
  DOCS --> RAG_SVC
end

subgraph GCP["Google Cloud Platform"]
  SM["Secret Manager\nGOOGLE_API_KEY"]
  GCR["Container Registry\ngcr.io/my-planner-499611/carbonfactors"]
  CB["Cloud Build\ncloudbuild.yaml"]
end

subgraph Gemini["🤖 Google AI — Gemini 2.5 Flash"]
  LLM["generate_content()\nJSON structured output"]
  EMBED["gemini-embedding-001\nVector Embeddings"]
  VISION["Vision API\nReceipt Image Analysis"]
end

UI -->|"REST API calls\n/api/v1/..."| Backend
Backend -->|"Reads secret"| SM
LLM_SVC -->|"Prompt + JSON schema"| LLM
LLM_SVC -->|"Image + prompt"| VISION
RAG_SVC -->|"Embed documents"| EMBED
CHROMA -->|"Similarity search"| RAG_R
CB -->|"Build + push image"| GCR
GCR -->|"Deploy"| CloudRun
```

---

## Request Flow Diagrams

### 1. Manual Activity Logging

```mermaid
sequenceDiagram
  actor User
  participant UI as React UI
  participant LS as localStorage
  participant API as FastAPI /calculate
  participant Gemini as Gemini 2.5 Flash

  User->>UI: Select category, activity, quantity
  User->>UI: Click "Calculate CO₂e"
  UI->>API: POST /api/v1/activities/calculate
  Note over API: Haversine distance (if route)<br/>Lookup emission factor JSON
  API-->>UI: { co2e_kg, distance_km }
  UI->>LS: saveActivity(activity)
  UI->>API: POST /api/v1/activities/suggest-alternative
  Note over API: Build prompt from activity JSON<br/>+ RAG climate context
  API->>Gemini: generate_content(prompt, JSON mode)
  Gemini-->>API: { suggestion, co2_saving_kg }
  API-->>UI: Suggestion card
  User->>UI: Tap "Yes, I considered this ✓"
  UI->>LS: updateActivity(conscious_swap=true)
```

### 2. Ask Leafie (RAG Chat)

```mermaid
sequenceDiagram
  actor User
  participant UI as Ask Leafie UI
  participant API as FastAPI /ask
  participant DB as ChromaDB
  participant Gemini as Gemini 2.5 Flash

  User->>UI: Types question + sends message history
  UI->>API: POST /api/v1/ask\n{ messages[], activity_summary }
  API->>DB: similarity_search(latest question, k=4)
  DB-->>API: Top 4 relevant climate document chunks
  Note over API: Build system prompt:<br/>RAG chunks + user activity context<br/>+ full conversation history
  API->>Gemini: generate_content(conversation)
  Gemini-->>API: { answer, sources[] }
  API-->>UI: Response bubble + source chips
  UI->>User: Displays answer
```

### 3. Receipt Scanner (AI Vision)

```mermaid
sequenceDiagram
  actor User
  participant UI as AILogger Component
  participant API as FastAPI /scan/receipt
  participant Gemini as Gemini Vision

  User->>UI: Uploads receipt photo
  UI->>API: POST /api/v1/scan/receipt\n(multipart/form-data image)
  API->>Gemini: generate_content([image_bytes, prompt])
  Note over Gemini: Extracts food/purchase items<br/>Maps to emission factor keys<br/>Returns structured JSON array
  Gemini-->>API: [{ activity_type, quantity, unit, co2e_kg }]
  API-->>UI: items[]
  UI->>User: Review screen — select items to log
  User->>UI: Confirms selection
  UI->>UI: saveActivity() for each selected item
```

### 4. Cloud Build Deployment

```mermaid
flowchart LR
  DEV["Developer\ngit push"] -->|"triggers"| CB["Cloud Build\ncloudbuild.yaml"]

  CB --> STEP0["Step 0: docker build\n• Install Python deps\n• npm install + vite build\n• Copy dist/ into container\n• RUN rag_ingest.py\n  (embeds climate docs\n  into ChromaDB)"]
  STEP0 --> STEP1["Step 1: docker push\ngcr.io/project/carbonfactors:latest"]
  STEP1 --> STEP2["Step 2: gcloud run deploy\n• Region: asia-south1\n• Memory: 512Mi\n• Mount: google-api-key secret\n• PORT: 8080"]
  STEP2 --> LIVE["✅ Live\ncarbonfactors-*.run.app"]
```

---

## Component Map

### Frontend (`frontend/src/`)

| File | Purpose |
|---|---|
| `App.tsx` | Router, auth guard (redirect to `/onboarding` if no profile) |
| `pages/Dashboard.tsx` | Hero stat, donut chart, benchmark bars, recent activities, budget ring |
| `pages/LogActivity.tsx` | 6-step wizard — date + category → type → details → confirm → suggestion → done |
| `pages/Insights.tsx` | Tabbed: AI Insights + My Journey |
| `pages/Trends.tsx` | 6-month bar chart with category filter |
| `pages/AskClimate.tsx` | Conversational Ask Leafie UI with message history |
| `pages/Onboarding.tsx` | 3-step first-run wizard (country, transport, diet) |
| `components/AILogger.tsx` | AI shortcut panel: receipt scan + natural language entry |
| `components/BudgetRing.tsx` | Animated SVG ring for monthly CO₂ budget |
| `components/TopBar.tsx` | Header with live weekly CO₂ badge |
| `components/BottomNav.tsx` | 5-item nav: Home · Log · Insights · Trends · Ask Leafie |
| `lib/localStorage.ts` | All read/write helpers for activities + profile + timeframe |
| `lib/api.ts` | Typed fetch wrappers for all backend endpoints |

### Backend (`backend/`)

| File | Purpose |
|---|---|
| `main.py` | FastAPI app, CORS, router registration, SPA fallback |
| `config.py` | All env vars in one place — no secrets hardcoded |
| `emission_factors.json` | CO₂e kg per unit for every activity type |
| `cities.json` | Indian + global cities with lat/lon for haversine |
| `routers/activities.py` | `POST /calculate` · `POST /suggest-alternative` · `POST /parse-natural` |
| `routers/insights.py` | `POST /insights/generate` |
| `routers/rag.py` | `POST /ask` — RAG + conversation history |
| `routers/report.py` | `POST /report/weekly` |
| `routers/scan.py` | `POST /scan/receipt` — multipart image |
| `services/calculator.py` | Haversine formula + emission factor lookup |
| `services/llm.py` | `generate_json()` + `generate_json_with_image()` |
| `services/prompts.py` | All prompt templates — centralised, no logic |
| `services/rag_ingest.py` | Reads `rag/documents/`, chunks, embeds, stores in ChromaDB |

---

## Data Model

All user data lives in the **browser's `localStorage`** — the backend is completely stateless.

```typescript
// Activity — stored in localStorage
interface Activity {
  id: string;              // uuid v4
  date: string;            // "YYYY-MM-DD" (user-selected)
  category: string;        // "transport" | "energy" | "food" | "purchase"
  activity_type: string;   // e.g. "car_petrol", "food_biryani"
  origin?: string;         // for route-based transport
  destination?: string;
  distance_km?: number;    // computed by haversine
  quantity: number;
  unit: string;            // "km" | "kWh" | "kg" | "g" | "ml" | "item"
  co2e_kg: number;         // result from /calculate
  conscious_swap: boolean; // did user consider the suggestion?
  co2_avoided_kg?: number; // filled when conscious_swap = true
  created_at: string;      // ISO timestamp
}

// Profile — stored in localStorage
interface Profile {
  country: string;             // "IN" | "US" | "GB" | "EU"
  primary_transport: string;   // "car" | "public" | "cycle" | "walk"
  diet: string;                // "meat_heavy" | "mixed" | "vegetarian" | "vegan"
  monthly_budget_kg?: number;
}
```

---

## Design Decisions

These are the key architectural choices made during the hackathon build, and the reasoning behind them.

### Why `localStorage` instead of a database?

The primary goal was a working prototype in a short timeframe. Using `localStorage` eliminated the need for user authentication, database provisioning, and session management — all non-trivial to build and secure correctly. The trade-off is that data doesn't persist across devices, but for a single-user hackathon demo, this was the right call. A production version would replace this with a proper backend database (e.g. Firestore or PostgreSQL) and auth layer.

### Why a single Cloud Run container instead of separate frontend and backend services?

Keeping frontend and backend in one container meant one deployment pipeline, one `cloudbuild.yaml`, one service URL, and zero CORS complexity in production. FastAPI serves the built React `dist/` as static files and handles API routes under `/api/v1/`. For a hackathon, simplicity of deployment matters more than service isolation.

### Why ChromaDB in-container instead of a managed vector store?

ChromaDB running inside the container means zero external dependencies and the RAG knowledge base is always co-located with the API. The downside is that the vector index resets on every new deployment (it's rebuilt during Docker build time via `rag_ingest.py`). This is acceptable for a read-only knowledge base that doesn't change between deploys. A production system would use a persistent managed store (e.g. Vertex AI Vector Search or Pinecone).

### Why Gemini 2.5 Flash over other models?

The project ran on Google Cloud and was built for Promptwars, making Gemini the natural choice. Gemini 2.5 Flash offers a strong balance of speed and quality for structured JSON generation, has native multimodal support (used for receipt scanning), and has generous free-tier limits well-suited to a hackathon prototype. The `gemini-embedding-001` model handles RAG document embeddings.

### Why all prompts centralised in `prompts.py`?

Prompt engineering is iterative. Keeping all prompts in one file means they can be updated, versioned, and reviewed without touching business logic. Routers call prompt-builder functions from `prompts.py` and pass the results to `llm.py` — no prompt strings are scattered across the codebase.

---

## Security Notes

- **No user accounts / no server-side data** — all activity data stays in the user's browser
- **API key** stored in Google Secret Manager, injected at Cloud Run runtime
- **Prompt injection protection** — all user-supplied strings sanitised before LLM injection via `services/llm.py::sanitize()`
- **CORS** locked to the Cloud Run origin via `CORS_ORIGIN` env var
- **`.gitignore`** excludes `.env`, `__pycache__`, `.venv`, `rag/db/`

---

## Known Limitations & Future Work

This is a hackathon prototype. The following are known simplifications that a production version would address:

| Area | Current state | What a full build would do |
|---|---|---|
| **Food options** | Limited set of common Indian dishes and broad food categories | Comprehensive food database with regional variety, portion sizes, and preparation method factors |
| **Energy options** | Basic electricity and LPG entries | Grid-mix aware calculations per region, appliance-level tracking, renewable energy offsets |
| **Data persistence** | `localStorage` only — no cross-device sync | Authenticated user accounts with cloud-synced data |
| **Emission factors** | Estimated averages from public sources | Certified, regularly updated factors (e.g. DEFRA, EPA, IPCC) with source citations per entry |
| **RAG knowledge base** | Static documents ingested at build time | Regularly updated climate literature, user feedback loop |
| **Vector store** | In-container ChromaDB (resets on redeploy) | Persistent managed vector store |
| **Receipt scanning** | Works well for structured receipts; handwritten or complex layouts may fail | Improved vision prompting and fallback parsing |
| **Offline support** | None — AI features require network | Service worker caching for core features |
| **Multi-user / teams** | Not supported | Household or team carbon tracking with shared dashboards |
