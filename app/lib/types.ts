export type LayerId =
  | "flights"
  | "ships"
  | "weather"
  | "natural"
  | "webcams"
  | "breaking";

export type FeedState =
  | "loading"
  | "online"
  | "stale"
  | "offline"
  | "key-required";
export type Credibility = "UNVERIFIED" | "REPORTED" | "CONFIRMED";
export type Severity = "critical" | "high" | "medium" | "low";
export type EventTheme =
  | "conflict"
  | "protest"
  | "disaster"
  | "politics"
  | "other";

export interface SourceAttribution {
  name: string;
  url: string;
  observedAt: string;
}

export interface BaseEntity {
  id: string;
  entityType: "flight" | "ship" | "natural" | "news" | "webcam";
  title: string;
  latitude: number | null;
  longitude: number | null;
  source: SourceAttribution;
}

export interface FlightEntity extends BaseEntity {
  entityType: "flight";
  callsign: string;
  originCountry: string;
  altitudeMetres: number | null;
  speedMetresPerSecond: number | null;
  headingDegrees: number | null;
  onGround: boolean;
}

export interface ShipEntity extends BaseEntity {
  entityType: "ship";
  mmsi: string;
  vesselName: string;
  vesselType: string;
  flag: string;
  destination: string;
  speedKnots: number | null;
  headingDegrees: number | null;
}

export interface NaturalEntity extends BaseEntity {
  entityType: "natural";
  category: string;
  severity: Severity;
  credibility: Credibility;
  magnitude?: number | null;
  description?: string;
}

export interface NewsEntity extends BaseEntity {
  entityType: "news";
  url: string;
  domain: string;
  sourceCountry: string;
  region: string;
  language: string;
  theme: EventTheme;
  severity: Severity;
  credibility: Credibility;
  corroboratingSources: number;
  locationPrecision: "exact" | "local-area" | "source-country";
}

export interface WebcamEntity extends BaseEntity {
  entityType: "webcam";
  webcamId: string;
  city: string;
  country: string;
  previewUrl: string;
  playerUrl: string;
}

export type MapEntity =
  | FlightEntity
  | ShipEntity
  | NaturalEntity
  | NewsEntity
  | WebcamEntity;

export interface FeedHealth {
  state: FeedState;
  checkedAt: string | null;
  message?: string;
}

export interface SearchTarget {
  label: string;
  latitude: number;
  longitude: number;
  boundingBox: [number, number, number, number];
  type: string;
  countryCode?: string;
}

export interface WeatherFrame {
  path: string;
  time: number;
  tileUrl: string;
  sourceUrl: string;
}
