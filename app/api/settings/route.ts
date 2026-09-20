import { APP_CONFIG } from "@/config";

export const runtime = "edge";

export async function GET() {
  const mapboxToken = APP_CONFIG.keys.mapboxPublicToken;
  const openWeatherKey = APP_CONFIG.keys.openWeatherMapPublicKey;
  return Response.json(
    {
      baseMap: mapboxToken
        ? {
            provider: "Mapbox",
            tileUrl:
              "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}@2x?access_token=" +
              encodeURIComponent(mapboxToken),
            attribution: "© Mapbox © OpenStreetMap",
          }
        : {
            provider: "Esri World Imagery",
            tileUrl:
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attribution: "Tiles © Esri",
          },
      openWeatherCloudTileUrl: openWeatherKey
        ? `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(openWeatherKey)}`
        : null,
      keyedLayers: {
        ships: Boolean(APP_CONFIG.keys.shipRelayUrl),
        webcams: Boolean(APP_CONFIG.keys.windyWebcamsKey),
        openWeatherMap: Boolean(openWeatherKey),
        mapbox: Boolean(mapboxToken),
      },
      openSkyMode:
        APP_CONFIG.keys.openSkyClientId && APP_CONFIG.keys.openSkyClientSecret
          ? "oauth-live"
          : "anonymous-free-tier-cache",
      defaultRssFeeds: APP_CONFIG.defaultRssFeeds,
      refreshMs: APP_CONFIG.refreshMs,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

