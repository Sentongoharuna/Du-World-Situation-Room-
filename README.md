# World Situation Room

A responsive global command-centre built with React, Vinext, Leaflet, and
server-side API routes. It combines live aviation, weather, natural-hazard, and
news signals while preserving source timestamps and verification status.

## What works without keys

- Leaflet satellite map with an Esri World Imagery fallback
- OpenSky aircraft state vectors
- RainViewer animated radar
- USGS earthquakes
- NASA EONET wildfires, storms, volcanoes, and other open events
- GDELT DOC 2.0 themed breaking-news signals
- OpenStreetMap Nominatim city/country search
- User-configurable public RSS and Atom feeds

Anonymous OpenSky requests are intentionally cached for 15 minutes to respect
its 400-credit/day free allowance. The browser still checks the local endpoint
every 15 seconds, and the exact source timestamp is always shown. Configure
OpenSky OAuth to allow a true 15-second upstream refresh.

## Keyed integrations

All provider settings live in config.js; secrets are read from environment
variables. Copy .env.example to .env for local development.

| Variable | Enables |
| --- | --- |
| NEXT_PUBLIC_MAPBOX_TOKEN | Mapbox satellite tiles |
| NEXT_PUBLIC_OPENWEATHERMAP_API_KEY | OpenWeatherMap cloud tiles |
| WINDY_WEBCAMS_API_KEY | Windy public webcam markers |
| OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET | Higher-frequency OpenSky OAuth |
| AISSTREAM_API_KEY | The separate secure AIS relay |
| AIS_SHIP_RELAY_URL / AIS_SHIP_RELAY_TOKEN | Ship snapshots in the web app |

AISStream explicitly prohibits direct browser connections. Deploy a backend
relay that holds AISSTREAM_API_KEY, maintains the upstream WebSocket, and
returns a bounded JSON snapshot with a vessels array. Each vessel supports
mmsi, vesselName, vesselType, flag, destination, latitude, longitude,
speedKnots, headingDegrees, and timestamp.

The relay endpoint receives bbox=west,south,east,north and, when configured,
an Authorization: Bearer token header. Until a relay or provider key is
configured, the corresponding layer reports key needed without affecting the
rest of the dashboard.

## Credibility model

- UNVERIFIED — developing: one raw source signal
- REPORTED: two or more independent domains in a related GDELT headline cluster
- CONFIRMED: reserved for authoritative instrument or agency records

News coverage never auto-upgrades to CONFIRMED. GDELT markers use a clearly
labelled source-country centroid because DOC 2.0 does not provide exact incident
coordinates. RSS items remain unmapped unless Local Mode supplies an area.

## Development

Install dependencies, then run pnpm dev for development or pnpm build for a
production build.

The API routes coalesce concurrent requests, cache within each runtime isolate,
keep stale data during a temporary upstream failure, and return structured
offline states instead of crashing the interface.

## Provider notes

Respect each provider's terms and attribution. RainViewer's public endpoint is
best-effort and intended for personal, educational, and small community use.
Windy webcam preview URLs can expire and are refreshed when the layer reloads.
Only add RSS URLs that are publicly available or that you are licensed to use.
