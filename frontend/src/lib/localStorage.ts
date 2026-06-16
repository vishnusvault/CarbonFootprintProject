/**
 * CarbonLens — localStorage helpers
 * All user data (activities + profile) lives in the browser.
 * Backend is fully stateless — it only receives data and returns computed results.
 */

import type { Activity, Profile } from "./api";

const KEYS = {
  activities: "carbonlens_activities",
  profile: "carbonlens_profile",
  timeframe: "carbonlens_timeframe",
} as const;

// ── Activities ─────────────────────────────────────────────────────────────

export function getActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(KEYS.activities);
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
}

export function saveActivity(activity: Activity): void {
  const activities = getActivities();
  activities.push(activity);
  localStorage.setItem(KEYS.activities, JSON.stringify(activities));
  window.dispatchEvent(new Event('carbonlens_storage'));
}

export function updateActivity(id: string, patch: Partial<Activity>): void {
  const activities = getActivities();
  const idx = activities.findIndex((a) => a.id === id);
  if (idx !== -1) {
    activities[idx] = { ...activities[idx], ...patch };
    localStorage.setItem(KEYS.activities, JSON.stringify(activities));
  }
}

export function deleteActivity(id: string): void {
  const activities = getActivities().filter((a) => a.id !== id);
  localStorage.setItem(KEYS.activities, JSON.stringify(activities));
  window.dispatchEvent(new Event('carbonlens_storage'));
}

export function getActivitiesByDateRange(from: Date, to: Date): Activity[] {
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];
  return getActivities().filter((a) => a.date >= fromStr && a.date <= toStr);
}

export function getTodayActivities(): Activity[] {
  const today = new Date().toISOString().split("T")[0];
  return getActivities().filter((a) => a.date === today);
}

export function getWeekActivities(): Activity[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return getActivitiesByDateRange(monday, now);
}

export function getMonthActivities(): Activity[] {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return getActivitiesByDateRange(firstDay, now);
}

export function exportCSV(): string {
  const activities = getActivities();
  const headers = [
    "date",
    "category",
    "activity_type",
    "origin",
    "destination",
    "quantity",
    "unit",
    "co2e_kg",
    "conscious_swap",
    "co2_avoided_kg",
  ].join(",");
  const rows = activities.map((a) =>
    [
      a.date,
      a.category,
      a.activity_type,
      a.origin ?? "",
      a.destination ?? "",
      a.quantity,
      a.unit,
      a.co2e_kg,
      a.conscious_swap,
      a.co2_avoided_kg ?? "",
    ].join(",")
  );
  return [headers, ...rows].join("\n");
}

// ── Profile ────────────────────────────────────────────────────────────────

export function getProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEYS.profile);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

export function clearProfile(): void {
  localStorage.removeItem(KEYS.profile);
}

// ── Timeframe preference ───────────────────────────────────────────────────

export function getTimeframe(): "daily" | "weekly" | "monthly" {
  return (localStorage.getItem(KEYS.timeframe) as "daily" | "weekly" | "monthly") ?? "weekly";
}

export function saveTimeframe(tf: "daily" | "weekly" | "monthly"): void {
  localStorage.setItem(KEYS.timeframe, tf);
}
