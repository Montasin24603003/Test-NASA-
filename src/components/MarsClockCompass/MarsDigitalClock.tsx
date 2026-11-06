import React from "react";
import {
  Calendar,
  Clock,
  Compass,
  FastForward,
  Flame,
  Globe2,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Timer,
  Zap,
} from "lucide-react";
import type { MarsTimeData } from "@/lib/mars-time";
import { formatTime12 } from "@/lib/mars-time";
import type { MarsLocation } from "@/lib/mars-locations";

interface MarsDigitalClockProps {
  timeData: MarsTimeData;
  selectedLocation: MarsLocation;
  dialMode: "24h" | "12h";
  setDialMode: (mode: "24h" | "12h") => void;
  timeType: "LTST" | "LMST";
  setTimeType: (type: "LTST" | "LMST") => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  onResetTime: () => void;
}

export function MarsDigitalClock({
  timeData,
  selectedLocation,
  dialMode,
  setDialMode,
  timeType,
  setTimeType,
  simSpeed,
  setSimSpeed,
  onResetTime,
}: MarsDigitalClockProps) {
  const currentHours = timeType === "LTST" ? timeData.ltstHours : timeData.lmstHours;
  const timeFormatted24 = timeType === "LTST" ? timeData.ltstFormatted : timeData.lmstFormatted;
  const timeFormatted12 = formatTime12(currentHours);

  return (
    <div className="flex flex-col justify-between space-y-4">
      {/* Top Banner: Sol Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
            <Timer className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber">
                Martian Sol Date
              </span>
              <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[9px] font-bold text-mint">
                LIVE SYNC
              </span>
            </div>
            <p className="font-display text-xl font-bold tracking-tight text-bright">
              SOL {timeData.solNumber}
              <span className="ml-2 font-mono text-xs font-normal text-fog">
                · {(timeData.solFraction * 100).toFixed(1)}% elapsed
              </span>
            </p>
          </div>
        </div>

        {/* View toggles: 24h/12h and LTST/LMST */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-ink2/70 p-1">
          <button
            type="button"
            onClick={() => setDialMode(dialMode === "24h" ? "12h" : "24h")}
            className="rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors hover:text-bright"
            title="Toggle between 24-hour and 12-hour AM/PM dial format"
          >
            {dialMode.toUpperCase()}
          </button>
          <div className="h-3 w-px bg-line" />
          <button
            type="button"
            onClick={() => setTimeType(timeType === "LTST" ? "LMST" : "LTST")}
            className="rounded-lg bg-white px-2.5 py-1 font-mono text-[10px] font-semibold text-bright shadow-sm transition-colors hover:bg-white/90"
            title="Switch between Local True Solar Time (Sundial) and Local Mean Solar Time"
          >
            {timeType === "LTST" ? "TRUE SOLAR (LTST)" : "MEAN SOLAR (LMST)"}
          </button>
        </div>
      </div>

      {/* Main Massive Digital Clock Display */}
      <div className="rounded-2xl border border-amber/25 bg-gradient-to-br from-amber/[0.08] via-white to-cyan/[0.04] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">
            Local Solar Time ({timeType})
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/80 px-2 py-0.5 font-mono text-[9px] text-fog">
            <Sun className="size-3 text-amber" />
            {timeData.isDaylight ? "Daylight · Solar Zenith" : "Night · Surface Shadow"}
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          {dialMode === "24h" ? (
            <p className="font-mono text-4xl font-bold tracking-tight text-bright sm:text-5xl lg:text-6xl">
              {timeFormatted24}
            </p>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="font-mono text-4xl font-bold tracking-tight text-bright sm:text-5xl lg:text-6xl">
                {timeFormatted12.time}
              </p>
              <span className="font-mono text-lg font-bold text-amber">
                {timeFormatted12.period}
              </span>
            </div>
          )}
          <span className="font-mono text-xs text-fog">M-SOL</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-fog">
          <span>
            Location: <strong className="text-bright">{selectedLocation.name}</strong>
          </span>
          <span>·</span>
          <span>
            Coordinates:{" "}
            <strong className="text-bright">
              {Math.abs(selectedLocation.latitude).toFixed(2)}°
              {selectedLocation.latitude >= 0 ? "N" : "S"},{" "}
              {selectedLocation.longitude.toFixed(2)}°E
            </strong>
          </span>
        </div>

        {/* Mars Sol Day Length Citation */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-line/80 bg-white/80 px-3 py-2 text-[11px]">
          <span className="font-mono text-[10px] text-fog">Martian Solar Day (Sol):</span>
          <span className="font-mono font-semibold text-bright">
            24h 39m 35.24s{" "}
            <span className="font-normal text-fog">(88,775.244s · 1.0275x Earth Day)</span>
          </span>
        </div>
      </div>

      {/* Ephemeris & Astronomical Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Coordinated Mars Time (MTC) */}
        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-xs">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-fog">
            Prime Meridian (MTC)
          </p>
          <p className="mt-1 font-mono text-base font-bold text-bright">
            {timeData.mtcFormatted}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-fog">Airy-0 Crater (0° Lon)</p>
        </div>

        {/* Solar Longitude Ls & Season */}
        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-xs">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-fog">
            Solar Longitude (Ls)
          </p>
          <p className="mt-1 font-mono text-base font-bold text-amber">
            {timeData.solarLongitudeLs}°
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-fog truncate" title={timeData.martianSeason}>
            {timeData.martianSeasonShort} · MY{timeData.martianYear}
          </p>
        </div>

        {/* Equation of Time (EOT) */}
        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-xs">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-fog">
            Equation of Time
          </p>
          <p className="mt-1 font-mono text-base font-bold text-cyan">
            {timeData.eotMinutes > 0 ? `+${timeData.eotMinutes}` : timeData.eotMinutes} min
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-fog">True vs Mean offset</p>
        </div>

        {/* Sun Altitude & Insolation */}
        <div className="rounded-xl border border-line bg-white/70 p-3 shadow-xs">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-fog">
            Sun Elevation
          </p>
          <p className="mt-1 font-mono text-base font-bold text-bright">
            {timeData.sunElevationDeg > 0 ? `+${timeData.sunElevationDeg}°` : `${timeData.sunElevationDeg}°`}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-fog">
            {timeData.solarInsolationWm2} W/m² irradiance
          </p>
        </div>
      </div>

      {/* Active NASA Rover Sols & Speed Demonstration Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/80 bg-panel/70 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
          <div>
            <span className="text-fog">Perseverance (Jezero): </span>
            <strong className="text-amber">Sol {timeData.perseveranceSol}</strong>
          </div>
          <div>
            <span className="text-fog">Curiosity (Gale): </span>
            <strong className="text-cyan">Sol {timeData.curiositySol}</strong>
          </div>
        </div>

        {/* Speed Demonstration Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fog">
            Clock Speed:
          </span>
          {[1, 10, 60, 300].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setSimSpeed(spd)}
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition-colors ${
                simSpeed === spd
                  ? "bg-amber text-white font-bold shadow-xs"
                  : "border border-line bg-white text-fog hover:text-bright"
              }`}
            >
              {spd}x
            </button>
          ))}
          {simSpeed !== 1 && (
            <button
              type="button"
              onClick={onResetTime}
              className="flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 font-mono text-[10px] text-fog hover:text-bright"
              title="Reset to Real-Time UTC"
            >
              <RotateCcw className="size-3 text-amber" />
              Live
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
