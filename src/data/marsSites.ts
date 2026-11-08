/**
 * NASA Mars Exploration Sites & Ground Truth Profiles
 * 
 * Extracted into a standalone data module to avoid eager preloading of 3D GLB regional meshes
 * on the home page and throughout lightweight viewports.
 */

export interface MarsSite {
  id: string;
  name: string;
  region: string;
  coordinates: string;
  latitude: number;
  longitude: number;
  terrain: string;
  significance: string;
  hazard: string;
  resources: string;
  score: number;
  elevation: string;
  slope: string;
  radiation: string;
  temperature: string;
  waterIce: "Very high" | "High" | "Moderate" | "Low" | "Low (Hydrated Clays Only)";
  rover: string;
  scienceTargets: number;
}

export const defaultMarsSite: MarsSite = {
  id: "jezero",
  name: "Jezero Crater",
  region: "Isidis Planitia / Syrtis Major",
  coordinates: "18.4°N, 77.5°E",
  latitude: 18.4447,
  longitude: 77.4508,
  terrain: "Ancient crater lake and river delta with layered sedimentary rock.",
  significance: "NASA Mars 2020 Perseverance rover site; ancient habitable river delta.",
  hazard: "Broken delta scarps, wheel-slip eolian sand, and elevated surface radiation.",
  resources: "Hydrated smectite clays, carbonate minerals, and ancient organic preservation.",
  score: 84,
  elevation: "−2,560 m",
  slope: "3.2°",
  radiation: "0.67 mSv/day",
  temperature: "−63°C",
  waterIce: "Low (Hydrated Clays Only)",
  rover: "Perseverance",
  scienceTargets: 8,
};

export const marsSites: MarsSite[] = [
  defaultMarsSite,
  {
    id: "olympus",
    name: "Olympus Mons",
    region: "Tharsis Montes",
    coordinates: "18.7°N, 226.2°E",
    latitude: 18.7,
    longitude: 226.2,
    terrain: "Shield volcano rising 21.2 km above the Martian datum.",
    significance: "The largest shield volcano in the Solar System.",
    hazard: "Extreme altitude, steep escarpments, and exceptionally thin atmosphere (<1 mbar).",
    resources: "Basaltic rock for construction and potential lava-tube microclimates.",
    score: 48,
    elevation: "+21,229 m",
    slope: "8.6°",
    radiation: "0.85 mSv/day",
    temperature: "−70°C",
    waterIce: "Low",
    rover: "Orbital survey",
    scienceTargets: 4,
  },
  {
    id: "valles",
    name: "Valles Marineris",
    region: "Equatorial canyon system",
    coordinates: "14.0°S, 290.0°E",
    latitude: -14.0,
    longitude: 290.0,
    terrain: "A canyon network over 4,000 km long and up to 7 km deep.",
    significance: "Exposes deep stratigraphic record of Martian crust and hydrated sulfates.",
    hazard: "Cliffs, landslides, deep shadow, and UHF relay communication horizon masking.",
    resources: "Exposed mineral layers and natural canyon radiation shielding.",
    score: 58,
    elevation: "−4,100 m",
    slope: "11.4°",
    radiation: "0.61 mSv/day",
    temperature: "−58°C",
    waterIce: "Moderate",
    rover: "Orbital relay",
    scienceTargets: 11,
  },
  {
    id: "gale",
    name: "Gale Crater",
    region: "Aeolis quadrangle",
    coordinates: "5.4°S, 137.8°E",
    latitude: -5.38,
    longitude: 137.44,
    terrain: "Impact basin containing the 5.5 km-high layered Mount Sharp (Aeolis Mons).",
    significance: "Curiosity rover discovered evidence of a persistent ancient lacustrine lake.",
    hazard: "Rocky slopes, wheel-tread wear, and equatorial desiccation.",
    resources: "Clay minerals, sulfates, and well-studied sedimentary record.",
    score: 67,
    elevation: "−4,500 m",
    slope: "4.8°",
    radiation: "0.67 mSv/day",
    temperature: "−59°C",
    waterIce: "Low",
    rover: "Curiosity",
    scienceTargets: 9,
  },
  {
    id: "utopia",
    name: "Utopia Planitia",
    region: "Northern lowlands",
    coordinates: "46.7°N, 117.5°E",
    latitude: 46.7,
    longitude: 117.5,
    terrain: "Broad impact basin covered by scalloped depressions and polygonal ground.",
    significance: "Radar and geomorphology indicate extensive buried water ice deposits.",
    hazard: "Seasonal frost, severe cold-soak, and dust storm vulnerability.",
    resources: "Abundant subsurface water ice within 1-2m and low-slope terrain.",
    score: 88,
    elevation: "−4,500 m",
    slope: "1.7°",
    radiation: "0.59 mSv/day",
    temperature: "−69°C",
    waterIce: "Very high",
    rover: "Zhurong / Relay beacon",
    scienceTargets: 6,
  },
  {
    id: "arcadia",
    name: "Arcadia Planitia",
    region: "Northern mid-latitudes",
    coordinates: "39.2°N, 189.7°E",
    latitude: 39.2,
    longitude: 189.7,
    terrain: "Smooth volcanic plains underlain by massive sheet ice.",
    significance: "Prime candidate for NASA Human Landing Site due to shallow accessible ice.",
    hazard: "Winter thermal drop and moderate radiation.",
    resources: "Pure sheet water ice accessible within 1-2 meters of surface.",
    score: 92,
    elevation: "−3,800 m",
    slope: "1.2°",
    radiation: "0.62 mSv/day",
    temperature: "−65°C",
    waterIce: "Very high",
    rover: "Human landing target",
    scienceTargets: 7,
  },
];
