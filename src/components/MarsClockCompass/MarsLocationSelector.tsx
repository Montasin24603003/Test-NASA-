import React, { useState } from "react";
import {
  Compass,
  Globe2,
  MapPin,
  MapPinned,
  Mountain,
  Navigation,
  Radio,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  MARS_LOCATIONS,
  DEFAULT_MARS_LOCATION,
  type MarsLocation,
} from "@/lib/mars-locations";
import { calculateMarsBearingAndDistance } from "@/lib/mars-time";

interface MarsLocationSelectorProps {
  selectedLocation: MarsLocation;
  onSelectLocation: (loc: MarsLocation) => void;
}

export function MarsLocationSelector({
  selectedLocation,
  onSelectLocation,
}: MarsLocationSelectorProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customLat, setCustomLat] = useState(selectedLocation.latitude);
  const [customLon, setCustomLon] = useState(selectedLocation.longitude);
  const [customName, setCustomName] = useState("Custom Waypoint");

  // Calculate distance & bearing from Perseverance at Jezero Crater (18.38°N, 77.58°E)
  const jezeroRef = MARS_LOCATIONS[0] ?? DEFAULT_MARS_LOCATION;
  const relativeToJezero = calculateMarsBearingAndDistance(
    jezeroRef.latitude,
    jezeroRef.longitude,
    selectedLocation.latitude,
    selectedLocation.longitude
  );

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = MARS_LOCATIONS.find((loc) => loc.id === e.target.value);
    if (found) {
      setIsCustomMode(false);
      onSelectLocation(found);
      setCustomLat(found.latitude);
      setCustomLon(found.longitude);
      setCustomName(found.name);
    }
  };

  const applyCustomCoordinates = (lat: number, lon: number, name: string) => {
    const clampedLat = Math.max(-90, Math.min(90, lat));
    let normalizedLon = lon % 360;
    if (normalizedLon < 0) normalizedLon += 360;

    const customLoc: MarsLocation = {
      id: "custom-site",
      name: name || "Custom Coordinates",
      region: "User Survey Grid",
      latitude: Math.round(clampedLat * 100) / 100,
      longitude: Math.round(normalizedLon * 100) / 100,
      elevation: "Modelled Surface Datum",
      category: "anomaly",
      description: "User-defined Martian surface coordinates for precision solar timing and navigation.",
      crustalFieldStrength: "Localized interpolation",
      crustalFieldCategory: "weak",
      simulatedCrustalDeclinationDeg: Math.round((Math.sin(clampedLat * 0.1) * 35) * 10) / 10,
    };

    onSelectLocation(customLoc);
  };

  return (
    <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-line/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
              <MapPinned className="size-4" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber">
              Shared Martian Location Reference
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-bright">
            {selectedLocation.name}
          </h2>
          <p className="mt-0.5 text-xs text-fog">
            {selectedLocation.region} · {selectedLocation.description}
          </p>
        </div>

        {/* Preset Selector Dropdown & Custom Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <select
              value={isCustomMode ? "custom" : selectedLocation.id}
              onChange={handlePresetChange}
              className="w-full appearance-none rounded-xl border border-line bg-white px-3.5 py-2 font-mono text-xs font-semibold text-bright shadow-xs outline-none transition-all hover:border-amber/50 focus:border-amber focus:ring-2 focus:ring-amber/20"
              aria-label="Select Martian location"
            >
              <optgroup label="NASA & International Mission Landing Sites">
                {MARS_LOCATIONS.filter((l) => l.category === "mission").map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({Math.abs(loc.latitude).toFixed(1)}°{loc.latitude >= 0 ? "N" : "S"}, {loc.longitude.toFixed(1)}°E)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volcanoes & Planetary Rifts">
                {MARS_LOCATIONS.filter((l) => l.category === "volcano" || l.category === "canyon").map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({Math.abs(loc.latitude).toFixed(1)}°{loc.latitude >= 0 ? "N" : "S"}, {loc.longitude.toFixed(1)}°E)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Polar Ice Caps & Magnetic Anomalies">
                {MARS_LOCATIONS.filter((l) => l.category === "polar" || l.category === "anomaly" || l.category === "crater").map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({Math.abs(loc.latitude).toFixed(1)}°{loc.latitude >= 0 ? "N" : "S"}, {loc.longitude.toFixed(1)}°E)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCustomMode(!isCustomMode);
              if (!isCustomMode) {
                applyCustomCoordinates(customLat, customLon, customName);
              }
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs font-semibold transition-colors ${
              isCustomMode
                ? "border-amber bg-amber text-white shadow-xs"
                : "border-line bg-white text-fog hover:text-bright"
            }`}
          >
            <Sliders className="size-3.5" />
            {isCustomMode ? "Coordinates Active" : "Custom Lat/Lon"}
          </button>
        </div>
      </div>

      {/* Custom Coordinate Sliders & Inputs (When Active) */}
      {isCustomMode && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/[0.05] p-4 text-xs animate-in fade-in">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber">
            Manual Coordinate Injection
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {/* Latitude Slider & Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-fog">Latitude (-90°S to +90°N):</span>
                <span className="font-bold text-bright">
                  {Math.abs(customLat).toFixed(2)}°{customLat >= 0 ? "N" : "S"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={0.1}
                  value={customLat}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCustomLat(val);
                    applyCustomCoordinates(val, customLon, customName);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-line accent-amber"
                  aria-label="Martian latitude slider"
                />
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step={0.1}
                  value={customLat}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) {
                      setCustomLat(val);
                      applyCustomCoordinates(val, customLon, customName);
                    }
                  }}
                  className="w-16 rounded-md border border-line bg-white px-2 py-1 text-center font-mono text-xs font-bold text-bright"
                  aria-label="Martian latitude number input"
                />
              </div>
            </div>

            {/* Longitude Slider & Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-fog">Longitude (0° to 360° East):</span>
                <span className="font-bold text-bright">{customLon.toFixed(2)}°E</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={359.9}
                  step={0.1}
                  value={customLon}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCustomLon(val);
                    applyCustomCoordinates(customLat, val, customName);
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-line accent-cyan"
                  aria-label="Martian longitude slider"
                />
                <input
                  type="number"
                  min={0}
                  max={359.9}
                  step={0.1}
                  value={customLon}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) {
                      setCustomLon(val);
                      applyCustomCoordinates(customLat, val, customName);
                    }
                  }}
                  className="w-16 rounded-md border border-line bg-white px-2 py-1 text-center font-mono text-xs font-bold text-bright"
                  aria-label="Martian longitude number input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Surface Telemetry Metadata Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-2xs">
          <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Coordinates</p>
          <p className="mt-1 font-bold text-bright">
            {Math.abs(selectedLocation.latitude).toFixed(2)}°
            {selectedLocation.latitude >= 0 ? "N" : "S"},{" "}
            {selectedLocation.longitude.toFixed(2)}°E
          </p>
          <p className="mt-0.5 text-[10px] text-fog">IAU 2000 Mars Datum</p>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-2xs">
          <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Surface Elevation</p>
          <p className="mt-1 font-bold text-bright">{selectedLocation.elevation}</p>
          <p className="mt-0.5 text-[10px] text-fog">MOLA laser altimetry</p>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-2xs">
          <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Crustal Remnant</p>
          <p className="mt-1 font-bold text-rose">{selectedLocation.crustalFieldStrength}</p>
          <p className="mt-0.5 text-[10px] text-fog">MAVEN / MGS MAG data</p>
        </div>

        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-2xs">
          <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Offset from Jezero</p>
          <p className="mt-1 font-bold text-cyan">
            {relativeToJezero.distanceKm.toLocaleString()} km
          </p>
          <p className="mt-0.5 text-[10px] text-fog">
            Bearing: {relativeToJezero.initialBearingDeg}°
          </p>
        </div>
      </div>
    </div>
  );
}
