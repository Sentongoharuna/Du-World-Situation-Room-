"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  CloudRain,
  Crosshair,
  Flame,
  Globe2,
  Layers3,
  Menu,
  Plane,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShipWheel,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DetailSheet } from "@/app/components/detail-sheet";
import type {
  FeedHealth,
  FlightEntity,
  LayerId,
  MapEntity,
  NaturalEntity,
  NewsEntity,
  SearchTarget,
  ShipEntity,
  WeatherFrame,
  WebcamEntity,
} from "@/app/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const SituationMap = dynamic(
  () => import("@/app/components/situation-map"),
  { ssr: false },
);

type BaseMap = {
  provider: string;
  tileUrl: string;
  attribution: string;
};

type RssFeed = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  custom?: boolean;
};

type Settings = {
  baseMap: BaseMap;
  openWeatherCloudTileUrl: string | null;
  keyedLayers: {
    ships: boolean;
    webcams: boolean;
    openWeatherMap: boolean;
    mapbox: boolean;
  };
  openSkyMode: string;
  defaultRssFeeds: Array<{ name: string; url: string; enabled: boolean }>;
  refreshMs: Record<string, number>;
};

type FlightsPayload = {
  flights: FlightEntity[];
  totalActive: number;
  displayed: number;
  stale: boolean;
  mode: string;
};

type EventsPayload = {
  events: NaturalEntity[];
  totalActive: number;
  sources: Record<string, string>;
};

type NewsPayload = {
  events: NewsEntity[];
  totalActive: number;
  stale: boolean;
  scope: string;
};

type WeatherPayload = {
  frames: WeatherFrame[];
  stale: boolean;
};

type ShipsPayload = { ships: ShipEntity[]; totalActive: number };
type WebcamsPayload = { webcams: WebcamEntity[]; totalActive: number };

const DEFAULT_REFRESH = {
  flightsClient: 15_000,
  weather: 5 * 60_000,
  naturalEvents: 2 * 60_000,
  gdelt: 90_000,
  rss: 3 * 60_000,
  webcams: 10 * 60_000,
  ships: 15_000,
};

const INITIAL_LAYERS: Record<LayerId, boolean> = {
  flights: true,
  ships: false,
  weather: true,
  natural: true,
  webcams: false,
  breaking: true,
};

function nowIso() {
  return new Date().toISOString();
}

function feedHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Invalid feed URL";
  }
}

function validStoredFeeds(value: unknown): value is RssFeed[] {
  return (
    Array.isArray(value) &&
    value.every(
      (feed) =>
        feed &&
        typeof feed === "object" &&
        typeof feed.id === "string" &&
        typeof feed.name === "string" &&
        typeof feed.url === "string" &&
        typeof feed.enabled === "boolean",
    )
  );
}

function usePolledJson<T>(
  url: string | null,
  intervalMs: number,
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [health, setHealth] = useState<FeedHealth>({
    state: enabled ? "loading" : "offline",
    checkedAt: null,
  });
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!url || !enabled) return;
    const generation = generationRef.current;
    setHealth((current) => ({ ...current, state: "loading" }));
    try {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as T & {
        stale?: boolean;
        message?: string;
      };
      if (!response.ok) {
        const state = response.status === 428 ? "key-required" : "offline";
        throw Object.assign(new Error(payload.message || "Feed unavailable"), {
          state,
        });
      }
      if (generation !== generationRef.current) return;
      setData(payload);
      setHealth({
        state: payload.stale ? "stale" : "online",
        checkedAt: nowIso(),
        message: payload.stale ? "Serving last known data" : undefined,
      });
    } catch (error) {
      if (generation !== generationRef.current) return;
      const typed = error as Error & { state?: FeedHealth["state"] };
      setHealth({
        state: typed.state ?? "offline",
        checkedAt: nowIso(),
        message: typed.message,
      });
    }
  }, [enabled, url]);

  useEffect(() => {
    generationRef.current += 1;
    if (!enabled || !url) {
      setHealth({ state: "offline", checkedAt: null });
      return;
    }
    void refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, refresh, url]);

  return { data, health, refresh };
}

function Clock() {
  // Keep the server and first client render identical, then begin the live clock.
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const timer = window.setInterval(() => setTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const utc = time
    ? time.toLocaleTimeString("en-GB", {
        hour12: false,
        timeZone: "UTC",
      })
    : "--:--:--";
  const local = time
    ? time.toLocaleTimeString([], { hour12: false })
    : "--:--:--";
  const zone = time
    ? (Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(time)
        .find((part) => part.type === "timeZoneName")?.value ?? "LOCAL")
    : "LOCAL";

  return (
    <div className="clock-cluster" aria-label="UTC and local time">
      <div>
        <span>UTC</span>
        <strong>{utc}</strong>
      </div>
      <i />
      <div>
        <span>{zone}</span>
        <strong>{local}</strong>
      </div>
    </div>
  );
}

function healthLabel(health: FeedHealth) {
  if (health.state === "loading") return "syncing";
  if (health.state === "key-required") return "key needed";
  return health.state;
}

function LayerToggle({
  id,
  label,
  source,
  count,
  icon,
  checked,
  health,
  onChange,
}: {
  id: LayerId;
  label: string;
  source: string;
  count: number | null;
  icon: ReactNode;
  checked: boolean;
  health: FeedHealth;
  onChange: (id: LayerId, checked: boolean) => void;
}) {
  return (
    <div className={`layer-row ${checked ? "is-active" : ""}`}>
      <button
        type="button"
        className="layer-main"
        onClick={() => onChange(id, !checked)}
        aria-label={`${checked ? "Hide" : "Show"} ${label} layer`}
      >
        <span className="layer-icon">{icon}</span>
        <span className="layer-copy">
          <strong>{label}</strong>
          <small>
            {source} · <em className={`health-${health.state}`}>{healthLabel(health)}</em>
          </small>
        </span>
        {typeof count === "number" && (
          <span className="layer-count">{count.toLocaleString()}</span>
        )}
      </button>
      <Switch
        checked={checked}
        onCheckedChange={(value) => onChange(id, value)}
        aria-label={`Toggle ${label}`}
        className="layer-switch"
      />
    </div>
  );
}

function credibilityClass(value: NewsEntity["credibility"]) {
  return `credibility-badge credibility-${value.toLowerCase()}`;
}

function exactUtc(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "TIME UNKNOWN"
    : `${date.toISOString().slice(11, 19)}Z`;
}

function WireCard({
  event,
  onSelect,
}: {
  event: NewsEntity;
  onSelect: (event: NewsEntity) => void;
}) {
  return (
    <button type="button" className="wire-card" onClick={() => onSelect(event)}>
      <span className={`severity-rail severity-${event.severity}`} />
      <span className="wire-card-top">
        <span className={credibilityClass(event.credibility)}>
          {event.credibility === "UNVERIFIED"
            ? "UNVERIFIED — developing"
            : event.credibility}
        </span>
        <time dateTime={event.source.observedAt}>
          {exactUtc(event.source.observedAt)}
        </time>
      </span>
      <strong>{event.title}</strong>
      <span className="wire-card-meta">
        <span>{event.theme}</span>
        <span>{event.region}</span>
        <span>{event.severity}</span>
      </span>
      <span className="wire-source">
        {event.source.name} · {event.corroboratingSources} source
        {event.corroboratingSources === 1 ? "" : "s"}
      </span>
    </button>
  );
}

function Counter({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="top-counter">
      {icon}
      <span>
        <strong>{value.toLocaleString()}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

export function SituationRoom() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [wireOpen, setWireOpen] = useState(false);
  const [rssOpen, setRssOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchTarget[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [weatherFrameIndex, setWeatherFrameIndex] = useState(0);
  const [weatherMode, setWeatherMode] = useState<"radar" | "clouds">("radar");
  const [viewport, setViewport] = useState({
    bbox: "-180,-85,180,85",
    latitude: 18,
    longitude: 10,
  });
  const [themeFilter, setThemeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [rssEvents, setRssEvents] = useState<NewsEntity[]>([]);
  const [rssHealth, setRssHealth] = useState<FeedHealth>({
    state: "offline",
    checkedAt: null,
  });
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const rssHydratedRef = useRef(false);
  const webMcpStateRef = useRef({
    flights: 0,
    vessels: 0,
    events: 0,
    scope: "Global",
    layers: INITIAL_LAYERS,
    filters: { eventType: "all", region: "all", severity: "all" },
  });

  useEffect(() => {
    let live = true;
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Settings unavailable");
        return (await response.json()) as Settings;
      })
      .then((payload) => {
        if (live) setSettings(payload);
      })
      .catch(() => {
        // The keyless app still operates with built-in defaults.
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!settings || rssHydratedRef.current) return;
    rssHydratedRef.current = true;
    try {
      const stored = window.localStorage.getItem("wsr-rss-feeds");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (validStoredFeeds(parsed)) {
          setRssFeeds(parsed);
          return;
        }
      }
    } catch {
      // Corrupt local preferences are ignored.
    }
    setRssFeeds(
      settings.defaultRssFeeds.map((feed, index) => ({
        ...feed,
        id: `default-${index}`,
      })),
    );
  }, [settings]);

  useEffect(() => {
    if (!rssHydratedRef.current) return;
    try {
      window.localStorage.setItem("wsr-rss-feeds", JSON.stringify(rssFeeds));
    } catch {
      // Storage can be disabled; feeds still work for the current session.
    }
  }, [rssFeeds]);

  const refreshMs = { ...DEFAULT_REFRESH, ...(settings?.refreshMs ?? {}) };
  const localLabel =
    searchTarget?.label.split(",").slice(0, 2).join(",").trim() ?? "";
  const newsUrl =
    localMode && searchTarget
      ? `/api/news?location=${encodeURIComponent(localLabel)}&lat=${searchTarget.latitude}&lon=${searchTarget.longitude}`
      : "/api/news";

  const flightsFeed = usePolledJson<FlightsPayload>(
    "/api/flights",
    refreshMs.flightsClient,
    layers.flights,
  );
  const naturalFeed = usePolledJson<EventsPayload>(
    "/api/events",
    refreshMs.naturalEvents,
    layers.natural,
  );
  const weatherFeed = usePolledJson<WeatherPayload>(
    "/api/weather",
    refreshMs.weather,
    layers.weather,
  );
  const newsFeed = usePolledJson<NewsPayload>(
    newsUrl,
    refreshMs.gdelt,
    layers.breaking,
  );
  const shipsFeed = usePolledJson<ShipsPayload>(
    `/api/ships?bbox=${encodeURIComponent(viewport.bbox)}`,
    refreshMs.ships,
    layers.ships,
  );
  const webcamsFeed = usePolledJson<WebcamsPayload>(
    `/api/webcams?lat=${viewport.latitude}&lon=${viewport.longitude}&radius=180`,
    refreshMs.webcams,
    layers.webcams,
  );

  useEffect(() => {
    if (
      !layers.weather ||
      weatherMode !== "radar" ||
      !weatherFeed.data?.frames.length
    ) {
      return;
    }
    const timer = window.setInterval(
      () =>
        setWeatherFrameIndex(
          (index) => (index + 1) % weatherFeed.data!.frames.length,
        ),
      1_150,
    );
    return () => window.clearInterval(timer);
  }, [layers.weather, weatherFeed.data, weatherMode]);

  const refreshRss = useCallback(async () => {
    const activeFeeds = rssFeeds.filter((feed) => feed.enabled && feed.url);
    if (!activeFeeds.length || !layers.breaking) {
      setRssEvents([]);
      setRssHealth({ state: "offline", checkedAt: null });
      return;
    }
    setRssHealth((current) => ({ ...current, state: "loading" }));
    const results = await Promise.allSettled(
      activeFeeds.map(async (feed) => {
        const response = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: feed.url,
            name: feed.name,
            local:
              localMode && searchTarget
                ? {
                    latitude: searchTarget.latitude,
                    longitude: searchTarget.longitude,
                    label: localLabel,
                  }
                : null,
          }),
        });
        const payload = (await response.json()) as {
          events?: NewsEntity[];
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message || "Feed unavailable");
        return payload.events ?? [];
      }),
    );
    const successful = results.filter(
      (result): result is PromiseFulfilledResult<NewsEntity[]> =>
        result.status === "fulfilled",
    );
    if (successful.length) {
      setRssEvents(successful.flatMap((result) => result.value));
      setRssHealth({
        state: successful.length === activeFeeds.length ? "online" : "stale",
        checkedAt: nowIso(),
        message:
          successful.length === activeFeeds.length
            ? undefined
            : "One or more RSS feeds are offline",
      });
    } else {
      setRssHealth({
        state: "offline",
        checkedAt: nowIso(),
        message: "Configured RSS feeds are unavailable",
      });
    }
  }, [layers.breaking, localLabel, localMode, rssFeeds, searchTarget]);

  useEffect(() => {
    void refreshRss();
    const timer = window.setInterval(refreshRss, refreshMs.rss);
    return () => window.clearInterval(timer);
  }, [refreshMs.rss, refreshRss]);

  const allNews = useMemo(
    () =>
      [...(newsFeed.data?.events ?? []), ...rssEvents]
        .filter(
          (event, index, array) =>
            array.findIndex((candidate) => candidate.url === event.url) === index,
        )
        .sort(
          (a, b) =>
            new Date(b.source.observedAt).getTime() -
            new Date(a.source.observedAt).getTime(),
        ),
    [newsFeed.data?.events, rssEvents],
  );

  const filteredNews = useMemo(
    () =>
      allNews.filter(
        (event) =>
          (themeFilter === "all" || event.theme === themeFilter) &&
          (regionFilter === "all" || event.region === regionFilter) &&
          (severityFilter === "all" || event.severity === severityFilter),
      ),
    [allNews, regionFilter, severityFilter, themeFilter],
  );

  const onLayerChange = useCallback((id: LayerId, checked: boolean) => {
    setLayers((current) => ({ ...current, [id]: checked }));
  }, []);

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      const payload = (await response.json()) as { targets?: SearchTarget[] };
      setSearchResults(payload.targets ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchTarget = (target: SearchTarget) => {
    setSearchTarget(target);
    setSearchQuery(target.label.split(",").slice(0, 2).join(","));
    setSearchResults([]);
  };

  const addFeed = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed = new URL(feedUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      setRssFeeds((feeds) => [
        ...feeds,
        {
          id: `custom-${Date.now()}`,
          name: feedName.trim() || parsed.hostname,
          url: parsed.toString(),
          enabled: true,
          custom: true,
        },
      ]);
      setFeedName("");
      setFeedUrl("");
    } catch {
      // The native URL field keeps the invalid value visible for correction.
    }
  };

  const keyedShipHealth: FeedHealth =
    settings && !settings.keyedLayers.ships
      ? { state: "key-required", checkedAt: null }
      : shipsFeed.health;
  const keyedWebcamHealth: FeedHealth =
    settings && !settings.keyedLayers.webcams
      ? { state: "key-required", checkedAt: null }
      : webcamsFeed.health;
  const weatherDisplayHealth: FeedHealth =
    weatherMode === "clouds"
      ? settings?.keyedLayers.openWeatherMap
        ? { state: "online", checkedAt: null }
        : { state: "key-required", checkedAt: null }
      : weatherFeed.health;

  const frames = weatherFeed.data?.frames ?? [];
  const activeFrame = frames.length
    ? frames[weatherFrameIndex % frames.length]
    : null;
  const eventTotal =
    (naturalFeed.data?.totalActive ?? 0) + filteredNews.length;

  webMcpStateRef.current = {
    flights: flightsFeed.data?.totalActive ?? 0,
    vessels: shipsFeed.data?.totalActive ?? 0,
    events: eventTotal,
    scope: localMode ? localLabel : "Global",
    layers,
    filters: {
      eventType: themeFilter,
      region: regionFilter,
      severity: severityFilter,
    },
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const report = () => {
      // WebMCP is optional; registration failures do not affect the visible app.
    };

    const registrations = [
      context.registerTool(
        {
          name: "read_situation_summary",
          title: "Read situation summary",
          description:
            "Read current World Situation Room counters, scope, and visible layers.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
            untrustedContentHint: true,
          },
          execute() {
            return { ...webMcpStateRef.current };
          },
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: "configure_situation_view",
          title: "Configure situation view",
          description:
            "Show or hide map layers and set the visible wire-desk filters.",
          inputSchema: {
            type: "object",
            properties: {
              layers: {
                type: "object",
                properties: {
                  flights: { type: "boolean" },
                  ships: { type: "boolean" },
                  weather: { type: "boolean" },
                  natural: { type: "boolean" },
                  webcams: { type: "boolean" },
                  breaking: { type: "boolean" },
                },
                additionalProperties: false,
              },
              eventType: {
                type: "string",
                enum: ["all", "conflict", "protest", "disaster", "politics", "other"],
              },
              region: {
                type: "string",
                enum: [
                  "all",
                  "Africa",
                  "Asia",
                  "Europe",
                  "Middle East",
                  "North America",
                  "South America",
                  "Oceania",
                  "Local area",
                ],
              },
              severity: {
                type: "string",
                enum: ["all", "critical", "high", "medium", "low"],
              },
            },
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: false,
          },
          execute(input) {
            if (!input || typeof input !== "object") {
              throw new Error("Expected a configuration object");
            }
            const value = input as {
              layers?: Partial<Record<LayerId, boolean>>;
              eventType?: string;
              region?: string;
              severity?: string;
            };
            if (value.layers) {
              const allowedLayers: LayerId[] = [
                "flights",
                "ships",
                "weather",
                "natural",
                "webcams",
                "breaking",
              ];
              for (const [key, setting] of Object.entries(value.layers)) {
                if (
                  !allowedLayers.includes(key as LayerId) ||
                  typeof setting !== "boolean"
                ) {
                  throw new Error("layers contains an invalid setting");
                }
              }
              setLayers((current) => ({ ...current, ...value.layers }));
            }
            const eventTypes = [
              "all",
              "conflict",
              "protest",
              "disaster",
              "politics",
              "other",
            ];
            const regions = [
              "all",
              "Africa",
              "Asia",
              "Europe",
              "Middle East",
              "North America",
              "South America",
              "Oceania",
              "Local area",
            ];
            const severities = ["all", "critical", "high", "medium", "low"];
            if (value.eventType && !eventTypes.includes(value.eventType)) {
              throw new Error("eventType is invalid");
            }
            if (value.region && !regions.includes(value.region)) {
              throw new Error("region is invalid");
            }
            if (value.severity && !severities.includes(value.severity)) {
              throw new Error("severity is invalid");
            }
            if (value.eventType) setThemeFilter(value.eventType);
            if (value.region) setRegionFilter(value.region);
            if (value.severity) setSeverityFilter(value.severity);
            return {
              status: "configured",
              eventType:
                value.eventType ?? webMcpStateRef.current.filters.eventType,
              region: value.region ?? webMcpStateRef.current.filters.region,
              severity:
                value.severity ?? webMcpStateRef.current.filters.severity,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: "focus_local_area",
          title: "Focus local area",
          description:
            "Search for a city or country, move the map there, and optionally enable Local Mode.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", minLength: 2, maxLength: 120 },
              enableLocalMode: { type: "boolean" },
            },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: true,
          },
          async execute(input) {
            if (!input || typeof input !== "object") {
              throw new Error("Expected a place query");
            }
            const value = input as {
              query?: unknown;
              enableLocalMode?: unknown;
            };
            if (
              typeof value.query !== "string" ||
              value.query.trim().length < 2 ||
              value.query.length > 120
            ) {
              throw new Error("query must contain 2–120 characters");
            }
            const response = await fetch(
              `/api/search?q=${encodeURIComponent(value.query.trim())}`,
            );
            const payload = (await response.json()) as {
              targets?: SearchTarget[];
            };
            const target = payload.targets?.[0];
            if (!response.ok || !target) {
              throw new Error("No matching city or country was found");
            }
            setSearchTarget(target);
            setSearchQuery(target.label.split(",").slice(0, 2).join(","));
            setSearchResults([]);
            if (value.enableLocalMode === true) setLocalMode(true);
            return {
              status: "focused",
              label: target.label,
              latitude: target.latitude,
              longitude: target.longitude,
              localMode: value.enableLocalMode === true,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];

    registrations.forEach((registration) => {
      void Promise.resolve(registration).catch(report);
    });
    return () => lifecycle.abort();
    // State is read through webMcpStateRef so the tools register exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="situation-room">
      <header className="command-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Globe2 />
            <i />
          </span>
          <span>
            <strong>WORLD SITUATION ROOM</strong>
            <small>GLOBAL DESK / 24H MONITOR</small>
          </span>
        </div>

        <div className="live-pill">
          <span />
          LIVE
        </div>

        <div className="header-counters">
          <Counter
            icon={<Plane />}
            label="aircraft"
            value={flightsFeed.data?.totalActive ?? 0}
          />
          <Counter
            icon={<ShipWheel />}
            label="vessels"
            value={shipsFeed.data?.totalActive ?? 0}
          />
          <Counter icon={<Radio />} label="events" value={eventTotal} />
        </div>

        <Clock />
      </header>

      <div className="mobile-command-row">
        <button
          type="button"
          onClick={() => setControlsOpen(true)}
          aria-label="Open layers"
        >
          <Menu /> Layers
        </button>
        <div className="mobile-live">
          <span /> LIVE
        </div>
        <button
          type="button"
          onClick={() => setWireOpen(true)}
          aria-label="Open wire desk"
        >
          <Radio /> Wire
        </button>
      </div>

      <div className="workspace-grid">
        <aside className={`control-rail ${controlsOpen ? "is-open" : ""}`}>
          <div className="mobile-panel-heading">
            <strong>LAYERS & SOURCES</strong>
            <button type="button" onClick={() => setControlsOpen(false)}>
              <X />
              <span className="sr-only">Close layers</span>
            </button>
          </div>

          <form className="place-search" onSubmit={submitSearch}>
            <label htmlFor="place-search">Jump to city or country</label>
            <div>
              <Search aria-hidden="true" />
              <input
                id="place-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search Kampala, Ukraine…"
                autoComplete="off"
              />
              <button type="submit" disabled={searching}>
                {searching ? <RefreshCw className="is-spinning" /> : <Crosshair />}
                <span className="sr-only">Search map</span>
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((target) => (
                  <button
                    type="button"
                    key={`${target.latitude}-${target.longitude}-${target.label}`}
                    onClick={() => chooseSearchTarget(target)}
                  >
                    <strong>{target.label.split(",")[0]}</strong>
                    <span>{target.label.split(",").slice(1, 3).join(",")}</span>
                  </button>
                ))}
                <small>Search © OpenStreetMap contributors</small>
              </div>
            )}
          </form>

          <div className="local-mode-card">
            <div>
              <span className="local-mode-label">LOCAL MODE</span>
              <strong>
                {searchTarget ? localLabel : "Choose a place first"}
              </strong>
            </div>
            <Switch
              checked={localMode}
              disabled={!searchTarget}
              onCheckedChange={setLocalMode}
              aria-label="Toggle Local Mode"
            />
          </div>

          <section className="rail-section">
            <div className="section-label">
              <span>LIVE LAYERS</span>
              <small>{Object.values(layers).filter(Boolean).length}/6 on</small>
            </div>
            <div className="layer-stack">
              <LayerToggle
                id="flights"
                label="Flights"
                source="OpenSky"
                count={flightsFeed.data?.totalActive ?? null}
                icon={<Plane />}
                checked={layers.flights}
                health={flightsFeed.health}
                onChange={onLayerChange}
              />
              <LayerToggle
                id="ships"
                label="Ships"
                source="AISStream"
                count={shipsFeed.data?.totalActive ?? null}
                icon={<ShipWheel />}
                checked={layers.ships}
                health={keyedShipHealth}
                onChange={onLayerChange}
              />
              <LayerToggle
                id="weather"
                label={weatherMode === "clouds" ? "Cloud cover" : "Weather radar"}
                source={weatherMode === "clouds" ? "OpenWeather" : "RainViewer"}
                count={frames.length || null}
                icon={<CloudRain />}
                checked={layers.weather}
                health={weatherDisplayHealth}
                onChange={onLayerChange}
              />
              <LayerToggle
                id="natural"
                label="Natural events"
                source="USGS + NASA"
                count={naturalFeed.data?.totalActive ?? null}
                icon={<Flame />}
                checked={layers.natural}
                health={naturalFeed.health}
                onChange={onLayerChange}
              />
              <LayerToggle
                id="webcams"
                label="Public webcams"
                source="Windy"
                count={webcamsFeed.data?.totalActive ?? null}
                icon={<Camera />}
                checked={layers.webcams}
                health={keyedWebcamHealth}
                onChange={onLayerChange}
              />
              <LayerToggle
                id="breaking"
                label="Breaking events"
                source="GDELT + RSS"
                count={allNews.length}
                icon={<AlertTriangle />}
                checked={layers.breaking}
                health={newsFeed.health}
                onChange={onLayerChange}
              />
            </div>
            <div className="weather-mode-row">
              <span>Weather display</span>
              <Select
                value={weatherMode}
                onValueChange={(value) =>
                  setWeatherMode(value as "radar" | "clouds")
                }
              >
                <SelectTrigger size="sm" aria-label="Weather display mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radar">Animated radar</SelectItem>
                  <SelectItem
                    value="clouds"
                    disabled={!settings?.keyedLayers.openWeatherMap}
                  >
                    {settings?.keyedLayers.openWeatherMap
                      ? "Cloud cover"
                      : "Clouds — key needed"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="rail-section wire-feeds">
            <button
              className="section-label feed-expander"
              type="button"
              onClick={() => setRssOpen((open) => !open)}
              aria-expanded={rssOpen}
            >
              <span>WIRE & LOCAL RSS</span>
              <ChevronDown className={rssOpen ? "is-open" : ""} />
            </button>
            <div className="feed-summary">
              <span className={`feed-dot health-${rssHealth.state}`} />
              {rssFeeds.filter((feed) => feed.enabled && feed.url).length} active feeds
              <small>{healthLabel(rssHealth)}</small>
            </div>
            {rssOpen && (
              <div className="feed-manager">
                {rssFeeds.map((feed) => (
                  <div className="feed-row" key={feed.id}>
                    <Switch
                      size="sm"
                      checked={feed.enabled}
                      disabled={!feed.url}
                      onCheckedChange={(enabled) =>
                        setRssFeeds((feeds) =>
                          feeds.map((candidate) =>
                            candidate.id === feed.id
                              ? { ...candidate, enabled }
                              : candidate,
                          ),
                        )
                      }
                      aria-label={`Toggle ${feed.name}`}
                    />
                    <span>
                      <strong>{feed.name}</strong>
                      <small>
                        {feed.url ? feedHostname(feed.url) : "Add licensed URL"}
                      </small>
                    </span>
                    {feed.custom && (
                      <button
                        type="button"
                        onClick={() =>
                          setRssFeeds((feeds) =>
                            feeds.filter((candidate) => candidate.id !== feed.id),
                          )
                        }
                        aria-label={`Remove ${feed.name}`}
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                ))}
                <form className="add-feed-form" onSubmit={addFeed}>
                  <input
                    value={feedName}
                    onChange={(event) => setFeedName(event.target.value)}
                    placeholder="Source name"
                    aria-label="RSS source name"
                  />
                  <input
                    value={feedUrl}
                    onChange={(event) => setFeedUrl(event.target.value)}
                    placeholder="https://…/feed.xml"
                    type="url"
                    required
                    aria-label="RSS feed URL"
                  />
                  <button type="submit">
                    <Plus /> Add feed
                  </button>
                </form>
              </div>
            )}
          </section>

          <div className="rail-legend">
            <span><i className="legend-raw" /> Raw signal</span>
            <span><i className="legend-reported" /> Reported</span>
            <span><i className="legend-confirmed" /> Confirmed</span>
          </div>
        </aside>

        <section className="map-column">
          <div className="map-toolbar">
            <div className="map-scope">
              <span>{localMode ? "LOCAL DESK" : "GLOBAL VIEW"}</span>
              <strong>{localMode ? localLabel : "Earth · live operations"}</strong>
            </div>
            <div className="map-source-status">
              <span className={`feed-dot health-${weatherDisplayHealth.state}`} />
              {weatherMode === "clouds"
                ? "OPENWEATHER CLOUDS"
                : activeFrame
                  ? `RADAR ${exactUtc(new Date(activeFrame.time * 1000).toISOString())}`
                  : "RADAR AWAITING FEED"}
            </div>
          </div>

          <SituationMap
            baseMap={settings?.baseMap ?? null}
            layers={layers}
            flights={flightsFeed.data?.flights ?? []}
            ships={shipsFeed.data?.ships ?? []}
            naturalEvents={naturalFeed.data?.events ?? []}
            newsEvents={allNews}
            webcams={webcamsFeed.data?.webcams ?? []}
            weatherFrames={frames}
            weatherFrameIndex={weatherFrameIndex}
            weatherMode={weatherMode}
            cloudTileUrl={settings?.openWeatherCloudTileUrl ?? null}
            focusTarget={searchTarget}
            onSelect={setSelected}
            onViewportChange={setViewport}
          />

          <div className="map-footer">
            <span>
              {settings?.baseMap.provider ?? "Esri World Imagery"} · Leaflet
            </span>
            <span>
              {viewport.latitude.toFixed(3)}°, {viewport.longitude.toFixed(3)}°
            </span>
            <span className="mobile-counts">
              {(flightsFeed.data?.totalActive ?? 0).toLocaleString()} AIR ·{" "}
              {eventTotal.toLocaleString()} EVT
            </span>
          </div>

          {[
            flightsFeed.health,
            naturalFeed.health,
            weatherDisplayHealth,
            newsFeed.health,
          ].every((health) => health.state === "offline") && (
            <div className="feed-offline-banner">
              <AlertTriangle />
              Live feeds are temporarily offline. The map remains available.
            </div>
          )}
        </section>

        <aside className={`wire-desk ${wireOpen ? "is-open" : ""}`}>
          <div className="wire-header">
            <div>
              <span className="wire-eyebrow">
                <Radio /> THE WIRE
              </span>
              <h2>Breaking events</h2>
            </div>
            <div className="wire-live-count">
              <span />
              {filteredNews.length} LIVE
            </div>
            <button
              type="button"
              className="wire-mobile-close"
              onClick={() => setWireOpen(false)}
            >
              <X />
              <span className="sr-only">Close wire desk</span>
            </button>
          </div>

          <div className="wire-filters">
            <Select value={themeFilter} onValueChange={setThemeFilter}>
              <SelectTrigger size="sm" aria-label="Filter by event type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="conflict">Conflict</SelectItem>
                <SelectItem value="protest">Protest</SelectItem>
                <SelectItem value="disaster">Disaster</SelectItem>
                <SelectItem value="politics">Politics</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger size="sm" aria-label="Filter by region">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                <SelectItem value="Africa">Africa</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
                <SelectItem value="Europe">Europe</SelectItem>
                <SelectItem value="Middle East">Middle East</SelectItem>
                <SelectItem value="North America">N. America</SelectItem>
                <SelectItem value="South America">S. America</SelectItem>
                <SelectItem value="Oceania">Oceania</SelectItem>
                <SelectItem value="Local area">Local area</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger size="sm" aria-label="Filter by severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="wire-scope-line">
            <SlidersHorizontal />
            <span>
              {localMode ? `Local: ${localLabel}` : "Global firehose"} · newest first
            </span>
            {newsFeed.health.state === "loading" && (
              <RefreshCw className="is-spinning" />
            )}
          </div>

          <div className="wire-list">
            {filteredNews.length ? (
              filteredNews.map((event) => (
                <WireCard key={event.id} event={event} onSelect={setSelected} />
              ))
            ) : (
              <div className="wire-empty">
                <Radio />
                <strong>No signals match this desk</strong>
                <p>
                  Adjust the filters or wait for the next source refresh. Nothing
                  is promoted without a timestamp and source.
                </p>
              </div>
            )}
          </div>

          <footer className="wire-footer">
            <span>
              <i className={`feed-dot health-${newsFeed.health.state}`} />
              GDELT DOC 2.0
            </span>
            <span>
              <i className={`feed-dot health-${rssHealth.state}`} />
              RSS desk
            </span>
          </footer>
        </aside>
      </div>

      <nav className="mobile-dock" aria-label="Mobile command controls">
        <button type="button" onClick={() => setControlsOpen(true)}>
          <Layers3 /> Layers
        </button>
        <button
          type="button"
          className="dock-live"
          onClick={() => setWireOpen(true)}
        >
          <Radio /> Wire <span>{filteredNews.length}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (searchTarget) setLocalMode((value) => !value);
            else setControlsOpen(true);
          }}
        >
          <Crosshair /> {localMode ? "Local on" : "Local"}
        </button>
      </nav>

      <DetailSheet entity={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
