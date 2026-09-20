/**
 * World Situation Room — integration configuration
 *
 * This is the single place to swap provider credentials and tune refresh rates.
 * Keep private values in environment variables; never paste secrets into source.
 * Mapbox and OpenWeatherMap browser tokens are intentionally named NEXT_PUBLIC_*.
 */
export const APP_CONFIG = Object.freeze({
  keys: {
    // Optional. Enables Mapbox satellite tiles instead of the keyless Esri fallback.
    mapboxPublicToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
    // Optional. Enables the OpenWeatherMap cloud tile mode.
    openWeatherMapPublicKey:
      process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY ?? "",
    // Optional. Kept server-side and sent only to Windy's API.
    windyWebcamsKey: process.env.WINDY_WEBCAMS_API_KEY ?? "",
    // AISStream's key belongs only in the separately deployed secure relay.
    aisStreamApiKey: process.env.AISSTREAM_API_KEY ?? "",
    // Optional. OpenSky OAuth increases quota and permits a 15-second upstream refresh.
    openSkyClientId: process.env.OPENSKY_CLIENT_ID ?? "",
    openSkyClientSecret: process.env.OPENSKY_CLIENT_SECRET ?? "",
    // AISStream forbids browser connections. Point this at a secure AIS relay that
    // returns a JSON snapshot of vessels for the requested bounding box.
    shipRelayUrl: process.env.AIS_SHIP_RELAY_URL ?? "",
    shipRelayToken: process.env.AIS_SHIP_RELAY_TOKEN ?? "",
  },
  endpoints: {
    openSkyStates: "https://opensky-network.org/api/states/all",
    openSkyToken:
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    rainViewer: "https://api.rainviewer.com/public/weather-maps.json",
    usgsDay:
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    nasaEonet:
      "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=30&limit=250",
    gdeltDoc: "https://api.gdeltproject.org/api/v2/doc/doc",
    nominatim: "https://nominatim.openstreetmap.org/search",
    windyWebcams: "https://api.windy.com/webcams/api/v3/webcams",
  },
  refreshMs: {
    // The client checks every 15s. Anonymous global OpenSky data is upstream-cached
    // for 15 minutes to stay within its 400-credit/day free allowance.
    flightsClient: 15_000,
    flightsAnonymousUpstream: 15 * 60_000,
    flightsAuthenticatedUpstream: 15_000,
    weather: 5 * 60_000,
    naturalEvents: 2 * 60_000,
    gdelt: 90_000,
    rss: 3 * 60_000,
    webcams: 10 * 60_000,
    ships: 15_000,
  },
  // Public feeds only. Reuters/AP/AFP URLs are intentionally not fabricated: add a
  // licensed/public URL in the UI or here when one is available to you.
  defaultRssFeeds: [
    {
      name: "BBC World",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      enabled: true,
    },
    { name: "Reuters", url: "", enabled: false },
    { name: "Associated Press", url: "", enabled: false },
    { name: "AFP", url: "", enabled: false },
  ],
});
