import { APP_CONFIG } from "@/config";
import { cached, fetchJson } from "@/app/lib/server-cache";
import type { WeatherFrame } from "@/app/lib/types";

export const runtime = "edge";

type RainViewerMap = {
  host?: string;
  radar?: {
    past?: Array<{ path: string; time: number }>;
    nowcast?: Array<{ path: string; time: number }>;
  };
};

export async function GET() {
  try {
    const result = await cached(
      "rainviewer-frames",
      APP_CONFIG.refreshMs.weather,
      () => fetchJson<RainViewerMap>(APP_CONFIG.endpoints.rainViewer),
    );
    const host = result.value.host ?? "https://tilecache.rainviewer.com";
    const rawFrames = [
      ...(result.value.radar?.past ?? []).slice(-6),
      ...(result.value.radar?.nowcast ?? []).slice(0, 3),
    ];
    const frames: WeatherFrame[] = rawFrames.map((frame) => ({
      path: frame.path,
      time: frame.time,
      tileUrl: `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      sourceUrl: "https://www.rainviewer.com/",
    }));
    return Response.json(
      {
        frames,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "feed_offline",
        message:
          error instanceof Error ? error.message : "RainViewer is unavailable",
      },
      { status: 503 },
    );
  }
}

