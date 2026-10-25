import seed from "./data/nagoya_trip_v1_2_seed.json";
import type { TripData, TripEvent, Place } from "./models";

// TypeScript widens JSON string literals; validate the status union before use.
function parseTimeStatus(value: string): TripEvent["timeStatus"] {
  if (
    value === "source_flight" ||
    value === "estimate" ||
    value === "user_confirmed" ||
    value === "planned"
  )
    return value;
  throw new Error(`Unknown event time status: ${value}`);
}
export const trip: TripData = {
  ...seed,
  days: seed.days.map((day) => ({
    ...day,
    events: day.events.map((event) => ({
      ...event,
      timeStatus: parseTimeStatus(event.timeStatus),
    })),
  })),
};
export const hotel = trip.places.find(
  (p) => p.id === trip.accommodation.placeId,
)!;
export const findPlace = (id: string | null) =>
  trip.places.find((p) => p.id === id);
export const formatDate = (date: string) => date.slice(5).replace("-", "/");
export const jpDate = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: trip.metadata.tripTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function journey(now = new Date()) {
  const date = jpDate(now);
  const index = trip.days.findIndex((d) => d.date === date);
  const before = date < trip.metadata.dates.start;
  return {
    date,
    before,
    after: date > trip.metadata.dates.end,
    index,
    day: trip.days[index < 0 ? (before ? 0 : trip.days.length - 1) : index],
    countdown: Math.max(
      0,
      Math.round(
        (Date.parse(trip.metadata.dates.start) - Date.parse(date)) / 86400000,
      ),
    ),
  };
}
export const timeLabels: Record<TripEvent["timeStatus"], string> = {
  source_flight: "航班表定",
  estimate: "預估",
  user_confirmed: "已確認時間",
  planned: "行程安排",
};
export function eventTime(e: TripEvent) {
  if (e.time) return `${e.timeStatus === "estimate" ? "預估 " : ""}${e.time}`;
  return e.type === "meal"
    ? "晚餐"
    : e.type === "shopping"
      ? "下午"
      : "中午～下午";
}
export function eventTimezone(e: TripEvent) {
  if (e.id === "d1-flight" || e.id === "d6-taipei") return "台灣時間";
  return e.time ? "日本時間" : "";
}
export function safeUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export const mapsUrl = (p: Place) =>
  safeUrl(p.mapsUrl) ||
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " 日本 名古屋")}`;
export const categoryLabels: Record<string, string> = {
  hotel: "住宿",
  transport: "交通",
  attraction: "景點",
  food: "美食",
  shopping: "散步・購物",
  backup: "備用景點",
};
export const placeDay = (id: string) =>
  trip.days.filter((d) => d.events.some((e) => e.placeId === id));
export const placeReferences = (id: string) => [
  ...new Set(
    trip.days.flatMap((d) =>
      d.events
        .filter((e) => e.placeId === id)
        .flatMap((e) => e.references || []),
    ),
  ),
];
export function loadStored<T>(
  name: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  try {
    const raw = localStorage.getItem(`nagoya-v1.2:${name}`);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return valid(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
export const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
