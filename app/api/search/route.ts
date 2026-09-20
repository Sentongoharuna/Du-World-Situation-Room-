import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { SearchTarget } from "@/app/lib/types";

export const runtime = "edge";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  boundingbox?: string[];
  address?: { country_code?: string };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) {
    return Response.json({ error: "query_too_short" }, { status: 400 });
  }

  try {
    const targetUrl = new URL(APP_CONFIG.endpoints.nominatim);
    targetUrl.searchParams.set("q", query);
    targetUrl.searchParams.set("format", "jsonv2");
    targetUrl.searchParams.set("limit", "5");
    targetUrl.searchParams.set("addressdetails", "1");

    const result = await cached(`search:${query.toLowerCase()}`, 60 * 60_000, () =>
      fetchJson<NominatimResult[]>(targetUrl.toString(), {
        headers: {
          "User-Agent":
            "WorldSituationRoom/1.0 (public map search; contact via deployed site)",
        },
      }),
    );

    const targets: SearchTarget[] = result.value.flatMap((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const bbox = item.boundingbox?.map(Number);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !bbox ||
        bbox.length !== 4 ||
        bbox.some((value) => !Number.isFinite(value))
      ) {
        return [];
      }
      return [
        {
          label: item.display_name ?? query,
          latitude,
          longitude,
          // Nominatim order: south, north, west, east.
          boundingBox: [bbox[0], bbox[1], bbox[2], bbox[3]],
          type: item.type ?? "place",
          countryCode: item.address?.country_code?.toUpperCase(),
        } satisfies SearchTarget,
      ];
    });

    return Response.json(
      { targets, attribution: "Search © OpenStreetMap contributors" },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: "search_offline",
        message:
          error instanceof Error ? error.message : "Place search is unavailable",
      },
      { status: 503 },
    );
  }
}
