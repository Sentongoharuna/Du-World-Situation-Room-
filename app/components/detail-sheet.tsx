"use client";

import {
  Activity,
  Camera,
  ExternalLink,
  Gauge,
  MapPin,
  Navigation,
  Plane,
  Radio,
  ShipWheel,
  Waves,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Credibility, MapEntity } from "@/app/lib/types";

type Props = {
  entity: MapEntity | null;
  onClose: () => void;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZoneName: "short",
  }).format(new Date(value));
}

function valueOrDash(value: string | number | null | undefined, suffix = "") {
  return value === null || value === undefined || value === ""
    ? "—"
    : `${value}${suffix}`;
}

function CredibilityBadge({ value }: { value: Credibility }) {
  return (
    <span className={`credibility-badge credibility-${value.toLowerCase()}`}>
      {value === "UNVERIFIED" ? "UNVERIFIED — developing" : value}
    </span>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TypeIcon({ entity }: { entity: MapEntity }) {
  const className = "size-5";
  if (entity.entityType === "flight") return <Plane className={className} />;
  if (entity.entityType === "ship") return <ShipWheel className={className} />;
  if (entity.entityType === "webcam") return <Camera className={className} />;
  if (entity.entityType === "natural") return <Waves className={className} />;
  return <Radio className={className} />;
}

export function DetailSheet({ entity, onClose }: Props) {
  return (
    <Sheet
      open={Boolean(entity)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="detail-sheet w-[min(92vw,430px)] border-l border-[#27414a] bg-[#071014] p-0 text-[#eaf5f4] sm:max-w-[430px]"
      >
        {entity && (
          <>
            <SheetHeader className="detail-sheet-header">
              <div className="detail-kicker">
                <span className="detail-type-icon">
                  <TypeIcon entity={entity} />
                </span>
                <span>{entity.entityType}</span>
                {"credibility" in entity && (
                  <CredibilityBadge value={entity.credibility} />
                )}
              </div>
              <SheetTitle className="pr-10 text-2xl leading-tight text-[#f4fbfa]">
                {entity.title}
              </SheetTitle>
              <SheetDescription className="text-[#8fa9ad]">
                Selected map object · live source record
              </SheetDescription>
            </SheetHeader>

            <div className="detail-scroll">
              {entity.entityType === "webcam" && entity.previewUrl && (
                <figure className="webcam-preview">
                  {/* Provider images are short-lived public preview URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entity.previewUrl} alt={entity.title} />
                  <figcaption>
                    Public broadcast preview · {entity.city}, {entity.country}
                  </figcaption>
                </figure>
              )}

              <section className="detail-section">
                <h3>
                  <Activity className="size-4" /> Live readout
                </h3>
                <dl>
                  {entity.entityType === "flight" && (
                    <>
                      <DataRow label="Callsign" value={entity.callsign} />
                      <DataRow label="Origin" value={entity.originCountry} />
                      <DataRow
                        label="Altitude"
                        value={valueOrDash(
                          entity.altitudeMetres === null
                            ? null
                            : Math.round(entity.altitudeMetres),
                          " m",
                        )}
                      />
                      <DataRow
                        label="Speed"
                        value={valueOrDash(
                          entity.speedMetresPerSecond === null
                            ? null
                            : Math.round(entity.speedMetresPerSecond * 3.6),
                          " km/h",
                        )}
                      />
                      <DataRow
                        label="Heading"
                        value={valueOrDash(entity.headingDegrees, "°")}
                      />
                      <DataRow
                        label="State"
                        value={entity.onGround ? "On ground" : "Airborne"}
                      />
                    </>
                  )}
                  {entity.entityType === "ship" && (
                    <>
                      <DataRow label="MMSI" value={entity.mmsi} />
                      <DataRow label="Vessel type" value={entity.vesselType} />
                      <DataRow label="Flag" value={entity.flag} />
                      <DataRow label="Destination" value={entity.destination} />
                      <DataRow
                        label="Speed"
                        value={valueOrDash(entity.speedKnots, " kn")}
                      />
                      <DataRow
                        label="Heading"
                        value={valueOrDash(entity.headingDegrees, "°")}
                      />
                    </>
                  )}
                  {entity.entityType === "natural" && (
                    <>
                      <DataRow label="Category" value={entity.category} />
                      <DataRow label="Severity" value={entity.severity} />
                      <DataRow
                        label="Magnitude"
                        value={valueOrDash(entity.magnitude)}
                      />
                      {entity.description && (
                        <DataRow label="Context" value={entity.description} />
                      )}
                    </>
                  )}
                  {entity.entityType === "news" && (
                    <>
                      <DataRow label="Theme" value={entity.theme} />
                      <DataRow label="Severity" value={entity.severity} />
                      <DataRow label="Source country" value={entity.sourceCountry} />
                      <DataRow label="Language" value={entity.language} />
                      <DataRow
                        label="Independent sources"
                        value={entity.corroboratingSources}
                      />
                      <DataRow
                        label="Map precision"
                        value={
                          entity.locationPrecision === "source-country"
                            ? "Source-country estimate"
                            : entity.locationPrecision === "local-area"
                              ? "Local-area filter"
                              : "Exact"
                        }
                      />
                    </>
                  )}
                  {entity.entityType === "webcam" && (
                    <>
                      <DataRow label="City" value={entity.city} />
                      <DataRow label="Country" value={entity.country} />
                      <DataRow label="Webcam ID" value={entity.webcamId} />
                    </>
                  )}
                </dl>
              </section>

              <section className="detail-section">
                <h3>
                  <MapPin className="size-4" /> Position
                </h3>
                <dl>
                  <DataRow
                    label="Latitude"
                    value={valueOrDash(entity.latitude?.toFixed(5))}
                  />
                  <DataRow
                    label="Longitude"
                    value={valueOrDash(entity.longitude?.toFixed(5))}
                  />
                </dl>
              </section>

              <section className="detail-section source-block">
                <h3>
                  <Radio className="size-4" /> Source & timestamp
                </h3>
                <p>
                  <strong>{entity.source.name}</strong>
                  <span>{formatTime(entity.source.observedAt)}</span>
                </p>
                <a
                  href={entity.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  Open source <ExternalLink className="size-3.5" />
                </a>
              </section>

              {entity.entityType === "news" && (
                <a
                  href={entity.url}
                  target="_blank"
                  rel="noreferrer"
                  className="detail-primary-link"
                >
                  Read original report <ExternalLink className="size-4" />
                </a>
              )}
              {entity.entityType === "webcam" && entity.playerUrl && (
                <a
                  href={entity.playerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="detail-primary-link"
                >
                  View public stream <ExternalLink className="size-4" />
                </a>
              )}

              <div className="credibility-note">
                <Gauge className="size-4" />
                <p>
                  Raw signals are speed-first and may be wrong. Reported means
                  independent outlets corroborate the event. Confirmed is reserved
                  for authoritative instrument or agency records.
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
