import { createFileRoute } from "@tanstack/react-router";

type Mission = {
  site?: string;
  crew?: number;
  habitat?: string;
  seed?: number;
  solarEventSource?: string;
  result?: {
    survived?: boolean;
    score?: number;
    runSols?: number;
    doseMsv?: number;
    maxDustOpticalDepth?: number;
    solarParticleEvents?: number;
    lowPowerSols?: number;
    oxygenRemainingKg?: number;
    waterRemainingL?: number;
    cause?: string | null;
  };
};

type SiteContext = {
  lat?: number;
  lon?: number;
  name?: string;
  elevationM?: number;
  swim?: {
    compositeConsistency?: number;
    dominantDepth?: string;
    confidenceCategory?: string;
    wehPercent?: number;
    extractionFeasibility?: string;
  };
  radiationMsvYear?: number;
  pressureMbar?: number;
};

function fallbackAnswer(question: string, mission: Mission, context?: SiteContext) {
  const result = mission.result;
  const siteName = context?.name || mission.site || "Survey Location";
  const lat = context?.lat;
  const lon = context?.lon;
  const elev = context?.elevationM;
  const swim = context?.swim;

  const points: string[] = [];

  if (context && lat !== undefined && lon !== undefined) {
    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
    points.push(`Geographic Coordinates: ${latStr}, ${lonStr} at MOLA Datum ${elev !== undefined ? (elev >= 0 ? `+${elev}` : elev) + 'm' : 'nominal'}.`);
  }

  if (swim) {
    points.push(
      `NASA SWIM 2.0 Assessment: Subsurface ice confidence is "${swim.confidenceCategory}" (Consistency index CI = ${swim.compositeConsistency ?? 'N/A'}). Dominant depth horizon: ${swim.dominantDepth || 'none'}. ISRU extraction feasibility: ${swim.extractionFeasibility || 'unlikely'}.`
    );
  }

  if (elev !== undefined) {
    const pressure = Number((6.1 * Math.exp(-elev / 11100)).toFixed(1));
    const rad = Math.round(220 + Math.max(0, elev / 150));
    points.push(
      `Atmospheric & Radiation Shielding: Surface pressure is ~${pressure} mbar. Thinner atmosphere at this elevation results in an estimated GCR background of ~${rad} mSv/year (MSL RAD instrument baseline).`
    );
  }

  const risk: string[] = [];
  if ((result?.doseMsv ?? 0) > 300) risk.push("radiation exposure exceeds safe 300 mSv career limit");
  if ((result?.maxDustOpticalDepth ?? 0) > 3) risk.push("dust optical depth exceeds tau=3, critically choking solar arrays");
  if ((result?.lowPowerSols ?? 0) > 20) risk.push("power storage spent excessive sols below life-support baseline");
  if ((result?.waterRemainingL ?? 99999) < 100) risk.push("water reserves depleted below safety margin");
  if ((result?.oxygenRemainingKg ?? 99999) < 25) risk.push("metabolic O2 reserves critical");

  const simulationSummary = result
    ? `Simulation Outcome: ${result.survived ? "SURVIVED" : "MISSION FAILED"}, Score: ${result.score ?? "—"}/100 after ${result.runSols ?? "—"} sols.`
    : "Simulation Context: Standalone planetary assessment mode.";

  const adviceLead = points.length > 0 ? points.join("\n\n") : "Standard NASA planetary science heuristics applied.";

  return `### AI Mission Advisor Assessment: ${siteName}

${adviceLead}

**${simulationSummary}**
${risk.length > 0 ? `Identified Critical Risks: ${risk.join("; ")}.` : "All operational parameters within nominal thresholds."}

**Mission Recommendations:**
1. **Water ISRU:** ${swim && (swim.compositeConsistency ?? 0) > 0.3 ? "Deploy shallow trenching excavators; high confidence of extractable ice in top 2 meters." : "Rely primarily on closed-loop life-support recycling (ECLSS) and deep thermal distillation of hydrated minerals."}
2. **Radiation Mitigation:** Utilize local regolith shielding (minimum 1.5 meters thickness) over the crew habitat to attenuate galactic cosmic rays.
3. **Power Reliability:** If operating in dusty equatorial corridors, deploy electrostatic dust removal systems or nuclear fission surface power (Kilopower class) to decouple life support from seasonal dust storms.

*References: NASA Mars Trek WMTS, PSI SWIM 2.0 (Putzig et al.), MGS MOLA MEGDR, MSL RAD.*`;
}

async function callGemini(question: string, mission: Mission, context?: SiteContext) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;

  const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash-lite";
  const prompt = `You are the Senior Planetary Science & Mission Advisor for the NASA Space Apps Challenge 2026 project "Interplanetary Survival Guide: Martian Map".
You have access to real NASA data products including Mars Trek WMTS, PSI SWIM 2.0 subsurface water ice consistency maps, MOLA laser altimetry, and MSL Curiosity RAD dosimeter data.

Site Context:
${JSON.stringify(context, null, 2)}

Mission Simulator Context:
${JSON.stringify(mission, null, 2)}

User Question:
${question}

Instructions:
- Provide clear, professional, scientifically rigorous guidance.
- Distinguish verified NASA remote sensing data from simulated parameters.
- Provide actionable recommendations for ISRU water extraction, radiation protection, and rover traverse safety.
- Keep the response structured, engaging, and under 400 words.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Gemini Error ${response.status}: ${detail}`);
    return null;
  }

  const data = (await response.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  return text || null;
}

export const Route = createFileRoute("/api/mars-advisor")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          service: "mars-advisor",
          provider: process.env["GEMINI_API_KEY"] ? "gemini" : "local-fallback",
        }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { 
            question?: string; 
            mission?: Mission;
            context?: SiteContext;
          };
          const question = typeof body.question === "string" ? body.question.trim() : "";
          if (!question) return Response.json({ error: "question is required" }, { status: 400 });
          const mission = body.mission ?? {};
          const context = body.context;
          const ai = await callGemini(question, mission, context);
          return Response.json({ 
            answer: ai ?? fallbackAnswer(question, mission, context), 
            mode: ai ? "gemini" : "fallback" 
          });
        } catch (error) {
          console.error(error);
          return Response.json({ error: "Mission advisor failed. Check the server logs." }, { status: 500 });
        }
      },
    },
  },
});
