import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { ShipEntity } from "@/app/lib/types";

export const runtime = "edge";

type RelayVessel = {
  mmsi?: string | number;
  name?: string;
  vesselName?: string;
  type?: string;
  vesselType?: string;
  flag?: string;
  destination?: string;
  latitude?: number;
  longitude?: number;
  speedKnots?: number;
  headingDegrees?: number;
  timestamp?: string;
};

type RelayResponse = { vessels?: RelayVessel[] };

function validBbox(value: string | null): string {
  const fallback = "-180,-85,180,85";
  if (!value) return fallback;
  const parts = value.split(",").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isFinite(part)) ||
    Math.abs(parts[0]) > 180 ||
    Math.abs(parts[2]) > 180 ||
    Math.abs(parts[1]) > 90 ||
    Math.abs(parts[3]) > 90
  ) {
    return fallback;
  }
  return parts.join(",");
}

export async function GET(request: Request) {
  if (!APP_CONFIG.keys.shipRelayUrl) {
    return Response.json(
      {
        error: "key_required",
        message:
          "AISStream requires a secure server relay. Add AIS_SHIP_RELAY_URL in config.js environment settings.",
      },
      { status: 428 },
    );
  }

  const bbox = validBbox(new URL(request.url).searchParams.get("bbox"));
  try {
    const result = await cached(
      `ships:${bbox}`,
      APP_CONFIG.refreshMs.ships,
      async () => {
        const endpoint = new URL(APP_CONFIG.keys.shipRelayUrl);
        endpoint.searchParams.set("bbox", bbox);
        return fetchJson<RelayResponse>(endpoint.toString(), {
          headers: APP_CONFIG.keys.shipRelayToken
            ? { Authorization: `Bearer ${APP_CONFIG.keys.shipRelayToken}` }
            : undefined,
        });
      },
    );

    const ships: ShipEntity[] = (result.value.vessels ?? []).flatMap((vessel) => {
      if (
        typeof vessel.latitude !== "number" ||
        typeof vessel.longitude !== "number"
      ) {
        return [];
      }
      const mmsi = String(vessel.mmsi ?? "unknown");
      const observedAt = new Date(vessel.timestamp ?? result.fetchedAt).toISOString();
      const vesselName = vessel.vesselName || vessel.name || `MMSI ${mmsi}`;
      return [
        {
          id: `ship-${mmsi}`,
          entityType: "ship",
          title: vesselName,
          latitude: vessel.latitude,
          longitude: vessel.longitude,
          mmsi,
          vesselName,
          vesselType: vessel.vesselType || vessel.type || "Unknown",
          flag: vessel.flag || "Unknown",
          destination: vessel.destination || "Not reported",
          speedKnots:
            typeof vessel.speedKnots === "number" ? vessel.speedKnots : null,
          headingDegrees:
            typeof vessel.headingDegrees === "number"
              ? vessel.headingDegrees
              : null,
          source: {
            name: "AISStream.io",
            url: "https://aisstream.io/",
            observedAt,
          },
        } satisfies ShipEntity,
      ];
    });

    return Response.json(
      { ships, totalActive: ships.length, fetchedAt: result.fetchedAt },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "Ship feed is unavailable",
      },
      { status: 503 },
    );
  }
}
