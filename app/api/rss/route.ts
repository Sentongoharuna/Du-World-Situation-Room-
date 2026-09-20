import {
  classifySeverity,
  classifyTheme,
  stableId,
} from "@/app/lib/news-utils";
import type { NewsEntity } from "@/app/lib/types";

export const runtime = "edge";

type RequestBody = {
  url?: string;
  name?: string;
  local?: { latitude?: number; longitude?: number; label?: string } | null;
};

const PRIVATE_HOST =
  /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

function safeFeedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (PRIVATE_HOST.test(url.hostname) || url.hostname.endsWith(".local")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"),
    );
    if (match?.[1]) return decodeXml(match[1]);
  }
  return "";
}

function itemLink(block: string): string {
  const standard = tag(block, ["link"]);
  if (/^https?:\/\//i.test(standard)) return standard;
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? "";
  return /^https?:\/\//i.test(atom) ? atom : "";
}

function parseFeed(
  xml: string,
  feedName: string,
  feedUrl: string,
  local: RequestBody["local"],
): NewsEntity[] {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []),
  ].slice(0, 30);

  return blocks.flatMap((block) => {
    const title = tag(block, ["title"]);
    const url = itemLink(block);
    if (!title || !url) return [];
    const rawDate = tag(block, ["pubDate", "published", "updated", "dc:date"]);
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const observedAt = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();
    const latitude =
      typeof local?.latitude === "number" ? local.latitude : null;
    const longitude =
      typeof local?.longitude === "number" ? local.longitude : null;

    return [
      {
        id: `rss-${stableId(url)}`,
        entityType: "news",
        title,
        latitude,
        longitude,
        url,
        domain: new URL(url).hostname,
        sourceCountry: local?.label || "Not geolocated",
        region: local ? "Local area" : "Unknown",
        language: "Feed language",
        theme: classifyTheme(title, "other"),
        severity: classifySeverity(title),
        credibility: "UNVERIFIED",
        corroboratingSources: 1,
        locationPrecision: local ? "local-area" : "source-country",
        source: {
          name: feedName || new URL(feedUrl).hostname,
          url,
          observedAt,
        },
      } satisfies NewsEntity,
    ];
  });
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const feedUrl = safeFeedUrl(body.url?.trim() ?? "");
  if (!feedUrl) {
    return Response.json({ error: "invalid_feed_url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": "WorldSituationRoom/1.0 RSS reader",
      },
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 2_000_000) throw new Error("Feed exceeds 2 MB limit");
    const xml = (await response.text()).slice(0, 2_000_000);
    const events = parseFeed(
      xml,
      body.name?.trim().slice(0, 80) ?? "",
      feedUrl.toString(),
      body.local,
    );
    return Response.json(
      { events, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=180" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "RSS feed is unavailable",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

