import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Compass,
  Cpu,
  Globe2,
  Navigation,
  Radio,
  RotateCcw,
  Sparkles,
  Sun,
  Timer,
  Zap,
} from "lucide-react";
import { calculateMarsTime, type MarsTimeData } from "@/lib/mars-time";
import { DEFAULT_MARS_LOCATION, type MarsLocation } from "@/lib/mars-locations";
import { MarsAnalogClock } from "./MarsAnalogClock";
import { MarsDigitalClock } from "./MarsDigitalClock";
import { MarsCompass3D } from "./MarsCompass3D";
import { MarsLocationSelector } from "./MarsLocationSelector";
import { MarsScienceNotes } from "./MarsScienceNotes";

export function MarsClockCompassDashboard() {
  // Shared state
  const [selectedLocation, setSelectedLocation] = useState<MarsLocation>(DEFAULT_MARS_LOCATION);
  const [headingDeg, setHeadingDeg] = useState<number>(45); // Default initial heading (045° NE)
  const [dialMode, setDialMode] = useState<"24h" | "12h">("24h");
  const [timeType, setTimeType] = useState<"LTST" | "LMST">("LTST");
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [simDate, setSimDate] = useState<Date>(() => new Date());

  // Real-time clock tick with speed multiplier
  useEffect(() => {
    const interval = setInterval(() => {
      setSimDate((prevDate) => {
        if (simSpeed === 1) {
          return new Date();
        }
        return new Date(prevDate.getTime() + 1000 * simSpeed);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simSpeed]);

  const handleResetTime = () => {
    setSimSpeed(1);
    setSimDate(new Date());
  };

  // Compute live high-precision Mars astronomical ephemeris
  const timeData: MarsTimeData = calculateMarsTime(
    simDate,
    selectedLocation.longitude,
    selectedLocation.latitude
  );

  return (
    <div className="space-y-6">
      {/* Top Mission Telemetry Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mint">
              <span className="size-1.5 rounded-full bg-mint animate-pulse" /> NASA Space Apps 2026
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber">
              <Timer className="size-3" /> Mars24 Ephemeris Active
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-bright sm:text-3xl">
            Mars Local Time Clock &amp; 3D Planetary Compass
          </h1>
          <p className="mt-1 text-xs text-fog max-w-2xl">
            Scientific solar chronometer and directional gyro navigation console calibrated for Mars
            surface operations, mission landing sites, and planetary exploration.
          </p>
        </div>

        {/* Global Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <div className="rounded-xl border border-line bg-ink2/70 px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Earth Reference</p>
            <p className="font-semibold text-bright">{timeData.utcDateString}</p>
          </div>
          <div className="rounded-xl border border-line bg-ink2/70 px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-[0.16em] text-fog">Earth-Mars Delay</p>
            <p className="font-semibold text-amber">
              ~{timeData.lightTravelTimeMinutes.toFixed(1)} min 1-way
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Mars Local Time Clock & 3D Mars Compass */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Section 1: Mars Local Time Clock (7 cols on large screens) */}
        <section
          aria-label="Mars Local Time Clock"
          className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6 lg:col-span-7 flex flex-col justify-between"
        >
          <div className="grid gap-6 md:grid-cols-[1.1fr_1.3fr] items-center">
            {/* Analog Mars Clock */}
            <div className="flex flex-col items-center justify-center p-2">
              <MarsAnalogClock
                timeData={timeData}
                dialMode={dialMode}
                timeType={timeType}
                size={280}
              />
            </div>

            {/* Digital Mars Clock & Controls */}
            <MarsDigitalClock
              timeData={timeData}
              selectedLocation={selectedLocation}
              dialMode={dialMode}
              setDialMode={setDialMode}
              timeType={timeType}
              setTimeType={setTimeType}
              simSpeed={simSpeed}
              setSimSpeed={setSimSpeed}
              onResetTime={handleResetTime}
            />
          </div>
        </section>

        {/* Section 2: Interactive 3D Mars Compass (5 cols on large screens) */}
        <section
          aria-label="Interactive 3D Mars Compass"
          className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6 lg:col-span-5 flex flex-col justify-between"
        >
          <MarsCompass3D
            headingDeg={headingDeg}
            setHeadingDeg={setHeadingDeg}
            selectedLocation={selectedLocation}
          />
        </section>
      </div>

      {/* Section 3: Shared Mars Location Selector */}
      <MarsLocationSelector
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
      />

      {/* Section 4: Mission Science Documentation & Mathematical Foundations */}
      <MarsScienceNotes />
    </div>
  );
}
