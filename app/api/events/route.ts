import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { NaturalEntity, Severity } from "@/app/lib/types";

export const runtime = "edge";

type Feature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
};

type FeatureCollection = { features?: Feature[] };

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function geometryCentre(feature: Feature): [number, number] | null {
  const coordinates = feature.geometry?.coordinates;
  if (feature.geometry?.type === "Point" && Array.isArray(coordinates)) {
    const longitude = numberOrNull(coordinates[0]);
    const latitude = numberOrNull(coordinates[1]);
    return longitude === null || latitude === null
      ? null
      : [longitude, latitude];
  }

  // Polygon feeds are represented by a transparent centroid marker.
  const points: number[][] = [];
  const visit = (value: unknown) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      points.push([value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
  };
  visit(coordinates);
  if (!points.length) return null;
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0],
  );
  return [total[0] / points.length, total[1] / points.length];
}

function quakeSeverity(magnitude: number | null): Severity {
  if ((magnitude ?? 0) >= 7) return "critical";
  if ((magnitude ?? 0) >= 5.5) return "high";
  if ((magnitude ?? 0) >= 4) return "medium";
  return "low";
}

function eonetSeverity(category: string): Severity {
  const value = category.toLowerCase();
  if (/severe storm|volcano/.test(value)) return "high";
  if (/wildfire|flood|earthquake/.test(value)) return "medium";
  return "low";
}

function usgsEvents(feed: FeatureCollection): NaturalEntity[] {
  return (feed.features ?? []).flatMap((feature) => {
    const centre = geometryCentre(feature);
    if (!centre) return [];
    const props = feature.properties ?? {};
    const magnitude = numberOrNull(props.mag);
    const observedAt = new Date(
      typeof props.time === "number" ? props.time : Date.now(),
    ).toISOString();
    const sourceUrl =
      typeof props.url === "string"
        ? props.url
        : "https://earthquake.usgs.gov/earthquakes/map/";
    return [
      {
        id: `usgs-${String(feature.id ?? observedAt)}`,
        entityType: "natural",
        title:
          typeof props.title === "string" ? props.title : "Earthquake signal",
        latitude: centre[1],
        longitude: centre[0],
        category: "Earthquake",
        magnitude,
        severity: quakeSeverity(magnitude),
        credibility: "CONFIRMED",
        description:
          "Instrument-derived earthquake record from the USGS event feed.",
        source: {
          name: "USGS",
          url: sourceUrl,
          observedAt,
        },
      } satisfies NaturalEntity,
    ];
  });
}

function eonetEvents(feed: FeatureCollection): NaturalEntity[] {
  return (feed.features ?? []).flatMap((feature) => {
    const centre = geometryCentre(feature);
    if (!centre) return [];
    const props = feature.properties ?? {};
    const categories = Array.isArray(props.categories) ? props.categories : [];
    const firstCategory = categories[0] as Record<string, unknown> | undefined;
    const category =
      (typeof firstCategory?.title === "string" && firstCategory.title) ||
      (typeof firstCategory?.id === "string" && firstCategory.id) ||
      "Natural event";
    const sources = Array.isArray(props.sources) ? props.sources : [];
    const firstSource = sources[0] as Record<string, unknown> | undefined;
    const sourceUrl =
      (typeof firstSource?.url === "string" && firstSource.url) ||
      (typeof props.link === "string" && props.link) ||
      "https://eonet.gsfc.nasa.gov/";
    const observedAt = new Date(
      typeof props.date === "string" ? props.date : Date.now(),
    ).toISOString();

    return [
      {
        id: `eonet-${String(feature.id ?? observedAt)}`,
        entityType: "natural",
        title:
          typeof props.title === "string" ? props.title : "NASA EONET event",
        latitude: centre[1],
        longitude: centre[0],
        category,
        magnitude: numberOrNull(props.magnitudeValue),
        severity: eonetSeverity(category),
        credibility: "REPORTED",
        description:
          typeof props.description === "string"
            ? props.description
            : "Open natural-event record curated by NASA EONET.",
        source: {
          name: "NASA EONET",
          url: sourceUrl,
          observedAt,
        },
      } satisfies NaturalEntity,
    ];
  });
}

export async function GET() {
  const [usgs, eonet] = await Promise.allSettled([
    cached("usgs-day", APP_CONFIG.refreshMs.naturalEvents, () =>
      fetchJson<FeatureCollection>(APP_CONFIG.endpoints.usgsDay),
    ),
    cached("nasa-eonet", APP_CONFIG.refreshMs.naturalEvents, () =>
      fetchJson<FeatureCollection>(APP_CONFIG.endpoints.nasaEonet),
    ),
  ]);

  const events: NaturalEntity[] = [];
  const sources = {
    usgs: usgs.status === "fulfilled" ? "online" : "offline",
    eonet: eonet.status === "fulfilled" ? "online" : "offline",
  };
  if (usgs.status === "fulfilled") events.push(...usgsEvents(usgs.value.value));
  if (eonet.status === "fulfilled") {
    events.push(...eonetEvents(eonet.value.value));
  }

  if (!events.length && usgs.status === "rejected" && eonet.status === "rejected") {
    return Response.json(
      { error: "feed_offline", sources },
      { status: 503 },
    );
  }

  events.sort(
    (a, b) =>
      new Date(b.source.observedAt).getTime() -
      new Date(a.source.observedAt).getTime(),
  );
  return Response.json(
    {
      events,
      totalActive: events.length,
      sources,
      fetchedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } },
  );
}

