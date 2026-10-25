export interface TripEvent {
  id: string;
  title: string;
  type: string;
  time: string | null;
  timeStatus: "source_flight" | "estimate" | "user_confirmed" | "planned";
  placeId: string | null;
  bookingStatus: string;
  note?: string;
  references?: string[];
}
export interface Day {
  date: string;
  weekday: string;
  theme: string;
  events: TripEvent[];
}
export interface Place {
  id: string;
  name: string;
  category: string;
  address: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  verifiedLocation: boolean;
}
export interface Food {
  id: string;
  title: string;
  referenceUrl: string;
  kind: string;
  scheduled: boolean;
}
export interface Resource {
  id: string;
  title: string;
  url: string;
  kind: string;
}
export interface Flight {
  id: string;
  date: string;
  flightNo: string;
  airline: string;
  from: string;
  to: string;
  departureLocal: string;
  arrivalLocal: string;
  source: string;
  status: string;
}
export interface TripData {
  metadata: {
    tripName: string;
    dates: { start: string; end: string };
    tripTimezone: string;
    version: string;
  };
  flights: Flight[];
  accommodation: {
    placeId: string;
    checkInDate: string;
    checkOutDate: string;
    estimatedArrivalLocal: string;
    checkOutPlanLocal: string;
  };
  days: Day[];
  places: Place[];
  foodCandidates: Food[];
  resources: Resource[];
  flags: Record<string, boolean>;
  privacy: Record<string, boolean>;
}
export interface CheckItem {
  id: string;
  label: string;
  done: boolean;
}
