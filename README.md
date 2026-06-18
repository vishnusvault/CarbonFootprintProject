# 🌱 CarbonFactors

> **AI-powered personal carbon footprint tracker** — log your daily emissions, get actionable AI suggestions, and watch your habits change over time.

**🚀 Live App:** [https://carbonlens-814809066973.asia-south1.run.app](https://carbonlens-814809066973.asia-south1.run.app)

Built for **Promptwars Hackathon, June 2026** · Powered by Google Gemini 2.5 Flash · React + FastAPI · Deployed on Google Cloud Run

> ⚠️ **Prototype Notice:** This is a hackathon prototype, not a production system. The core features are live and working, but options for food and energy logging are currently limited in scope compared to what a fully built solution would offer. Think of it as an early glimpse, not a finished product. Be gentle with it!

---

## 💡 The Idea

*"What gets measured gets managed."*

Most people want to live more consciously but wait for a major lifestyle change to start. CarbonFactors is built on a simpler belief — awareness is the first step. You don't need to go zero-waste or buy an EV tomorrow. You just need to start seeing your habits clearly, today.

CarbonFactors makes that easy: log what you did, let AI tell you what it cost the planet, and discover small swaps that actually add up.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📋 **Manual Activity Logger** | 5-step wizard — pick category → type → details → confirm → get AI suggestion |
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

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system diagram, sequence flows, and component breakdown.

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
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux
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
│   │   ├── report.py            # /weekly — weekly digest
│   │   └── scan.py              # /receipt — multipart image upload
│   └── services/
│       ├── calculator.py        # Haversine formula + emission factor lookup
│       ├── llm.py               # Gemini client (JSON + Vision)
│       ├── prompts.py           # All prompt templates — centralised, no logic
│       └── rag_ingest.py        # Reads rag/documents/, chunks, embeds, stores in ChromaDB
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, LogActivity, Insights, Trends, AskClimate, Onboarding
│       ├── components/          # AILogger, BudgetRing, TopBar, BottomNav
│       └── lib/                 # localStorage helpers + typed API wrappers
├── rag/
│   └── documents/               # Climate knowledge base — ingested at build time
├── .env.example
├── .gitignore
├── cloudbuild.yaml
└── Dockerfile
```

---

## 🌍 Emission Factors

Carbon calculations use emission factors from `backend/emission_factors.json`. These are based on commonly referenced estimates and are intended for awareness and relative comparison, not precise scientific measurement. Transport uses the Haversine formula for distance calculation between Indian and global cities.

---

## 🤖 AI Capabilities

All AI features are powered by **Google Gemini 2.5 Flash** via the `google-generativeai` Python SDK:

| Feature | Model capability used |
|---|---|
| CO₂ suggestions | Structured JSON generation |
| Natural language log | JSON extraction from free text |
| Weekly insights | Long-form structured analysis |
| Ask Leafie (RAG chat) | Retrieval-augmented generation with ChromaDB |
| Receipt scanner | Gemini Vision (multimodal image input) |

---

## 🔒 Environment Variables

See `.env.example` for the full list. Key variables:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
CORS_ORIGIN=http://localhost:5173
```

In production, `GOOGLE_API_KEY` is stored in **Google Secret Manager** and injected at Cloud Run runtime — never hardcoded.

---

## 🙏 Acknowledgements

Built with Google Gemini, FastAPI, React, ChromaDB, and deployed on Google Cloud Run.

*Promptwars Hackathon · June 2026*
