"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type {
  FlightEntity,
  LayerId,
  MapEntity,
  NaturalEntity,
  NewsEntity,
  SearchTarget,
  ShipEntity,
  WeatherFrame,
  WebcamEntity,
} from "@/app/lib/types";

type BaseMap = {
  provider: string;
  tileUrl: string;
  attribution: string;
};

type Props = {
  baseMap: BaseMap | null;
  layers: Record<LayerId, boolean>;
  flights: FlightEntity[];
  ships: ShipEntity[];
  naturalEvents: NaturalEntity[];
  newsEvents: NewsEntity[];
  webcams: WebcamEntity[];
  weatherFrames: WeatherFrame[];
  weatherFrameIndex: number;
  weatherMode: "radar" | "clouds";
  cloudTileUrl: string | null;
  focusTarget: SearchTarget | null;
  onSelect: (entity: MapEntity) => void;
  onViewportChange: (view: {
    bbox: string;
    latitude: number;
    longitude: number;
  }) => void;
};

const FALLBACK_BASEMAP: BaseMap = {
  provider: "Esri World Imagery",
  tileUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles © Esri",
};

function heading(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function tooltipNode(entity: MapEntity): HTMLElement {
  const root = document.createElement("div");
  root.className = "map-tooltip-content";
  const title = document.createElement("strong");
  title.textContent = entity.title;
  const source = document.createElement("span");
  source.textContent = `${entity.source.name} · ${new Date(
    entity.source.observedAt,
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  root.appendChild(title);
  root.appendChild(source);
  return root;
}

function hasPosition(
  entity: MapEntity,
): entity is MapEntity & { latitude: number; longitude: number } {
  return (
    typeof entity.latitude === "number" &&
    typeof entity.longitude === "number" &&
    Number.isFinite(entity.latitude) &&
    Number.isFinite(entity.longitude)
  );
}

export default function SituationMap({
  baseMap,
  layers,
  flights,
  ships,
  naturalEvents,
  newsEvents,
  webcams,
  weatherFrames,
  weatherFrameIndex,
  weatherMode,
  cloudTileUrl,
  focusTarget,
  onSelect,
  onViewportChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const baseLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const weatherLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const weatherKindRef = useRef<"radar" | "clouds" | null>(null);
  const focusLayerRef = useRef<Leaflet.Rectangle | null>(null);
  const groupsRef = useRef<Partial<Record<LayerId, Leaflet.LayerGroup>>>({});
  const callbacksRef = useRef({ onSelect, onViewportChange });

  callbacksRef.current = { onSelect, onViewportChange };

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initialise() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [18, 10],
        zoom: 2.4,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        worldCopyJump: true,
        preferCanvas: true,
      });
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

      (["flights", "ships", "natural", "breaking", "webcams"] as LayerId[]).forEach(
        (id) => {
          const group = L.layerGroup().addTo(map);
          groupsRef.current[id] = group;
        },
      );

      const chosenBase = baseMap ?? FALLBACK_BASEMAP;
      baseLayerRef.current = L.tileLayer(chosenBase.tileUrl, {
        attribution: chosenBase.attribution,
        maxZoom: 18,
      }).addTo(map);

      const reportViewport = () => {
        const bounds = map.getBounds();
        const centre = map.getCenter();
        callbacksRef.current.onViewportChange({
          bbox: [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ].join(","),
          latitude: centre.lat,
          longitude: centre.lng,
        });
      };
      map.on("moveend", reportViewport);
      reportViewport();

      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
    }

    void initialise();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      groupsRef.current = {};
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !baseMap) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    baseLayerRef.current = L.tileLayer(baseMap.tileUrl, {
      attribution: baseMap.attribution,
      maxZoom: 18,
    }).addTo(map);
    baseLayerRef.current.bringToBack();
  }, [baseMap]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const renderGroup = (
      id: LayerId,
      entities: MapEntity[],
      marker: (entity: MapEntity) => Leaflet.Layer,
    ) => {
      const group = groupsRef.current[id];
      if (!group) return;
      group.clearLayers();
      if (!layers[id]) return;
      entities.filter(hasPosition).forEach((entity) => {
        const layer = marker(entity);
        layer.bindTooltip(tooltipNode(entity), {
          className: "wsr-map-tooltip",
          direction: "top",
          offset: [0, -8],
        });
        layer.on("click", () => callbacksRef.current.onSelect(entity));
        layer.addTo(group);
      });
    };

    renderGroup("flights", flights, (entity) => {
      const flight = entity as FlightEntity;
      return L.marker([flight.latitude as number, flight.longitude as number], {
        keyboard: true,
        title: `Flight ${flight.callsign}`,
        icon: L.divIcon({
          className: "wsr-div-icon",
          html: `<span class="flight-marker ${flight.onGround ? "is-ground" : ""}" style="--heading:${heading(
            flight.headingDegrees,
          )}deg" aria-hidden="true">▲</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      });
    });

    renderGroup("ships", ships, (entity) => {
      const ship = entity as ShipEntity;
      return L.marker([ship.latitude as number, ship.longitude as number], {
        keyboard: true,
        title: `Vessel ${ship.vesselName}`,
        icon: L.divIcon({
          className: "wsr-div-icon",
          html: `<span class="ship-marker" style="--heading:${heading(
            ship.headingDegrees,
          )}deg" aria-hidden="true">◆</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      });
    });

    renderGroup("natural", naturalEvents, (entity) => {
      const event = entity as NaturalEntity;
      return L.marker([event.latitude as number, event.longitude as number], {
        keyboard: true,
        title: event.title,
        icon: L.divIcon({
          className: "wsr-div-icon",
          html: `<span class="event-marker severity-${event.severity}" aria-hidden="true"><i></i></span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      });
    });

    renderGroup("breaking", newsEvents, (entity) => {
      const event = entity as NewsEntity;
      return L.marker([event.latitude as number, event.longitude as number], {
        keyboard: true,
        title: event.title,
        icon: L.divIcon({
          className: "wsr-div-icon",
          html: `<span class="breaking-marker severity-${event.severity}" aria-hidden="true"><i></i></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      });
    });

    renderGroup("webcams", webcams, (entity) => {
      const camera = entity as WebcamEntity;
      return L.marker([camera.latitude as number, camera.longitude as number], {
        keyboard: true,
        title: camera.title,
        icon: L.divIcon({
          className: "wsr-div-icon",
          html: '<span class="webcam-marker" aria-hidden="true">●</span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });
    });
  }, [flights, ships, naturalEvents, newsEvents, webcams, layers]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const frame =
      weatherFrames[weatherFrameIndex % Math.max(weatherFrames.length, 1)];
    const tileUrl =
      weatherMode === "clouds" ? cloudTileUrl : frame?.tileUrl ?? null;
    if (!layers.weather || !tileUrl) {
      if (weatherLayerRef.current) {
        map.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
      weatherKindRef.current = null;
      return;
    }

    if (
      weatherLayerRef.current &&
      weatherKindRef.current !== weatherMode
    ) {
      map.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }

    if (!weatherLayerRef.current) {
      weatherLayerRef.current = L.tileLayer(tileUrl, {
        opacity: weatherMode === "clouds" ? 0.48 : 0.58,
        zIndex: 250,
        attribution:
          weatherMode === "clouds"
            ? "Cloud data © OpenWeather"
            : "Weather data © RainViewer",
      }).addTo(map);
      weatherKindRef.current = weatherMode;
    } else {
      weatherLayerRef.current.setUrl(tileUrl, false);
    }
  }, [
    cloudTileUrl,
    layers.weather,
    weatherFrames,
    weatherFrameIndex,
    weatherMode,
  ]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !focusTarget) return;
    const [south, north, west, east] = focusTarget.boundingBox;
    const bounds = L.latLngBounds([south, west], [north, east]);
    map.fitBounds(bounds, { padding: [44, 44], maxZoom: 11, animate: true });
    if (focusLayerRef.current) map.removeLayer(focusLayerRef.current);
    focusLayerRef.current = L.rectangle(bounds, {
      color: "#38e8d0",
      weight: 1,
      dashArray: "5 6",
      fillColor: "#38e8d0",
      fillOpacity: 0.035,
    }).addTo(map);
  }, [focusTarget]);

  return (
    <div className="map-stage" aria-label="Interactive global situation map">
      <div ref={containerRef} className="situation-map" />
      <div className="map-scanline" aria-hidden="true" />
      <div className="map-reticle" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
