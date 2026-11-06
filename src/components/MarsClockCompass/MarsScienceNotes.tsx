import React, { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Globe2,
  Orbit,
  Sparkles,
  Sun,
  Timer,
} from "lucide-react";

export function MarsScienceNotes() {
  const [openSection, setOpenSection] = useState<string | null>("time");

  const toggle = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  return (
    <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
      <div className="flex items-center gap-2 border-b border-line/70 pb-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
          <BookOpen className="size-4" />
        </span>
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan">
            Mission Science &amp; Ephemeris Documentation
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight text-bright">
            How Mars Time &amp; Planetary Navigation Work
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Section 1: Mars Time Calculations */}
        <div className="rounded-xl border border-line/80 bg-ink2/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggle("time")}
            className="flex w-full items-center justify-between p-4 text-left font-display font-semibold text-bright transition-colors hover:bg-ink2/70"
          >
            <span className="flex items-center gap-2 text-sm">
              <Timer className="size-4 text-amber" />
              1. NASA Mars24 Ephemeris &amp; Allison-McEwen (2000) Mathematical Formulation
            </span>
            {openSection === "time" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {openSection === "time" && (
            <div className="border-t border-line/70 p-4 text-xs leading-relaxed text-fog space-y-3">
              <p>
                A Martian solar day (called a <strong className="text-bright">Sol</strong>) lasts{" "}
                <strong className="text-amber">24 hours, 39 minutes, and 35.244 seconds</strong> (88,775.244
                Earth seconds). Because one Martian sol is approximately 2.75% longer than an Earth solar day, Earth
                time zones and leap seconds cannot be directly mapped to Martian surface operations.
              </p>
              <div className="rounded-lg border border-line bg-white/90 p-3 font-mono text-[11px] text-bright">
                <p className="text-amber font-semibold">Julian Date to Mars Sol Date (MSD):</p>
                <p className="mt-1 text-fog">
                  JD_TT = JD_UTC + (69.184s / 86400s)
                </p>
                <p className="mt-1 text-fog">
                  MSD = (JD_TT − 2451549.5) / 1.027491252 + 44796.0 − 0.00096
                </p>
                <p className="mt-1 text-fog">
                  MTC = (MSD × 24h) mod 24h
                </p>
                <p className="mt-1 text-fog">
                  LMST = (MTC + Longitude_East / 15°) mod 24h
                </p>
              </div>
              <p>
                <strong className="text-bright">Coordinated Mars Time (MTC):</strong> Analogous to UTC on Earth, MTC
                is defined as the mean solar time at the Martian Prime Meridian passing through Airy-0 crater.
              </p>
              <p>
                <strong className="text-bright">LMST vs LTST (Equation of Time):</strong> Local Mean Solar Time (LMST)
                assumes a constant circular orbit. Because Mars has an orbital eccentricity of{" "}
                <strong className="text-bright">0.0934</strong> (over 5 times greater than Earth's 0.0167), Mars accelerates
                significantly at perihelion. The difference between real sundial time (<strong className="text-amber">Local True Solar Time, LTST</strong>)
                and mean clock time swings by up to <strong className="text-amber">51 Martian minutes</strong> across the year!
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Planetary Compass Physics */}
        <div className="rounded-xl border border-line/80 bg-ink2/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggle("compass")}
            className="flex w-full items-center justify-between p-4 text-left font-display font-semibold text-bright transition-colors hover:bg-ink2/70"
          >
            <span className="flex items-center gap-2 text-sm">
              <Compass className="size-4 text-cyan" />
              2. Planetary Magnetism &amp; Rover Navigation Without an Active Dynamo
            </span>
            {openSection === "compass" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {openSection === "compass" && (
            <div className="border-t border-line/70 p-4 text-xs leading-relaxed text-fog space-y-3">
              <p>
                On Earth, liquid iron circulation in the outer core powers a global magnetic field with clear North and South
                dipolar poles. <strong className="text-bright">On Mars, this dynamo shut down ~4.0 billion years ago.</strong>
              </p>
              <p>
                As a result, a handheld magnetic needle on Mars will not point North. In unmagnetized lowlands like
                Hellas Basin or Jezero Crater, the magnetic field is near zero (~15–25 nT vs Earth's ~50,000 nT). In ancient
                southern crustal belts (like Terra Sirenum), intensely magnetized rock bands produce strong local magnetic
                deflections up to 1,500 nT that point in arbitrary directions.
              </p>
              <p>
                <strong className="text-bright">How Real Mars Rovers Navigate:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-bright">Optical Sun-Sensors:</strong> Measure the precise solar elevation and
                  azimuth angles to calculate True Rotational North.
                </li>
                <li>
                  <strong className="text-bright">Inertial Measurement Units (IMUs):</strong> Fiber-optic gyroscopes and
                  accelerometers monitor heading changes in real time.
                </li>
                <li>
                  <strong className="text-bright">Visual Odometry (VO):</strong> Navigation cameras compare stereo terrain
                  features frame-by-frame to track wheel slippage and absolute azimuth.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Section 3: Seasons & Solar Longitude Ls */}
        <div className="rounded-xl border border-line/80 bg-ink2/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggle("seasons")}
            className="flex w-full items-center justify-between p-4 text-left font-display font-semibold text-bright transition-colors hover:bg-ink2/70"
          >
            <span className="flex items-center gap-2 text-sm">
              <Orbit className="size-4 text-rose" />
              3. Aerocentric Solar Longitude (Ls) &amp; Martian Seasons
            </span>
            {openSection === "seasons" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {openSection === "seasons" && (
            <div className="border-t border-line/70 p-4 text-xs leading-relaxed text-fog space-y-2">
              <p>
                Martian seasons are measured by the <strong className="text-bright">Aerocentric Solar Longitude (Ls)</strong>,
                which tracks the apparent position of the Sun along Mars's orbital plane:
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-4">
                <div className="rounded-md border border-line bg-white p-2">
                  <span className="text-amber font-semibold">Ls = 0°</span>
                  <p className="text-bright font-bold">North Spring Equinox</p>
                </div>
                <div className="rounded-md border border-line bg-white p-2">
                  <span className="text-cyan font-semibold">Ls = 90°</span>
                  <p className="text-bright font-bold">North Summer Solstice</p>
                </div>
                <div className="rounded-md border border-line bg-white p-2">
                  <span className="text-amber font-semibold">Ls = 180°</span>
                  <p className="text-bright font-bold">North Autumn Equinox</p>
                </div>
                <div className="rounded-md border border-line bg-white p-2">
                  <span className="text-cyan font-semibold">Ls = 270°</span>
                  <p className="text-bright font-bold">North Winter Solstice</p>
                </div>
              </div>
              <p className="pt-1">
                Due to Mars's orbital eccentricity, the seasons have unequal lengths: Northern Spring is 194 sols, while
                Northern Autumn is only 142 sols!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
