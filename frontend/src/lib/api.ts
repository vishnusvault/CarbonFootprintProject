/**
 * CarbonLens — API Client
 * Typed fetch wrappers for all backend endpoints.
 * Base URL auto-detects: empty string in production (same origin), localhost in dev.
 */

const BASE =
  import.meta.env.DEV ? "http://localhost:8000" : "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // FastAPI 422 returns detail as array of validation error objects — extract readable message
    const detail = err?.detail;
    let message: string;
    if (Array.isArray(detail)) {
      message = detail.map((d: { msg?: string; loc?: string[] }) =>
        d.msg ?? JSON.stringify(d)
      ).join("; ");
    } else if (typeof detail === "string") {
      message = detail;
    } else {
      message = err?.error ?? `Request failed (${res.status})`;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Types (mirror backend Pydantic models) ─────────────────────────────────

export interface Activity {
  id: string;
  date: string;
  category: "transport" | "energy" | "food" | "purchase";
  activity_type: string;
  origin?: string;
  destination?: string;
  distance_km?: number;
  quantity: number;
  unit: string;
  co2e_kg: number;
  conscious_swap: boolean;
  co2_avoided_kg?: number;
  inline_suggestion?: string;
  created_at: string;
}

export interface Profile {
  country: string;
  primary_transport: "car" | "public" | "cycle" | "walk";
  diet: "meat_heavy" | "mixed" | "vegetarian" | "vegan";
  onboarded_at: string;
}

export interface CalculateResponse {
  co2e_kg: number;
  distance_km?: number;
}

export interface SuggestResponse {
  suggestion: string;
  co2_saving_kg: number;
  is_positive_reinforcement: boolean;
}

export interface InsightsResponse {
  summary: string;
  suggestions: string[];
  fact: string;
  sources: Array<{ doc: string; excerpt: string }>;
}

export interface WeeklyReportResponse {
  wins: string[];
  opportunities: string[];
  week_summary: string;
  equivalent: string;
}

export interface RAGQueryResponse {
  answer: string;
  sources: Array<{ doc: string; excerpt: string }>;
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function calculateCO2e(params: {
  category: string;
  activity_type: string;
  origin?: string;
  destination?: string;
  quantity: number;
  unit: string;
  date: string;
}): Promise<CalculateResponse> {
  return apiFetch("/api/v1/activities/calculate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function suggestAlternative(
  activity: Activity,
  ragChunks: string[] = []
): Promise<SuggestResponse> {
  return apiFetch("/api/v1/activities/suggest-alternative", {
    method: "POST",
    body: JSON.stringify({ activity, rag_chunks: ragChunks }),
  });
}

export async function generateInsights(
  activitySummary: object,
  profile: Profile,
  ragChunks: string[] = []
): Promise<InsightsResponse> {
  return apiFetch("/api/v1/insights/generate", {
    method: "POST",
    body: JSON.stringify({
      activity_summary: activitySummary,
      profile,
      rag_chunks: ragChunks,
    }),
  });
}

export async function getWeeklyReport(
  activities: Activity[],
  baselineActivities: Activity[] = [],
  suggestionsShown: string[] = []
): Promise<WeeklyReportResponse> {
  return apiFetch("/api/v1/report/weekly", {
    method: "POST",
    body: JSON.stringify({
      activities,
      baseline_activities: baselineActivities,
      suggestions_shown: suggestionsShown,
    }),
  });
}

export async function ragQuery(question: string, ragChunks: string[] = []): Promise<RAGQueryResponse> {
  return apiFetch("/api/v1/rag/query", {
    method: "POST",
    body: JSON.stringify({ question, rag_chunks: ragChunks }),
  });
}

export async function getCityDistance(
  origin: string,
  destination: string
): Promise<{ distance_km: number | null; found: boolean }> {
  return apiFetch(
    `/api/v1/cities/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
  );
}

export async function getCities(): Promise<{ data: string[] }> {
  return apiFetch("/api/v1/cities");
}

export async function getFactors(): Promise<{ data: Record<string, unknown> }> {
  return apiFetch("/api/v1/factors");
}

export async function healthCheck(): Promise<{ status: string; version: string }> {
  return apiFetch("/api/v1/health");
}
