import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { FlightEntity } from "@/app/lib/types";

export const runtime = "edge";

type OpenSkyResponse = {
  time: number;
  states: Array<Array<string | number | boolean | null>> | null;
};

let accessToken: { value: string; expiresAt: number } | null = null;

async function getOpenSkyToken(): Promise<string | null> {
  const { openSkyClientId, openSkyClientSecret } = APP_CONFIG.keys;
  if (!openSkyClientId || !openSkyClientSecret) return null;
  if (accessToken && accessToken.expiresAt > Date.now() + 30_000) {
    return accessToken.value;
  }

  const response = await fetch(APP_CONFIG.endpoints.openSkyToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: openSkyClientId,
      client_secret: openSkyClientSecret,
    }),
  });
  if (!response.ok) throw new Error(`OpenSky OAuth returned ${response.status}`);
  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  accessToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };
  return accessToken.value;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toFlight(
  state: Array<string | number | boolean | null>,
  observedAt: string,
): FlightEntity | null {
  const longitude = numberOrNull(state[5]);
  const latitude = numberOrNull(state[6]);
  if (longitude === null || latitude === null) return null;

  const callsign =
    typeof state[1] === "string" && state[1].trim()
      ? state[1].trim()
      : String(state[0]).toUpperCase();

  return {
    id: `flight-${String(state[0])}`,
    entityType: "flight",
    title: callsign,
    callsign,
    originCountry: typeof state[2] === "string" ? state[2] : "Unknown",
    latitude,
    longitude,
    altitudeMetres: numberOrNull(state[7]) ?? numberOrNull(state[13]),
    speedMetresPerSecond: numberOrNull(state[9]),
    headingDegrees: numberOrNull(state[10]),
    onGround: state[8] === true,
    source: {
      name: "OpenSky Network",
      url: "https://opensky-network.org/",
      observedAt,
    },
  };
}

export async function GET() {
  const authenticated =
    Boolean(APP_CONFIG.keys.openSkyClientId) &&
    Boolean(APP_CONFIG.keys.openSkyClientSecret);
  const ttl = authenticated
    ? APP_CONFIG.refreshMs.flightsAuthenticatedUpstream
    : APP_CONFIG.refreshMs.flightsAnonymousUpstream;

  try {
    const result = await cached("opensky-global", ttl, async () => {
      const token = await getOpenSkyToken();
      return fetchJson<OpenSkyResponse>(APP_CONFIG.endpoints.openSkyStates, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    });

    const observedAt = new Date(result.value.time * 1000).toISOString();
    const allFlights = (result.value.states ?? [])
      .map((state) => toFlight(state, observedAt))
      .filter((flight): flight is FlightEntity => Boolean(flight));

    // Keep the global count, but bound marker work on lower-powered phones.
    const flights = allFlights
      .sort((a, b) => Number(a.onGround) - Number(b.onGround))
      .slice(0, 2_500);

    return Response.json(
      {
        flights,
        totalActive: allFlights.length,
        displayed: flights.length,
        fetchedAt: result.fetchedAt,
        sourceObservedAt: observedAt,
        stale: result.stale,
        mode: authenticated ? "oauth-live" : "anonymous-free-tier-cache",
      },
      {
        headers: {
          "Cache-Control": authenticated
            ? "public, s-maxage=15, stale-while-revalidate=30"
            : "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "OpenSky is unavailable",
      },
      { status: 503 },
    );
  }
}

