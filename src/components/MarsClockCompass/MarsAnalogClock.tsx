import React, { useMemo } from "react";
import type { MarsTimeData } from "@/lib/mars-time";

interface MarsAnalogClockProps {
  timeData: MarsTimeData;
  dialMode: "24h" | "12h";
  timeType: "LTST" | "LMST";
  size?: number;
}

export function MarsAnalogClock({
  timeData,
  dialMode,
  timeType,
  size = 320,
}: MarsAnalogClockProps) {
  const currentHours = timeType === "LTST" ? timeData.ltstHours : timeData.lmstHours;
  const hourHandAngle = dialMode === "24h" ? timeData.hourHandDegrees24 : timeData.hourHandDegrees12;
  const minuteHandAngle = timeData.minuteHandDegrees;
  const secondHandAngle = timeData.secondHandDegrees;

  // Day/Night illumination visualization for 24h dial
  // 0h is Top (0° / 360°), 6h is East (90°), 12h is South (180°), 18h is West (270°)
  // We calculate solar dawn/dusk arc on the 24h dial based on sun elevation
  const is24h = dialMode === "24h";

  // Generate tick marks for the clock face
  const tickMarks = useMemo(() => {
    const ticks: Array<{
      angle: number;
      isMajor: boolean;
      isSemi: boolean;
      label?: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      textX: number;
      textY: number;
    }> = [];

    const totalHours = is24h ? 24 : 12;
    const center = 150;
    const radius = 136;

    // 60 minute/second fine ticks
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * 360;
      const rad = ((angle - 90) * Math.PI) / 180;
      const isMajorMinute = i % 5 === 0;
      const len = isMajorMinute ? 9 : 4;

      const x1 = center + (radius - len) * Math.cos(rad);
      const y1 = center + (radius - len) * Math.sin(rad);
      const x2 = center + radius * Math.cos(rad);
      const y2 = center + radius * Math.sin(rad);

      ticks.push({
        angle,
        isMajor: false,
        isSemi: isMajorMinute,
        x1,
        y1,
        x2,
        y2,
        textX: 0,
        textY: 0,
      });
    }

    // Hour numerals
    const hourTicks = [];
    for (let h = 0; h < totalHours; h++) {
      const angle = (h / totalHours) * 360;
      const rad = ((angle - 90) * Math.PI) / 180;
      const len = 14;

      const x1 = center + (radius - len) * Math.cos(rad);
      const y1 = center + (radius - len) * Math.sin(rad);
      const x2 = center + radius * Math.cos(rad);
      const y2 = center + radius * Math.sin(rad);

      const textRadius = radius - 24;
      const textX = center + textRadius * Math.cos(rad);
      const textY = center + textRadius * Math.sin(rad);

      hourTicks.push({
        angle,
        isMajor: true,
        isSemi: false,
        label: is24h ? (h === 0 ? "00" : h.toString().padStart(2, "0")) : (h === 0 ? "12" : h.toString()),
        x1,
        y1,
        x2,
        y2,
        textX,
        textY,
      });
    }

    return { fineTicks: ticks, hourTicks };
  }, [is24h]);

  // Sun position angle on the dial
  const sunDialAngle = is24h ? (timeData.ltstHours / 24.0) * 360 : ((timeData.ltstHours % 12) / 12.0) * 360;
  const sunRad = ((sunDialAngle - 90) * Math.PI) / 180;
  const sunX = 150 + 94 * Math.cos(sunRad);
  const sunY = 150 + 94 * Math.sin(sunRad);

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg
        viewBox="0 0 300 300"
        className="w-full max-w-[320px] transition-transform duration-300"
        style={{ width: size, height: size }}
      >
        <defs>
          {/* Bezel Outer Shadow */}
          <radialGradient id="marsBezelGrad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#f3ede6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#d8cfc4" stopOpacity="1" />
          </radialGradient>

          {/* Clock Dial Face Gradient */}
          <radialGradient id="marsFaceGrad" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#faf7f4" />
            <stop offset="100%" stopColor="#ede6dd" />
          </radialGradient>

          {/* Day / Night Arc Gradient for 24h dial */}
          <linearGradient id="dayNightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0d1f33" stopOpacity="0.12" /> {/* Night (00:00) */}
            <stop offset="25%" stopColor="#e06822" stopOpacity="0.15" /> {/* Dawn (06:00) */}
            <stop offset="50%" stopColor="#fca311" stopOpacity="0.18" /> {/* Noon (12:00) */}
            <stop offset="75%" stopColor="#e06822" stopOpacity="0.15" /> {/* Dusk (18:00) */}
            <stop offset="100%" stopColor="#0d1f33" stopOpacity="0.12" />
          </linearGradient>

          {/* Hand Glow */}
          <filter id="handShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1e293b" floodOpacity="0.25" />
          </filter>

          <filter id="secondGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#ea580c" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Outer Titanium Bezel */}
        <circle cx="150" cy="150" r="147" fill="url(#marsBezelGrad)" stroke="#c7bbb0" strokeWidth="2.5" />
        <circle cx="150" cy="150" r="142" fill="none" stroke="#e2d8cd" strokeWidth="1" />

        {/* Dial Face */}
        <circle
          cx="150"
          cy="150"
          r="138"
          fill="url(#marsFaceGrad)"
          stroke="#baa99a"
          strokeWidth="1.2"
        />

        {/* 24h Solar Day/Night Atmosphere Ring */}
        {is24h && (
          <circle
            cx="150"
            cy="150"
            r="105"
            fill="none"
            stroke="url(#dayNightGrad)"
            strokeWidth="18"
            strokeDasharray="4 2"
            opacity="0.85"
          />
        )}

        {/* Fine Minute/Second Ticks */}
        {tickMarks.fineTicks.map((tick, i) => (
          <line
            key={`fine-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.isSemi ? "#ea580c" : "#8d7b6f"}
            strokeWidth={tick.isSemi ? 1.6 : 0.8}
            strokeOpacity={tick.isSemi ? 0.85 : 0.45}
          />
        ))}

        {/* Major Hour Ticks and Numerals */}
        {tickMarks.hourTicks.map((tick, i) => (
          <g key={`hour-${i}`}>
            <line
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={i % (is24h ? 6 : 3) === 0 ? "#ea580c" : "#2d3748"}
              strokeWidth={i % (is24h ? 6 : 3) === 0 ? 2.4 : 1.6}
            />
            {tick.label && (
              <text
                x={tick.textX}
                y={tick.textY + 4}
                textAnchor="middle"
                fontSize={is24h ? "10" : "12"}
                fontWeight={i % (is24h ? 6 : 3) === 0 ? "700" : "600"}
                fill={i % (is24h ? 6 : 3) === 0 ? "#c2410c" : "#1f2937"}
                fontFamily="Space Grotesk, sans-serif"
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}

        {/* Dial Center Badges */}
        <text
          x="150"
          y="85"
          textAnchor="middle"
          fontSize="8.5"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="600"
          letterSpacing="0.18em"
          fill="#c2410c"
        >
          MARS LOCAL SOLAR
        </text>
        <text
          x="150"
          y="98"
          textAnchor="middle"
          fontSize="7.5"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="500"
          letterSpacing="0.12em"
          fill="#64748b"
        >
          {timeType} · {dialMode.toUpperCase()}
        </text>

        {/* Sol Progression Ring in Center */}
        <circle cx="150" cy="150" r="54" fill="none" stroke="#e2d8cd" strokeWidth="1" strokeDasharray="3 3" />
        <circle
          cx="150"
          cy="150"
          r="54"
          fill="none"
          stroke="#ea580c"
          strokeWidth="2.5"
          strokeDasharray={`${(timeData.solFraction * 339.29).toFixed(1)} 340`}
          strokeLinecap="round"
          transform="rotate(-90 150 150)"
          opacity="0.75"
        />

        {/* Subsolar Track Sun Indicator */}
        <g transform={`translate(${sunX}, ${sunY})`}>
          <circle r="5" fill="#f59e0b" filter="url(#secondGlow)" />
          <circle r="2.5" fill="#ffffff" />
        </g>

        {/* Dial Center Mission Status Text */}
        <text
          x="150"
          y="202"
          textAnchor="middle"
          fontSize="9"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="600"
          letterSpacing="0.15em"
          fill="#1e293b"
        >
          SOL {timeData.solNumber}
        </text>
        <text
          x="150"
          y="214"
          textAnchor="middle"
          fontSize="7"
          fontFamily="IBM Plex Mono, monospace"
          letterSpacing="0.1em"
          fill="#64748b"
        >
          {timeData.isDaylight ? "DAYLIGHT · SUN VISIBLE" : "NIGHT · SURFACE SHADOW"}
        </text>

        {/* HOUR HAND */}
        <g transform={`rotate(${hourHandAngle} 150 150)`} filter="url(#handShadow)">
          {/* Counterbalance */}
          <circle cx="150" cy="172" r="5" fill="#1e293b" />
          <rect x="148" y="150" width="4" height="22" rx="2" fill="#1e293b" />
          {/* Main Hand */}
          <polygon
            points="148,150 150,75 152,150"
            fill="#1e293b"
          />
          {/* Luminous Core */}
          <rect x="148.5" y="85" width="3" height="45" rx="1.5" fill="#f97316" />
        </g>

        {/* MINUTE HAND */}
        <g transform={`rotate(${minuteHandAngle} 150 150)`} filter="url(#handShadow)">
          {/* Counterbalance */}
          <rect x="148.5" y="150" width="3" height="28" rx="1.5" fill="#334155" />
          {/* Main Hand */}
          <polygon
            points="148.2,150 150,42 151.8,150"
            fill="#334155"
          />
          {/* Luminous Core */}
          <rect x="149" y="55" width="2" height="65" rx="1" fill="#0284c7" />
        </g>

        {/* SECOND HAND (Mars Crimson / Orange Sweeping Hand) */}
        <g transform={`rotate(${secondHandAngle} 150 150)`} filter="url(#secondGlow)">
          <line x1="150" y1="184" x2="150" y2="34" stroke="#dc2626" strokeWidth="1.4" />
          {/* Open Counterbalance Ring */}
          <circle cx="150" cy="168" r="4.5" fill="none" stroke="#dc2626" strokeWidth="1.4" />
          {/* Arrowhead Indicator */}
          <polygon points="148.5,38 150,30 151.5,38" fill="#dc2626" />
        </g>

        {/* Center Pivot Cap */}
        <circle cx="150" cy="150" r="6" fill="#1e293b" stroke="#f8fafc" strokeWidth="1.5" />
        <circle cx="150" cy="150" r="2.5" fill="#ea580c" />
      </svg>

      {/* Mode / Legend Footnote */}
      <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-fog">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber" />
          {is24h ? "24-Sol Scale" : "12-Sol Scale"}
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-cyan" />
          Minute Sweep
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose" />
          Mars Sec
        </span>
      </div>
    </div>
  );
}
