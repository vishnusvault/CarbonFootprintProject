# 🌱 CarbonFactors

> **AI-powered personal carbon footprint tracker** — log your daily activities, get real-time CO₂e calculations, and receive Gemini-powered suggestions to reduce your environmental impact.

**Live App:** [https://CarbonFactors-814809066973.asia-south1.run.app](https://CarbonFactors-814809066973.asia-south1.run.app)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📋 **Manual Activity Logger** | 5-step wizard — pick category, activity type, details, confirm, and get a CO₂e result |
| 📸 **Receipt Scanner** | Upload a photo of a receipt — Gemini Vision extracts food/purchase items and estimates their carbon cost |
| 💬 **Natural Language Log** | Type "drove 22km to work and had biryani for lunch" — AI parses it into structured activities |
| 💡 **Inline AI Suggestions** | After every log, Gemini suggests a lower-carbon alternative specific to what you did |
| 📊 **AI Weekly Insights** | One-click analysis of your week — summary, 3 ranked suggestions, a climate fact, and sources |
| 🤖 **Ask Leafie** | Conversational climate chatbot grounded in a RAG knowledge base — asks are contextualised with your own activity data |
| 🗂️ **My Journey** | Tracks total CO₂ avoided, conscious swap count, best streak, monthly trend, and equivalent metaphors |
| 📈 **Trends** | 6-month bar chart with category filters |
| 🎯 **Carbon Budget** | Set a monthly CO₂ budget — animated ring on dashboard shows progress |
| ⏱️ **Timeframe Switcher** | Dashboard filters between Daily / Weekly / Monthly with correct benchmark comparisons |
| 📅 **Date Picker on Log** | Log activities for any past date (up to 1 year ago) — powers correct timeframe filtering |

---

## 🏗️ Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system diagram and component breakdown.

**Stack at a glance:**

- **Frontend:** React + TypeScript + Vite — all state in `localStorage` (zero backend auth)
- **Backend:** FastAPI (Python) — stateless REST API + RAG pipeline
- **AI:** Google Gemini 2.5 Flash — structured JSON outputs for all AI features
- **RAG:** ChromaDB + Gemini Embeddings — pre-indexed at Docker build time
- **Deployment:** Google Cloud Run via Cloud Build — single container serves both frontend and API

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- A [Google AI Studio API key](https://aistudio.google.com/apikey)

### 1. Clone & Configure

```bash
git clone https://github.com/vishnusvault/CarbonFootprintProject.git
cd CarbonFootprintProject
cp .env.example .env
# Edit .env and set your GOOGLE_API_KEY
```

### 2. Start the Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## ☁️ Deploy to Google Cloud Run

```bash
# One command deploys backend + frontend together
gcloud builds submit --config cloudbuild.yaml
```

The `cloudbuild.yaml` handles:
1. Building the Docker image (RAG ingestion included)
2. Pushing to Google Container Registry
3. Deploying to Cloud Run in `asia-south1`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full deployment flow.

---

## 📁 Project Structure

```
CarbonFootprintProject/
├── backend/
│   ├── main.py                  # FastAPI app + static file serving
│   ├── config.py                # Environment config (no secrets)
│   ├── emission_factors.json    # CO₂e factors for all activity types
│   ├── cities.json              # City list + coordinates for haversine distance
│   ├── routers/
│   │   ├── activities.py        # /calculate, /suggest-alternative, /parse-natural
│   │   ├── insights.py          # /generate — weekly AI insights
│   │   ├── rag.py               # /ask — conversational Ask Leafie endpoint
│   │   ├── report.py            # /weekly — weekly digest report
│   │   └── scan.py              # /receipt — Gemini Vision receipt scanner
│   └── services/
│       ├── calculator.py        # Haversine + emission factor lookup
│       ├── llm.py               # Gemini client (JSON + Vision)
│       ├── prompts.py           # All LLM prompt templates
│       └── rag_ingest.py        # ChromaDB ingestion at startup
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, LogActivity, Insights, Trends, AskClimate …
│       ├── components/          # TopBar, BottomNav, AILogger, BudgetRing
│       └── lib/
│           ├── api.ts           # All backend API calls
│           └── localStorage.ts  # Activity + profile storage helpers
├── rag/
│   └── documents/               # Climate knowledge base (text files)
├── Dockerfile
├── cloudbuild.yaml
└── .env.example
```

---

## 🌍 Emission Factors

Activities are calculated using peer-reviewed emission factors:

| Category | Examples | Source |
|---|---|---|
| Transport | Petrol/Diesel/EV car, flights, bus, metro, train | IPCC AR6, DEFRA 2023 |
| Energy | India grid electricity, LPG, generator | CEA India 2023 |
| Food | 24 items — rice, biryani, dal, chicken, fish, drinks | Poore & Nemecek 2018 |
| Purchase | Electronics (small/large), clothing | lifecycle assessments |
| Negative | Cycling, walking (offset vs car baseline) | DEFRA transport |

---

## 🤖 AI Capabilities

All AI features use **Gemini 2.5 Flash** with structured JSON output:

- **Inline suggestion** — grounded in RAG context, cached 30 min per activity type
- **AI Insights** — weekly summary, 3 ranked suggestions, climate fact with citations
- **Ask Leafie** — RAG-grounded Q&A with full conversation history + personalised context from your own activity data
- **Receipt Scanner** — Gemini Vision parses food/grocery images
- **Natural Language** — "I drove 20km and had chicken for lunch" → structured activity array

---

## 🔐 Environment Variables

See [`.env.example`](./.env.example) for all variables. The only required one:

```
GOOGLE_API_KEY=your_key_here
```

In production (Cloud Run), secrets are stored in **Google Secret Manager** and injected at runtime — nothing sensitive in the codebase.

---

## 📜 License

MIT — built for PromptWars Challenge 3.
