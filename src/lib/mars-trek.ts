/**
 * NASA Mars Trek WMTS Layer Catalog & Planetary Scientific Datasets
 * 
 * Sources:
 * - NASA Mars Trek API: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
 * - NASA Solar System Treks Project (SSTP) / Jet Propulsion Laboratory (JPL)
 * - NASA Planetary Data System (PDS) Geosciences & Cartography Nodes
 * - Projection: Equirectangular IAU2000:104905 / EPSG:4326
 */

export type LayerGroupType = 'terrain' | 'hazards' | 'resources' | 'geology' | 'mission_data';
export type ScientificDataTier = 'measured_observation' | 'derived_analysis' | 'simulated_estimate';

export interface ScientificLegendItem {
  color: string;
  label: string;
  value?: string;
}

export interface MarsScientificLayer {
  id: string;
  title: string;
  shortTitle: string;
  group: LayerGroupType;
  tier: ScientificDataTier;
  wmtsLayerId?: string;
  tileUrlTemplate?: string;
  instrument: string;
  spacecraft: string;
  resolution: string;
  acquisitionDate: string;
  spatialCoverage: string;
  description: string;
  limitations: string;
  confidence: 'Confirmed Ground-Truth' | 'High Orbital Consensus' | 'Scientific Prospecting Model' | 'Theoretical Estimate' | 'Derived Analysis';
  credit: string;
  officialDocUrl: string;
  minZoom: number;
  maxZoom: number;
  bounds?: [[number, number], [number, number]]; // [[south, west], [north, east]]
  defaultVisible: boolean;
  defaultOpacity: number;
  format?: 'jpg' | 'png';
  isVectorOverlay?: boolean;
  legend?: {
    type: 'gradient' | 'classes' | 'discrete';
    title: string;
    unit?: string;
    items?: ScientificLegendItem[];
    gradientStops?: { percent: number; color: string; label: string }[];
  };
}

export const MARS_SCIENTIFIC_LAYERS: MarsScientificLayer[] = [
  // ==========================================
  // GROUP 1: TERRAIN
  // ==========================================
  {
    id: 'viking-color-mosaic',
    title: 'Viking MDIM 2.1 Global Color Mosaic',
    shortTitle: 'Global Mars Mosaic',
    group: 'terrain',
    tier: 'measured_observation',
    wmtsLayerId: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'Visual Imaging Subsystem (VIS)',
    spacecraft: 'Viking Orbiters 1 & 2',
    resolution: '232 m/pixel (256 pixels/deg)',
    acquisitionDate: '1976 – 1980',
    spatialCoverage: 'Global (90°S to 90°N, 180°W to 180°E)',
    description: 'Radiometrically balanced, orthorectified true-color global mosaic assembled from thousands of Viking frames. Shows natural Martian albedo, polar ice caps, and regional dust mantles.',
    limitations: 'Variable atmospheric haze during acquisition; lower dynamic range than modern pushbroom sensors.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / USGS Astrogeology Science Center / Viking Project',
    officialDocUrl: 'https://astrogeology.usgs.gov/search/map/Mars/Viking/MDIM21_Color',
    minZoom: 0,
    maxZoom: 7,
    defaultVisible: true,
    defaultOpacity: 1.0,
    format: 'jpg',
  },
  {
    id: 'mola-color-elevation',
    title: 'MGS MOLA Global Topography (Datum Elevation)',
    shortTitle: 'MOLA Elevation',
    group: 'terrain',
    tier: 'measured_observation',
    wmtsLayerId: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'Mars Orbiter Laser Altimeter (MOLA)',
    spacecraft: 'Mars Global Surveyor (MGS)',
    resolution: '463 m/pixel (128 pixels/deg)',
    acquisitionDate: '1997 – 2001 (600M+ laser pulses)',
    spatialCoverage: 'Global (90°S to 90°N)',
    description: 'Global digital elevation model referenced to the Mars aeroid datum (0 km level). Range spans -8.2 km (Hellas Basin floor) to +21.2 km (Olympus Mons summit).',
    limitations: 'Interpolated between ground tracks; along-track vertical accuracy is ~1 meter, cross-track spacing varies with latitude.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / GSFC / MOLA Science Team / PDS Geosciences',
    officialDocUrl: 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/',
    minZoom: 0,
    maxZoom: 7,
    defaultVisible: false,
    defaultOpacity: 0.85,
    format: 'jpg',
    legend: {
      type: 'gradient',
      title: 'MOLA Aeroid Elevation',
      unit: 'km',
      gradientStops: [
        { percent: 0, color: '#2b0050', label: '< -6 km (Hellas Deep)' },
        { percent: 25, color: '#0055aa', label: '-4 km (Northern Plains)' },
        { percent: 50, color: '#00aa55', label: '0 km (Aeroid Datum)' },
        { percent: 75, color: '#ffcc00', label: '+4 km (Southern Highlands)' },
        { percent: 90, color: '#cc3300', label: '+10 km (Tharsis Rise)' },
        { percent: 100, color: '#ffffff', label: '> +21 km (Olympus Mons)' },
      ],
    },
  },
  {
    id: 'mola-hrsc-blend',
    title: 'MOLA + MEX HRSC Shaded Relief Blend',
    shortTitle: 'Hillshade / Relief',
    group: 'terrain',
    tier: 'derived_analysis',
    wmtsLayerId: 'Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'MOLA & High Resolution Stereo Camera (HRSC)',
    spacecraft: 'MGS (NASA) & Mars Express (ESA)',
    resolution: '200 m/pixel',
    acquisitionDate: '2001 – 2018',
    spatialCoverage: 'Near-global equatorial and mid-latitudes',
    description: 'High-contrast monochrome hillshade blend combining global MOLA altimetry with HRSC multi-angle stereo topography, highlighting tectonic scarps, fault systems, and impact rims.',
    limitations: 'Illumination direction creates visual relief inversion in certain craters; sun angle is simulated at azimuth 315°.',
    confidence: 'High Orbital Consensus',
    credit: 'NASA / ESA / DLR / Freie Universität Berlin',
    officialDocUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars',
    minZoom: 0,
    maxZoom: 8,
    defaultVisible: false,
    defaultOpacity: 0.7,
    format: 'jpg',
  },
  {
    id: 'mola-slope-map',
    title: 'MOLA Baseline Slope & Traverse Gradient',
    shortTitle: 'Slope Map',
    group: 'terrain',
    tier: 'derived_analysis',
    wmtsLayerId: 'mola_roughness',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/mola_roughness/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'MOLA Laser Altimeter',
    spacecraft: 'Mars Global Surveyor',
    resolution: '463 m/pixel',
    acquisitionDate: '1999 – 2001',
    spatialCoverage: 'Global',
    description: 'Surface slope gradient calculated from adjacent MOLA elevation pixels over a 1-km baseline. Identifies steep canyon walls, volcanic caldera escarpments, and gentle landing plains.',
    limitations: 'Cannot detect sub-meter boulders or small meter-scale crevasses smaller than laser footprint (~168m).',
    confidence: 'Derived Analysis',
    credit: 'NASA / GSFC / MIT',
    officialDocUrl: 'https://pds-geosciences.wustl.edu/mgs/',
    minZoom: 0,
    maxZoom: 6,
    defaultVisible: false,
    defaultOpacity: 0.8,
    format: 'jpg',
    legend: {
      type: 'classes',
      title: 'Slope Classification',
      items: [
        { color: '#22c55e', label: 'Safe Traverse (< 5° Slope)' },
        { color: '#eab308', label: 'Moderate Incline (5° – 12° Slope)' },
        { color: '#ef4444', label: 'Severe Rollover Hazard (> 12° Slope)' },
      ],
    },
  },
  {
    id: 'ctx-gale-crater',
    title: 'MRO CTX Gale Crater Controlled Mosaic (6m)',
    shortTitle: 'CTX Gale Mosaic (6m)',
    group: 'terrain',
    tier: 'measured_observation',
    wmtsLayerId: 'MSL_Gale_Crater_CTX_mosaic_Eqc_6m',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/MSL_Gale_Crater_CTX_mosaic_Eqc_6m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'Context Camera (CTX)',
    spacecraft: 'Mars Reconnaissance Orbiter (MRO)',
    resolution: '6 m/pixel',
    acquisitionDate: '2006 – 2020',
    spatialCoverage: 'Gale Crater (4°S to 6°S, 136°E to 139°E)',
    description: 'Sub-decameter controlled Context Camera mosaic covering the entire Curiosity rover traverse, Mount Sharp sulfate beds, and Peace Vallis alluvial fan.',
    limitations: 'Regional mosaic covering Gale Crater area only.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / JPL-Caltech / MSSS',
    officialDocUrl: 'https://www.msss.com/all_projects/mro-ctx.php',
    minZoom: 4,
    maxZoom: 12,
    bounds: [[-6.0, 136.0], [-3.5, 139.0]],
    defaultVisible: false,
    defaultOpacity: 1.0,
    format: 'jpg',
  },
  {
    id: 'hirise-jezero',
    title: 'MRO HiRISE Jezero Crater Orthomosaic (25cm)',
    shortTitle: 'HiRISE Jezero (25cm)',
    group: 'terrain',
    tier: 'measured_observation',
    wmtsLayerId: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'High Resolution Imaging Science Experiment (HiRISE)',
    spacecraft: 'Mars Reconnaissance Orbiter (MRO)',
    resolution: '0.25 m/pixel (25 cm/pixel)',
    acquisitionDate: '2020 – 2024',
    spatialCoverage: 'Jezero Crater Delta (17.5°N to 19.5°N, 76.5°E to 78.5°E)',
    description: 'Ultra-high-resolution controlled orthophoto map of Jezero Crater. Resolves individual rover tracks, boulder fields, delta layering, and ancient lakebed sediments.',
    limitations: 'Targeted high-resolution footprint; spatial coverage is limited to Jezero exploration ellipse.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / JPL-Caltech / University of Arizona',
    officialDocUrl: 'https://www.uahirise.org/jezero/',
    minZoom: 5,
    maxZoom: 14,
    bounds: [[17.5, 76.5], [19.5, 78.5]],
    defaultVisible: false,
    defaultOpacity: 1.0,
    format: 'jpg',
  },

  // ==========================================
  // GROUP 2: SCIENTIFIC HAZARDS
  // ==========================================
  {
    id: 'hazard-slope-roughness',
    title: 'MOLA Slope & Surface Roughness Hazard Index',
    shortTitle: 'Steep Slope Analysis',
    group: 'hazards',
    tier: 'derived_analysis',
    wmtsLayerId: 'mola_roughness',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/mola_roughness/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'MOLA Pulse-Spread & Altimetry',
    spacecraft: 'Mars Global Surveyor',
    resolution: '463 m/pixel',
    acquisitionDate: '1999 – 2001',
    spatialCoverage: 'Global (90°S to 90°N)',
    description: 'Root-mean-square (RMS) baseline slope roughness. Quantitative model highlights escarpments, canyon drop-offs, and treacherous volcanic terrain with rollover risk.',
    limitations: 'Regional baseline analysis; sub-footprint obstacles (< 100m) require localized high-res stereo DEM validation.',
    confidence: 'Derived Analysis',
    credit: 'NASA / GSFC / PDS Geosciences',
    officialDocUrl: 'https://pds-geosciences.wustl.edu/mgs/',
    minZoom: 0,
    maxZoom: 6,
    defaultVisible: false,
    defaultOpacity: 0.75,
    format: 'jpg',
    legend: {
      type: 'classes',
      title: 'Traverse Rollover Risk',
      items: [
        { color: '#22c55e', label: 'Nominal Terrain (< 3° RMS)' },
        { color: '#eab308', label: 'Moderate Wheel Slip (3° – 8° RMS)' },
        { color: '#ef4444', label: 'Critical Hazard (> 8° RMS / Escarpment)' },
      ],
    },
  },
  {
    id: 'hazard-themis-night-ir',
    title: 'Mars Odyssey THEMIS Nighttime IR (Thermal Inertia)',
    shortTitle: 'Historical Thermal IR',
    group: 'hazards',
    tier: 'measured_observation',
    wmtsLayerId: 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    instrument: 'Thermal Emission Imaging System (THEMIS)',
    spacecraft: '2001 Mars Odyssey',
    resolution: '100 m/pixel',
    acquisitionDate: '2002 – 2018 (Controlled Night Mosaic)',
    spatialCoverage: 'Global (85°S to 85°N)',
    description: 'Controlled nighttime infrared brightness temperature. At night, fine aeolian dust cools rapidly (appears dark), while high thermal inertia rocks retain heat and radiate brightly, revealing boulder fields and exposed bedrock.',
    limitations: 'Historical observational composite; represents pre-dawn radiative equilibrium, not live instantaneous surface temperature.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / JPL / Arizona State University (ASU)',
    officialDocUrl: 'https://themis.asu.edu/',
    minZoom: 0,
    maxZoom: 8,
    defaultVisible: false,
    defaultOpacity: 0.8,
    format: 'jpg',
    legend: {
      type: 'classes',
      title: 'Night Thermal Radiance (100m)',
      items: [
        { color: '#ffffff', label: 'High Thermal Inertia: Exposed Bedrock / Boulder Fields' },
        { color: '#888888', label: 'Medium Thermal Inertia: Pebbled Regolith' },
        { color: '#1a1a1a', label: 'Low Thermal Inertia: Fine Unconsolidated Dust' },
      ],
    },
  },
  {
    id: 'hazard-radiation-environment',
    title: 'Historical Radiation Observations (MARIE & MSL RAD)',
    shortTitle: 'Radiation Baseline',
    group: 'hazards',
    tier: 'measured_observation',
    instrument: 'MARIE (Orbital) & MSL RAD (Surface)',
    spacecraft: 'Mars Odyssey (2002–2003) & Curiosity (2012–present)',
    resolution: 'Global Atmospheric Model + Surface In-Situ Point',
    acquisitionDate: '2002 – 2003 (MARIE) & 2012 – Present (MSL RAD)',
    spatialCoverage: 'Orbital survey + Gale Crater surface calibration',
    description: 'Synthesizes Mars Odyssey MARIE orbital energetic particle data (2002–2003) and MSL Curiosity RAD surface dosimeter measurements (0.67 mSv/day quiet GCR baseline). Elevation-shielded model demonstrates higher cosmic ray doses at Tharsis (+10 to +21 km) versus deep basins (Hellas, -7.2 km).',
    limitations: 'Historical baseline measurements; space weather varies with the 11-year solar cycle. Solar Particle Events (SPEs) can temporarily spike doses by orders of magnitude.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / Johnson Space Center (JSC) / Southwest Research Institute (SwRI)',
    officialDocUrl: 'https://pds-geosciences.wustl.edu/missions/msl/rad.htm',
    minZoom: 0,
    maxZoom: 7,
    defaultVisible: false,
    defaultOpacity: 0.7,
    isVectorOverlay: true,
    legend: {
      type: 'classes',
      title: 'Galactic Cosmic Ray (GCR) Annual Dose',
      items: [
        { color: '#3b82f6', label: '< 200 mSv/yr: High Atmospheric Column (Hellas Basin, -7 km)' },
        { color: '#eab308', label: '200 – 260 mSv/yr: Nominal Plains (Datum 0 km, MSL Gale)' },
        { color: '#ef4444', label: '> 300 mSv/yr: Thin Atmosphere / Peak Altitude (Tharsis Rise)' },
      ],
    },
  },
  {
    id: 'hazard-dust-opacity',
    title: 'MGS TES / MRO MCS Historical Dust Opacity Model (τ)',
    shortTitle: 'Dust & Atmosphere',
    group: 'hazards',
    tier: 'derived_analysis',
    instrument: 'Thermal Emission Spectrometer (TES) & Mars Climate Sounder (MCS)',
    spacecraft: 'MGS & MRO',
    resolution: 'Global Lat/Lon Grid (3° resolution)',
    acquisitionDate: '1999 – 2022 Archive',
    spatialCoverage: 'Global seasonal compilation',
    description: 'Historical atmospheric dust optical depth (tau at 9 μm). Tracks regional dust lifting corridors and historical planet-encircling global dust storm events (2001A, 2007, 2018) that occur predominantly during southern spring/summer (Ls = 180°–270°).',
    limitations: 'Historical seasonal climatology; cannot predict individual unmodeled day-to-day dust devil or local storm occurrences.',
    confidence: 'Derived Analysis',
    credit: 'NASA / JPL / Arizona State University',
    officialDocUrl: 'https://pds-atmospheres.nmsu.edu/',
    minZoom: 0,
    maxZoom: 6,
    defaultVisible: false,
    defaultOpacity: 0.7,
    isVectorOverlay: true,
  },

  // ==========================================
  // GROUP 3: SCIENTIFIC RESOURCES
  // ==========================================
  {
    id: 'resource-swim-ice',
    title: 'NASA SWIM 2.0 Subsurface Water Ice Composite',
    shortTitle: 'SWIM Water Ice (PSI)',
    group: 'resources',
    tier: 'derived_analysis',
    instrument: 'MRO SHARAD, Odyssey HEND/MONS, THEMIS/TES',
    spacecraft: 'Mars Reconnaissance Orbiter & Mars Odyssey',
    resolution: '1 km to 5 km grid (multi-dataset composite)',
    acquisitionDate: 'Putzig et al. (2020, 2023 Update)',
    spatialCoverage: 'Northern & Southern Mid-to-High Latitudes (>30°N / >30°S)',
    description: 'Subsurface Water Ice Mapping (SWIM 2.0) composite consistency maps integrating radar sounding (SHARAD), neutron hydrogen (HEND), and thermal inertia. Highlights shallow sheet ice in Arcadia Planitia and debris-covered glaciers in Deuteronilus Mensae.',
    limitations: 'SWIM indicates scientific consistency score (CI from -1.0 to +1.0) and regional prospecting potential, NOT a guarantee of pure extractable ice at any specific pixel.',
    confidence: 'Scientific Prospecting Model',
    credit: 'NASA / JPL / Planetary Science Institute (PSI)',
    officialDocUrl: 'https://swim.psi.edu/',
    minZoom: 0,
    maxZoom: 7,
    defaultVisible: true,
    defaultOpacity: 0.85,
    isVectorOverlay: true,
    legend: {
      type: 'classes',
      title: 'SWIM 2.0 Ice Consistency (CI)',
      items: [
        { color: '#00f0ff', label: '0–1m Depth: High Confidence Shallow Ground Ice (CI > +0.7)' },
        { color: '#2563eb', label: '1–5m Depth: Mid-Depth Glacial Regolith (CI +0.3 to +0.7)' },
        { color: '#9333ea', label: '>5m Depth: Massive Debris-Covered Glaciers (SHARAD Bedrock)' },
      ],
    },
  },
  {
    id: 'resource-crism-minerals',
    title: 'MRO CRISM Hydrated Minerals & Phyllosilicates',
    shortTitle: 'CRISM Hydrated Minerals',
    group: 'resources',
    tier: 'measured_observation',
    instrument: 'Compact Reconnaissance Imaging Spectrometer for Mars (CRISM)',
    spacecraft: 'Mars Reconnaissance Orbiter',
    resolution: '18 m to 200 m/pixel',
    acquisitionDate: '2006 – 2023',
    spatialCoverage: 'Targeted observations in Mawrth, Nili Fossae, Oxia Planum, Jezero',
    description: 'Shortwave infrared (1.0–3.9 μm) spectral detections of water-altered clay minerals (smectites, nontronite), hydrated sulfates (gypsum, kieserite), and carbonates that preserve ancient aqueous history and structural water.',
    limitations: 'Identifies mineral crystal lattice bounds; extracting structural water requires high-temperature thermal calcination (200°C–400°C).',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / JHU-APL / CRISM Science Team',
    officialDocUrl: 'https://crism.jhuapl.edu/',
    minZoom: 0,
    maxZoom: 8,
    defaultVisible: false,
    defaultOpacity: 0.8,
    isVectorOverlay: true,
  },
  {
    id: 'resource-solar-insolation',
    title: 'Mars Astronomical Solar Energy Potential',
    shortTitle: 'Solar Energy Potential',
    group: 'resources',
    tier: 'derived_analysis',
    instrument: 'Planetary Ephemeris & Atmospheric Radiation Model',
    spacecraft: 'JPL Solar System Dynamics',
    resolution: 'Continuous Geometric Model',
    acquisitionDate: 'Valid for Current Solar Longitude (Ls)',
    spatialCoverage: 'Global (-90° to +90° Latitude)',
    description: 'Calculates top-of-atmosphere and surface diurnal average solar insolation (W/m²) based on Mars orbital distance (1.381 to 1.666 AU), subsolar latitude, and baseline atmospheric attenuation. Crucial for surface photovoltaic array sizing.',
    limitations: 'Calculates clear-sky geometric insolation; local dust storms can reduce surface insolation by > 90%.',
    confidence: 'Derived Analysis',
    credit: 'NASA / JPL Solar System Dynamics',
    officialDocUrl: 'https://ssd.jpl.nasa.gov/',
    minZoom: 0,
    maxZoom: 6,
    defaultVisible: false,
    defaultOpacity: 0.7,
    isVectorOverlay: true,
  },

  // ==========================================
  // GROUP 4: GEOLOGY
  // ==========================================
  {
    id: 'geology-landmarks',
    title: 'Major Martian Geological Formations & Calderas',
    shortTitle: 'Volcanoes & Canyons',
    group: 'geology',
    tier: 'measured_observation',
    instrument: 'USGS Astrogeology Planetary Nomenclature',
    spacecraft: 'IAU Working Group for Planetary System Nomenclature',
    resolution: 'Geographic Vector Database',
    acquisitionDate: 'IAU Gazetter of Planetary Nomenclature',
    spatialCoverage: 'Global',
    description: 'Official IAU nomenclature boundaries and summit coordinates for Olympus Mons (21.9 km), Tharsis Montes, Valles Marineris canyon chasmata, and giant impact basins (Hellas, Argyre, Isidis).',
    limitations: 'Nomenclature database; boundaries represent generalized geological limits.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'USGS / IAU Planetary Nomenclature Working Group',
    officialDocUrl: 'https://planetarynames.wr.usgs.gov/',
    minZoom: 0,
    maxZoom: 10,
    defaultVisible: true,
    defaultOpacity: 1.0,
    isVectorOverlay: true,
  },

  // ==========================================
  // GROUP 5: MISSION DATA
  // ==========================================
  {
    id: 'mission-landing-sites',
    title: 'NASA & International Mars Mission Landing Sites',
    shortTitle: 'Landed Missions & Sites',
    group: 'mission_data',
    tier: 'measured_observation',
    instrument: 'EDL Telemetry & Orbital Imaging Verification',
    spacecraft: 'NASA, ESA, CNSA Landers and Rovers',
    resolution: 'Meter-accurate surface coordinates',
    acquisitionDate: '1976 – Present',
    spatialCoverage: 'Global surface exploration locations',
    description: 'Exact surface landing locations for Viking 1 & 2, Pathfinder/Sojourner, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance, Zhurong, and future ExoMars 2028 site.',
    limitations: 'Historical landing sites; active operational science currently conducted only by Perseverance and Curiosity.',
    confidence: 'Confirmed Ground-Truth',
    credit: 'NASA / JPL-Caltech / ESA / CNSA',
    officialDocUrl: 'https://mars.nasa.gov/',
    minZoom: 0,
    maxZoom: 14,
    defaultVisible: true,
    defaultOpacity: 1.0,
    isVectorOverlay: true,
  },
];

export const MARS_TREK_LAYERS = MARS_SCIENTIFIC_LAYERS;
export type MarsTrekLayer = MarsScientificLayer;


/**
 * Real Martian Region Profiles for Rapid Regional Navigation
 */
export interface MarsRegionProfile {
  id: string;
  name: string;
  tagline: string;
  center: [number, number]; // [lat, lon]
  zoom: number;
  elevationMeters: number;
  roughnessRmsDeg: number;
  historicalRadiationMsvYear: number;
  waterIceSummary: string;
  geologySummary: string;
  hazardAdvisory: string;
  recommendedBaseLayer: string;
  keyFeatures: string[];
}

export const MARS_REGIONAL_PROFILES: MarsRegionProfile[] = [
  {
    id: 'tharsis',
    name: 'Tharsis Volcanic Province',
    tagline: 'Solar System’s Largest Volcanic Province & Olympus Mons',
    center: [0.0, -110.0],
    zoom: 2,
    elevationMeters: 10500,
    roughnessRmsDeg: 4.8,
    historicalRadiationMsvYear: 310,
    waterIceSummary: 'Near-surface water ice is thermodynamically unstable (<0.5 wt% WEH). Desiccated volcanic basalt and ash mantles.',
    geologySummary: 'Colossal volcanic rise home to Olympus Mons (21.9 km elevation), Ascraeus Mons, Pavonis Mons, and Arsia Mons. Formed by mantle hotspot plumes over billions of years.',
    hazardAdvisory: 'Extremely thin atmospheric column (~1.2 mbar at summit) triples ionizing galactic cosmic ray radiation. Steep caldera scarps (>20°) exceed rover traction limits.',
    recommendedBaseLayer: 'mola-color-elevation',
    keyFeatures: ['Olympus Mons', 'Ascraeus Mons', 'Pavonis Mons', 'Arsia Mons', 'Noctis Labyrinthus'],
  },
  {
    id: 'valles-marineris',
    name: 'Valles Marineris Grand Canyon',
    tagline: '4,000 km Long Tectonic Rift Chasm System',
    center: [-14.0, -59.0],
    zoom: 3,
    elevationMeters: -4500,
    roughnessRmsDeg: 9.2,
    historicalRadiationMsvYear: 220,
    waterIceSummary: 'Hydrated sulfate canyon walls (kieserite, polyhydrated sulfates) mapped by CRISM. Relict ice potential in shadowed slope talus.',
    geologySummary: 'Canyon system spanning 20% of Mars circumference up to 7 km deep. Initiated by crustal rifting during Tharsis uplift, subsequently widened by catastrophic landslides.',
    hazardAdvisory: 'Canyon wall scarps exceed 30° slopes with catastrophic rockfall hazards. Canyon floor pressure (~9-10 mbar) provides enhanced radiation shielding.',
    recommendedBaseLayer: 'mola-hrsc-blend',
    keyFeatures: ['Coprates Chasma', 'Candor Chasma', 'Melas Chasma', 'Hebes Chasma'],
  },
  {
    id: 'hellas',
    name: 'Hellas Impact Basin',
    tagline: 'Deepest Impact Depression on Mars (-8.2 km)',
    center: [-42.0, 70.0],
    zoom: 3,
    elevationMeters: -7200,
    roughnessRmsDeg: 3.1,
    historicalRadiationMsvYear: 185,
    waterIceSummary: 'SHARAD radar detects debris-covered glaciers (Lobate Debris Aprons) along eastern rim massifs insulated by 1–2m rocky debris.',
    geologySummary: 'Giant impact basin 2,300 km in diameter created 4.0 billion years ago. Thickest atmospheric column on Mars (~12.4 mbar at lowest depression).',
    hazardAdvisory: 'Frequent initiation and trapping zone for regional dust storms. Smooth basin floor provides safe landing corridors, but high dust opacity chokes solar arrays.',
    recommendedBaseLayer: 'mola-color-elevation',
    keyFeatures: ['Hellas Planitia Floor', 'Dao Vallis', 'Harmakhis Vallis', 'Hadriacus Mons'],
  },
  {
    id: 'elysium',
    name: 'Elysium & Utopia Planitia',
    tagline: 'Young Volcanic Plains & Vast Subsurface Permafrost',
    center: [25.0, 130.0],
    zoom: 3,
    elevationMeters: -3800,
    roughnessRmsDeg: 1.8,
    historicalRadiationMsvYear: 235,
    waterIceSummary: 'NASA SWIM 2.0 confirms vast permafrost deposits in Utopia Planitia (as much water as Lake Superior). Low-latitude Elysium is dry.',
    geologySummary: 'Smooth volcanic flood plains at Cerberus Fossae exhibiting the youngest volcanic flows on Mars (~10–50 Ma). Site of InSight seismic station and Zhurong rover.',
    hazardAdvisory: 'Low slope roughness makes it an optimal landing zone. Cerberus Fossae fissures are seismically active with recorded marsquakes.',
    recommendedBaseLayer: 'viking-color-mosaic',
    keyFeatures: ['InSight Landing Site', 'Zhurong Rover Site', 'Cerberus Fossae', 'Elysium Mons'],
  },
  {
    id: 'arabia-terra',
    name: 'Arabia Terra Ancient Highlands',
    tagline: 'Noachian Cratered Plateau & Paleolake Sediments',
    center: [20.0, 30.0],
    zoom: 3,
    elevationMeters: -1200,
    roughnessRmsDeg: 4.1,
    historicalRadiationMsvYear: 240,
    waterIceSummary: 'Structural water bound in phyllosilicate clays (smectites) and inverted river channels; free pore water ice is absent in top 2m.',
    geologySummary: 'Ancient Noachian terrain characterized by explosive supervolcano calderas (Eden Patera) and extensive clay-rich sedimentary strata.',
    hazardAdvisory: 'High crater rim density and boulder fields. Site of ExoMars Rosalind Franklin target (Oxia Planum) with rich astrobiological sampling value.',
    recommendedBaseLayer: 'viking-color-mosaic',
    keyFeatures: ['Eden Patera', 'Mawrth Vallis', 'Oxia Planum (ExoMars)', 'Vernal Crater'],
  },
  {
    id: 'north-pole',
    name: 'Planum Boreum (North Polar Cap)',
    tagline: 'Perennial Water Ice Cap & Polar Layered Deposits',
    center: [84.0, 0.0],
    zoom: 3,
    elevationMeters: -1800,
    roughnessRmsDeg: 2.2,
    historicalRadiationMsvYear: 260,
    waterIceSummary: 'Massive perennial water ice dome (~1.6 million km³ of pure H2O), capped seasonally by 1-meter carbon dioxide dry ice frost.',
    geologySummary: 'Fine alternating layers of pure water ice and atmospheric dust (NPLD) sculpted by katabatic wind troughs (Chasma Boreale) and surrounded by Olympia Undae sand dunes.',
    hazardAdvisory: 'Sub-zero cryogenic operational environment (-125°C in winter). 6 months of continuous polar night precludes solar power without nuclear surface reactors.',
    recommendedBaseLayer: 'mola-color-elevation',
    keyFeatures: ['Chasma Boreale', 'Olympia Undae', 'Korolev Crater (Water Ice Reservoir)'],
  },
  {
    id: 'south-pole',
    name: 'Planum Australe (South Polar Cap)',
    tagline: 'Permanent Carbon Dioxide & Water Ice Ice Sheet',
    center: [-84.0, 0.0],
    zoom: 3,
    elevationMeters: 3200,
    roughnessRmsDeg: 2.8,
    historicalRadiationMsvYear: 280,
    waterIceSummary: 'Thick water ice deposits capped by an 8-meter permanent CO2 dry ice slab. Basal radar reflections suggest potential subglacial brines.',
    geologySummary: 'High-elevation southern polar plateau with complex South Polar Layered Deposits (SPLD), swiss-cheese sublimation terrain, and seasonal CO2 geysers.',
    hazardAdvisory: 'High elevation (+3.2 km) thins the atmosphere and increases GCR radiation. Seasonal CO2 geyser venting and cryogenic collapse pits.',
    recommendedBaseLayer: 'mola-color-elevation',
    keyFeatures: ['Promethei Planum', 'Australe Mensa', 'Swiss Cheese Terrain'],
  },
];


/**
 * Pre-defined Real Mission Landing Sites
 */
export interface MarsLandingSite {
  id: string;
  name: string;
  mission: string;
  agency: string;
  landingYear: number;
  status: 'active' | 'completed' | 'future';
  lat: number;
  lon: number;
  elevationM: number;
  terrainType: string;
  scienceGoal: string;
}

export const MARS_LANDING_SITES: MarsLandingSite[] = [
  {
    id: 'perseverance',
    name: 'Perseverance (Mars 2020)',
    mission: 'Mars 2020',
    agency: 'NASA / JPL',
    landingYear: 2021,
    status: 'active',
    lat: 18.4447,
    lon: 77.4508,
    elevationM: -2560,
    terrainType: 'Ancient River Delta & Lacustrine Carbonates',
    scienceGoal: 'Seek signs of ancient astrobiological life and cache sealed rock cores for Mars Sample Return (MSR).',
  },
  {
    id: 'curiosity',
    name: 'Curiosity (MSL)',
    mission: 'Mars Science Laboratory',
    agency: 'NASA / JPL',
    landingYear: 2012,
    status: 'active',
    lat: -4.5895,
    lon: 137.4417,
    elevationM: -4450,
    terrainType: 'Impact Crater Lakebed & Sulfate Strata',
    scienceGoal: 'Assess past environmental habitability and investigate clay-bearing to sulfate-rich transitional strata of Mount Sharp.',
  },
  {
    id: 'insight',
    name: 'InSight Lander',
    mission: 'InSight Geophysics',
    agency: 'NASA / JPL / CNES / DLR',
    landingYear: 2018,
    status: 'completed',
    lat: 4.5024,
    lon: 135.6234,
    elevationM: -2613,
    terrainType: 'Smooth Volcanic Regolith',
    scienceGoal: 'Mapped internal crust, mantle, and core structure via SEIS seismometer; recorded 1,300+ marsquakes.',
  },
  {
    id: 'opportunity',
    name: 'Opportunity (MER-B)',
    mission: 'Mars Exploration Rover',
    agency: 'NASA / JPL',
    landingYear: 2004,
    status: 'completed',
    lat: -1.9462,
    lon: -5.5266,
    elevationM: -1380,
    terrainType: 'Meridiani Planum Hematite Plains',
    scienceGoal: 'Discovered hematite "blueberries", proving prolonged acidic ground water percolation.',
  },
  {
    id: 'spirit',
    name: 'Spirit (MER-A)',
    mission: 'Mars Exploration Rover',
    agency: 'NASA / JPL',
    landingYear: 2004,
    status: 'completed',
    lat: -14.5684,
    lon: 175.4726,
    elevationM: -1940,
    terrainType: 'Gusev Crater Basaltic Floor & Columbia Hills',
    scienceGoal: 'Investigated ancient hydrothermal silica sinter deposits indicative of ancient hot spring environments.',
  },
  {
    id: 'viking-1',
    name: 'Viking 1 Lander',
    mission: 'Viking Project',
    agency: 'NASA / Langley',
    landingYear: 1976,
    status: 'completed',
    lat: 22.48,
    lon: -47.97,
    elevationM: -2690,
    terrainType: 'Chryse Planitia Flood Plains',
    scienceGoal: 'First successful long-duration Mars lander; conducted pioneering biology experiments and weather monitoring.',
  },
  {
    id: 'viking-2',
    name: 'Viking 2 Lander',
    mission: 'Viking Project',
    agency: 'NASA / Langley',
    landingYear: 1976,
    status: 'completed',
    lat: 47.97,
    lon: 134.04,
    elevationM: -3850,
    terrainType: 'Utopia Planitia Boulder Field',
    scienceGoal: 'Analyzed permafrost soil chemistry and observed seasonal frost condensation at mid-northern latitudes.',
  },
  {
    id: 'phoenix',
    name: 'Phoenix Lander',
    mission: 'Mars Scout Program',
    agency: 'NASA / University of Arizona',
    landingYear: 2008,
    status: 'completed',
    lat: 68.2188,
    lon: -125.7492,
    elevationM: -4120,
    terrainType: 'Vastitas Borealis Polygonal Tundra',
    scienceGoal: 'Dug 5 cm into Martian soil and discovered pure subsurface water ice sublimation in real time.',
  },
  {
    id: 'zhurong',
    name: 'Zhurong Rover (Tianwen-1)',
    mission: 'Tianwen-1',
    agency: 'CNSA',
    landingYear: 2021,
    status: 'completed',
    lat: 25.066,
    lon: 109.925,
    elevationM: -4100,
    terrainType: 'Southern Utopia Planitia Sedimentary Plains',
    scienceGoal: 'Subsurface radar sounding for paleocean sedimentary structures and secondary hydrated minerals.',
  },
  {
    id: 'exomars-oxia',
    name: 'Rosalind Franklin (ExoMars)',
    mission: 'ExoMars 2028',
    agency: 'ESA / NASA',
    landingYear: 2029,
    status: 'future',
    lat: 18.275,
    lon: -24.368,
    elevationM: -3050,
    terrainType: 'Oxia Planum Phyllosilicate Clay Beds',
    scienceGoal: 'Equipped with a 2-meter drill to extract deep sub-surface bio-signatures shielded from cosmic radiation.',
  },
];


