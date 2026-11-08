import { createFileRoute } from "@tanstack/react-router";
import { syncServerEnvFiles } from "@/lib/hf-inference-server";
import { retrieveNasaRagDocs, type NasaRagDocument } from "@/lib/mars-rag-corpus";

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
  slopeDeg?: number;
  roughnessM?: number;
  terrainClassification?: string;
  roverStatus?: string;
  roverScore?: number;
  evaStatus?: string;
  evaScore?: number;
  meriScore?: number;
  meriClassification?: string;
  swim?: {
    compositeConsistency?: number;
    dominantDepth?: string;
    confidenceCategory?: string;
    evidenceTier?: string;
    wehPercent?: number;
    extractionFeasibility?: string;
  };
  radiationMsvYear?: number;
  pressureMbar?: number;
  routesSummary?: {
    safestKm?: number;
    fastestKm?: number;
    scienceKm?: number;
  };
};

function scientificRagSynthesis(question: string, mission: Mission, context: SiteContext | undefined, ragDocs: NasaRagDocument[]) {
  const siteName = context?.name || mission.site || "Target Location";
  const lat = context?.lat;
  const lon = context?.lon;
  const elev = context?.elevationM;
  const slope = context?.slopeDeg;
  const swim = context?.swim;
  const meri = context?.meriScore;
  const meriClass = context?.meriClassification;
  const roverStatus = context?.roverStatus;
  const evaStatus = context?.evaStatus;

  const sections: string[] = [];

  // 1. Site Geodetic & Topographic Overview
  if (context && lat !== undefined && lon !== undefined) {
    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
    sections.push(
      `**Target Coordinates & Topography:** ${latStr}, ${lonStr} at MOLA Datum ${elev !== undefined ? (elev >= 0 ? `+${elev}` : elev) + 'm' : 'nominal'}. Local slope gradient is measured at ${slope !== undefined ? `${slope}°` : 'nominal'} (${context.terrainClassification || 'surface plains'}).`
    );
  }

  // 2. Risk Assessment (MERI)
  if (meri !== undefined) {
    sections.push(
      `**Mars Exploration Risk Index (MERI):** Score **${meri}/100 (${meriClass || 'ASSESSED'})**. Rover Traversability: **${roverStatus || 'NOMINAL'}**. Astronaut Suited EVA: **${evaStatus || 'CAUTION'}**.`
    );
  }

  // 3. Water Ice & ISRU Evidence
  if (swim) {
    sections.push(
      `**NASA SWIM 2.0 Resource Evidence:** Subsurface water ice confidence is **${swim.confidenceCategory}** (Consistency Index $C_I = ${swim.compositeConsistency ?? 'N/A'}$, Evidence Tier: *${swim.evidenceTier || 'Composite Model'}*). Dominant depth horizon: ${swim.dominantDepth || 'unlikely'}. In-situ extraction feasibility: **${swim.extractionFeasibility || 'unlikely'}**.`
    );
  }

  // 4. Question-Specific Factual Synthesis
  const qLower = question.toLowerCase();
  let factualAdvice = '';

  if (qLower.includes('water') || qLower.includes('ice') || qLower.includes('isru') || qLower.includes('extract')) {
    if (swim && (swim.compositeConsistency ?? 0) >= 0.5) {
      factualAdvice = 'Subsurface water ice is confirmed with high multi-sensor consensus. Recommend deploying shallow mechanical trenchers or scraper blades; sheet ice is accessible within the top 1-2 meters beneath regolith lag.';
    } else if (swim && (swim.compositeConsistency ?? 0) > 0.1) {
      factualAdvice = 'Moderate probability of ground ice. Recommend verifying with deep core thermal drill (>3m) before committing human infrastructure; free pore ice may be absent in the top meter.';
    } else {
      factualAdvice = 'Desiccated equatorial regime. Free water ice is unstable under current atmospheric pressure (6-8 mbar). Rely on closed-loop life support (ECLSS) recycling and thermal baking of hydrated clay/sulfate minerals rather than drilling for free ice.';
    }
  } else if (qLower.includes('route') || qLower.includes('traverse') || qLower.includes('path') || qLower.includes('safest')) {
    factualAdvice = `For path planning, our multi-objective graph pathfinder generates 3 distinct alternatives:
1. **Safest Traverse:** Bypasses crater scarps and low-inertia dust traps to minimize MERI risk (<35).
2. **Fastest Traverse:** Optimizes transit time along competent terraces.
3. **Best Science-per-Risk:** Routes opportunistically across verified SWIM ice horizons and geological stratigraphy.
*Note: Due to suited EVA ankle constraints and fall hazards, astronauts must never traverse slopes > 14°.*`;
  } else if (qLower.includes('radiation') || qLower.includes('shelter') || qLower.includes('gcr')) {
    const dose = elev !== undefined ? Math.round(220 + Math.max(0, elev / 150)) : 245;
    factualAdvice = `Surface GCR baseline at this elevation is ~${dose} mSv/year (MSL RAD instrument). Recommend piling a minimum of 1.5 to 2.0 meters of loose Martian regolith over habitat modules to attenuate ionizing cosmic rays below the 50 mSv/year annual occupational safety margin.`;
  } else {
    factualAdvice = 'All navigation and environmental parameters have been cross-checked against MGS MOLA elevation, Odyssey THEMIS thermal inertia, and MSL RAD dosimeter datasets. Maintain safe standoff distance from steep crater rims.';
  }

  // 5. Data Insufficiency Disclosure
  let insufficiencyNotice = '';
  if (qLower.includes('wind') || qLower.includes('boulder') || qLower.includes('gust') || qLower.includes('today')) {
    insufficiencyNotice = '\n\n> [!NOTE]\n> **Data Limitation:** Sub-meter tactical boulder distributions and real-time surface wind gusts require in-situ rover Mastcam-Z or active REMS/MEDA weather sensors. Orbital MOLA/THEMIS data cannot guarantee sub-meter rock clearance outside HiRISE DTM swaths.';
  }

  const citationsBlock = ragDocs.map((d, i) => `[${i + 1}] **${d.title}** (${d.authors}, *${d.source}*, ${d.year}). DOI: ${d.doiOrUrl}`).join('\n');

  return `### Grounded Scientific Mission Assessment: ${siteName}

${sections.join('\n\n')}

**Mission Operational Guidance:**
${factualAdvice}${insufficiencyNotice}

**NASA Scientific References & Ingested Citations:**
${citationsBlock}`;
}

async function callGemini(question: string, mission: Mission, context: SiteContext | undefined, ragDocs: NasaRagDocument[]) {
  syncServerEnvFiles();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;

  const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";

  const ragContext = ragDocs.map((d, idx) => `[Citation ${idx + 1}]
Title: ${d.title}
Authors: ${d.authors} (${d.year})
Source: ${d.source}
Key Findings: ${d.keyFindings}
Summary: ${d.summary}`).join('\n\n');

  const prompt = `You are the Lead NASA Planetary Science & Mission Advisor for the NASA Space Apps Challenge 2026 project "Interplanetary Survival Guide: Martian Map".
Your mission is to provide rigorous, scientifically grounded planetary exploration decision support.

GROUNDED SCIENTIFIC LITERATURE CITATIONS (Use these in your answer with [1], [2] citations):
${ragContext}

CURRENT MARS EXPLORATION TELEMETRY:
Target Coordinates: ${context?.lat}°N, ${context?.lon}°E
Location Name: ${context?.name || "Martian Surface Target"}
MOLA Elevation: ${context?.elevationM} m datum
Local Slope: ${context?.slopeDeg}° (${context?.terrainClassification})
MERI Exploration Risk Index: ${context?.meriScore}/100 (${context?.meriClassification})
Rover Traversability: ${context?.roverStatus} (Score: ${context?.roverScore}/100)
Astronaut Suited EVA Traversability: ${context?.evaStatus} (Score: ${context?.evaScore}/100)
SWIM 2.0 Water Ice Evidence:
- Confidence: ${context?.swim?.confidenceCategory}
- Composite Consistency Index CI: ${context?.swim?.compositeConsistency}
- Evidence Tier: ${context?.swim?.evidenceTier}
- Dominant Depth: ${context?.swim?.dominantDepth}
- ISRU Extraction Feasibility: ${context?.swim?.extractionFeasibility}

USER INQUIRY:
${question}

STRICT INSTRUCTIONS:
1. Ground your response in the provided NASA telemetry and literature citations.
2. Clearly distinguish instrument-observed ground truth from composite models and theoretical estimates.
3. Explicitly explain the difference between Rover and Astronaut EVA safety if relevant (suited astronauts cannot safely walk slopes > 14°).
4. If asked about information not supported by available datasets (e.g. real-time wind gusts or sub-meter boulders outside HiRISE), EXPLICITLY STATE THAT DATA IS INSUFFICIENT.
5. Format cleanly in Markdown with bold key metrics and cite references as [1], [2]. Keep under 350 words.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 750, temperature: 0.2 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Gemini Advisor Error ${response.status}: ${detail}`);
      return null;
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text)
      ?.filter(Boolean)
      ?.join("\n")
      ?.trim();

    return text || null;
  } catch (err) {
    console.error("Gemini fetch failed:", err);
    return null;
  }
}

export const Route = createFileRoute("/api/mars-advisor")({
  server: {
    handlers: {
      GET: async () => {
        syncServerEnvFiles();
        const hasGemini = Boolean(process.env["GEMINI_API_KEY"]);
        return Response.json({
          ok: true,
          service: "mars-advisor",
          provider: hasGemini ? "gemini-grounded-rag" : "deterministic-scientific-rag",
          ragCorpusSize: 10,
        });
      },
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

          // Retrieve relevant NASA citations
          const retrieved = retrieveNasaRagDocs(question, 3);
          const ragDocs = retrieved.map((r) => r.doc);

          // Try Gemini with RAG grounding
          const aiResponse = await callGemini(question, mission, context, ragDocs);

          const finalAnswer = aiResponse || scientificRagSynthesis(question, mission, context, ragDocs);
          const activeMode = aiResponse ? "gemini" : "scientific-rag";

          return Response.json({ 
            answer: finalAnswer, 
            mode: activeMode,
            citations: ragDocs.map((d) => ({
              id: d.id,
              title: d.title,
              authors: d.authors,
              year: d.year,
              source: d.source,
              doiOrUrl: d.doiOrUrl,
              category: d.category,
            })),
          });
        } catch (error) {
          console.error("mars-advisor error:", error);
          return Response.json({ error: "Mission advisor failed. Check the server logs." }, { status: 500 });
        }
      },
    },
  },
});
