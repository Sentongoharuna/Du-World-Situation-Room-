import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { WebcamEntity } from "@/app/lib/types";

export const runtime = "edge";

type WindyWebcam = {
  webcamId?: string | number;
  title?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
  };
  images?: { current?: { preview?: string; icon?: string } };
  player?: { day?: string; lifetime?: string; month?: string };
};

type WindyResponse = { webcams?: WindyWebcam[] };

export async function GET(request: Request) {
  if (!APP_CONFIG.keys.windyWebcamsKey) {
    return Response.json(
      {
        error: "key_required",
        message: "Add WINDY_WEBCAMS_API_KEY in config.js environment settings.",
      },
      { status: 428 },
    );
  }

  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));
  const radius = Math.min(
    500,
    Math.max(10, Number(url.searchParams.get("radius") ?? 120)),
  );
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return Response.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const cacheKey = `webcams:${latitude.toFixed(1)}:${longitude.toFixed(1)}:${radius}`;
  try {
    const result = await cached(
      cacheKey,
      APP_CONFIG.refreshMs.webcams,
      async () => {
        const endpoint = new URL(APP_CONFIG.endpoints.windyWebcams);
        endpoint.searchParams.set("nearby", `${latitude},${longitude},${radius}`);
        endpoint.searchParams.set("include", "images,location,player");
        endpoint.searchParams.set("limit", "50");
        return fetchJson<WindyResponse>(endpoint.toString(), {
          headers: { "x-windy-api-key": APP_CONFIG.keys.windyWebcamsKey },
        });
      },
    );

    const observedAt = result.fetchedAt;
    const webcams: WebcamEntity[] = (result.value.webcams ?? []).flatMap(
      (webcam) => {
        const lat = webcam.location?.latitude;
        const lon = webcam.location?.longitude;
        if (
          typeof lat !== "number" ||
          typeof lon !== "number" ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          return [];
        }
        const webcamId = String(webcam.webcamId ?? `${lat},${lon}`);
        return [
          {
            id: `webcam-${webcamId}`,
            entityType: "webcam",
            title: webcam.title || "Public webcam",
            latitude: lat,
            longitude: lon,
            webcamId,
            city: webcam.location?.city || "Unknown city",
            country: webcam.location?.country || "Unknown country",
            previewUrl:
              webcam.images?.current?.preview ||
              webcam.images?.current?.icon ||
              "",
            playerUrl:
              webcam.player?.day ||
              webcam.player?.lifetime ||
              webcam.player?.month ||
              "",
            source: {
              name: "Windy Webcams",
              url: "https://www.windy.com/webcams",
              observedAt,
            },
          } satisfies WebcamEntity,
        ];
      },
    );

    return Response.json(
      { webcams, totalActive: webcams.length, fetchedAt: result.fetchedAt },
      { headers: { "Cache-Control": "public, s-maxage=600" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "Webcams are unavailable",
      },
      { status: 503 },
    );
  }
}

