import { APP_CONFIG } from "@/config";
import { countryPoint } from "@/app/lib/geography";
import {
  classifySeverity,
  classifyTheme,
  parseGdeltDate,
  relatedTitles,
  stableId,
  titleTokens,
} from "@/app/lib/news-utils";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { EventTheme, NewsEntity } from "@/app/lib/types";

export const runtime = "edge";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

type GdeltResponse = { articles?: GdeltArticle[] };

const THEME_QUERIES: Array<{ theme: EventTheme; query: string }> = [
  { theme: "conflict", query: "theme:ARMEDCONFLICT" },
  { theme: "protest", query: "theme:PROTEST" },
  { theme: "disaster", query: "theme:NATURAL_DISASTER" },
  { theme: "politics", query: "theme:GENERAL_GOVERNMENT" },
];

type LocalQuery = {
  label: string;
  latitude: number;
  longitude: number;
};

function cleanLocalQuery(url: URL): LocalQuery | null {
  const label = (url.searchParams.get("location") ?? "")
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, "")
    .trim()
    .slice(0, 80);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));
  if (
    !label ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { label, latitude, longitude };
}

async function loadGdelt(local: LocalQuery | null) {
  const articles: Array<GdeltArticle & { fallbackTheme: EventTheme }> = [];
  const sourceHealth: Record<string, "online" | "offline"> = {};

  // Run in series: four polite, cacheable theme requests once per refresh window.
  for (const theme of THEME_QUERIES) {
    try {
      const endpoint = new URL(APP_CONFIG.endpoints.gdeltDoc);
      endpoint.searchParams.set(
        "query",
        local ? `"${local.label}" ${theme.query}` : theme.query,
      );
      endpoint.searchParams.set("mode", "artlist");
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("sort", "datedesc");
      endpoint.searchParams.set("timespan", "180min");
      endpoint.searchParams.set("maxrecords", "35");
      const data = await fetchJson<GdeltResponse>(endpoint.toString());
      articles.push(
        ...(data.articles ?? []).map((article) => ({
          ...article,
          fallbackTheme: theme.theme,
        })),
      );
      sourceHealth[theme.theme] = "online";
    } catch {
      sourceHealth[theme.theme] = "offline";
    }
  }

  if (!articles.length) throw new Error("GDELT returned no reachable theme feeds");
  return { articles, sourceHealth };
}

function buildEntities(
  rows: Array<GdeltArticle & { fallbackTheme: EventTheme }>,
  local: LocalQuery | null,
): NewsEntity[] {
  const deduplicated = new Map<string, GdeltArticle & { fallbackTheme: EventTheme }>();
  for (const row of rows) {
    if (!row.url || !row.title) continue;
    deduplicated.set(row.url, row);
  }
  const items = [...deduplicated.values()].slice(0, 120);

  const clusters: Array<{
    tokens: Set<string>;
    members: Array<GdeltArticle & { fallbackTheme: EventTheme }>;
  }> = [];
  for (const item of items) {
    const tokens = titleTokens(item.title ?? "");
    const cluster = clusters.find((candidate) =>
      relatedTitles(candidate.tokens, tokens),
    );
    if (cluster) cluster.members.push(item);
    else clusters.push({ tokens, members: [item] });
  }

  const sourceCounts = new Map<string, number>();
  for (const cluster of clusters) {
    const domains = new Set(
      cluster.members.map((item) => item.domain?.toLowerCase()).filter(Boolean),
    );
    for (const member of cluster.members) {
      if (member.url) sourceCounts.set(member.url, domains.size);
    }
  }

  return items
    .map((item): NewsEntity => {
      const country = item.sourcecountry?.trim() || "Unknown";
      const point = local ? null : countryPoint(country);
      const sourceCount = sourceCounts.get(item.url ?? "") ?? 1;
      const observedAt = parseGdeltDate(item.seendate ?? "");
      const domain = item.domain?.trim() || new URL(item.url ?? "").hostname;
      return {
        id: `gdelt-${stableId(item.url ?? item.title ?? observedAt)}`,
        entityType: "news",
        title: item.title ?? "Developing signal",
        latitude: local?.latitude ?? point?.latitude ?? null,
        longitude: local?.longitude ?? point?.longitude ?? null,
        url: item.url ?? "https://www.gdeltproject.org/",
        domain,
        sourceCountry: country,
        region: point?.region ?? (local ? "Local area" : "Unknown"),
        language: item.language?.trim() || "Unknown",
        theme: classifyTheme(item.title ?? "", item.fallbackTheme),
        severity: classifySeverity(item.title ?? ""),
        // Independent reporting upgrades a raw signal to REPORTED. News alone
        // never auto-upgrades to CONFIRMED; that needs an authoritative source.
        credibility: sourceCount >= 2 ? "REPORTED" : "UNVERIFIED",
        corroboratingSources: sourceCount,
        locationPrecision: local ? "local-area" : "source-country",
        source: {
          name: `${domain} via GDELT`,
          url: item.url ?? "https://www.gdeltproject.org/",
          observedAt,
        },
      };
    })
    .sort(
      (a, b) =>
        new Date(b.source.observedAt).getTime() -
        new Date(a.source.observedAt).getTime(),
    );
}

export async function GET(request: Request) {
  const local = cleanLocalQuery(new URL(request.url));
  const cacheKey = local ? `gdelt:${local.label.toLowerCase()}` : "gdelt:global";
  try {
    const result = await cached(cacheKey, APP_CONFIG.refreshMs.gdelt, () =>
      loadGdelt(local),
    );
    const events = buildEntities(result.value.articles, local);
    return Response.json(
      {
        events,
        totalActive: events.length,
        sourceHealth: result.value.sourceHealth,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        scope: local?.label ?? "Global",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "GDELT is unavailable",
      },
      { status: 503 },
    );
  }
}

