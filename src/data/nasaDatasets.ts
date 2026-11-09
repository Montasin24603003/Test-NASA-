export interface NasaDataset {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  portal: "data.nasa.gov" | "search.earthdata.nasa.gov" | "worldview.earthdata.nasa.gov" | "giovanni.gsfc.nasa.gov" | "power.larc.nasa.gov" | "firms.modaps.eosdis.nasa.gov" | "sedac.ciesin.columbia.edu" | "exoplanetarchive.ipac.caltech.edu" | "pds.nasa.gov" | "images.nasa.gov";
  category: "Terrain / ML" | "Thermal / Heat" | "Radiation / Atmosphere" | "Mineralogy / Spectroscopy" | "Solar / Energy" | "Human Exposure / Risk" | "Comparative Planetology" | "Surface Imagery";
  missionApplication: string;
  description: string;
  url: string;
  badge?: string;
}

export const nasaDatasets: NasaDataset[] = [
  // 1. data.nasa.gov
  {
    id: "classification-of-mars-terrain-using-multiple-data-sources",
    title: "Classification of Mars Terrain Using Multiple Data Sources",
    source: "NASA Open Data Portal",
    sourceUrl: "https://data.nasa.gov",
    portal: "data.nasa.gov",
    category: "Terrain / ML",
    missionApplication: "Multi-scale terrain classification and automated rover slope hazards",
    description: "NASA Open Data archive for automated Mars surface geomorphology classification using fused elevation, roughness, and multi-band orbiter data to predict traverse suitability for Mars rovers.",
    url: "https://data.nasa.gov/dataset/classification-of-mars-terrain-using-multiple-data-sources",
    badge: "ML Ground Truth",
  },
  {
    id: "vo1-vo2-mars-infrared-thermal-mapper-resampled-data-v1-0",
    title: "Viking Orbiter 1 & 2 Infrared Thermal Mapper (IRTM) Data",
    source: "NASA Open Data Portal",
    sourceUrl: "https://data.nasa.gov",
    portal: "data.nasa.gov",
    category: "Thermal / Heat",
    missionApplication: "Diurnal surface temperature modeling and nighttime extreme cold shelter planning",
    description: "Thermal and albedo mapping data from the Viking orbiters covering the temporal variation of Martian surface insolation, surface thermal inertia, and extreme seasonal freezing curves.",
    url: "https://data.nasa.gov/dataset/vo1-vo2-mars-infrared-thermal-mapper-resampled-data-v1-0",
    badge: "Thermal Baseline",
  },
  {
    id: "odyssey-mars-marie-calibrated-data-v1-0",
    title: "Mars Odyssey MARIE Calibrated Energetic Particle Radiation",
    source: "NASA Open Data Portal",
    sourceUrl: "https://data.nasa.gov",
    portal: "data.nasa.gov",
    category: "Radiation / Atmosphere",
    missionApplication: "Galactic Cosmic Ray (GCR) and Solar Particle Event (SPE) dosimetry modeling",
    description: "Calibrated particle flux and radiation dosimetry collected by the MARIE instrument aboard 2001 Mars Odyssey, providing empirical radiation hazard baseline for surface habitats.",
    url: "https://data.nasa.gov/dataset/odyssey-mars-marie-calibrated-data-v1-0-ba23a",
    badge: "Radiation Dosimetry",
  },

  // 2. pds.nasa.gov (NASA Planetary Data System)
  {
    id: "pds-hirise-jezero-crater-dem",
    title: "NASA PDS reference: HiRISE Jezero stereo terrain archive",
    source: "NASA Planetary Data System (PDS)",
    sourceUrl: "https://pds.nasa.gov",
    portal: "pds.nasa.gov",
    category: "Terrain / ML",
    missionApplication: "Reference archive for high-resolution Jezero terrain products",
    description: "NASA PDS archive reference for HiRISE stereo-derived terrain products. The terrain demo in this app uses a separate 128×128 Jezero elevation patch; it does not load a meter-scale HiRISE DTM.",
    url: "https://pds.nasa.gov",
    badge: "PDS archive reference",
  },
  {
    id: "pds-mola-megdr-topography",
    title: "NASA PDS: Mars Global Surveyor MOLA MEGDR Topography (128 pix/deg)",
    source: "NASA Planetary Data System (PDS)",
    sourceUrl: "https://pds.nasa.gov",
    portal: "pds.nasa.gov",
    category: "Terrain / ML",
    missionApplication: "Global Mars datum elevation reference and regional slope safety analysis",
    description: "Mission Experiment Gridded Data Record (MEGDR) produced by the Mars Orbiter Laser Altimeter (MOLA), providing the standard planetary geodetic datum and planetary-scale topographic maps.",
    url: "https://pds-geosciences.wustl.edu/missions/mgs/mola.html",
    badge: "Global Elevation",
  },
  {
    id: "pds-crism-mtrdr-spectral-cubes",
    title: "NASA PDS: MRO CRISM Map-Projected Targeted Reduced Data Record",
    source: "NASA Planetary Data System (PDS)",
    sourceUrl: "https://pds.nasa.gov",
    portal: "pds.nasa.gov",
    category: "Mineralogy / Spectroscopy",
    missionApplication: "Hydrated clay minerals, carbonates, and In-Situ Resource Utilization (ISRU) water extraction",
    description: "Multiband visible and infrared hyperspectral cubes (0.36 to 3.92 micrometers) mapped to surface coordinates, revealing clay-bearing smectites, olivine sands, and silica deposits in Jezero and Nili Fossae.",
    url: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm",
    badge: "Water Minerals",
  },

  // 3. search.earthdata.nasa.gov
  {
    id: "earthdata-aster-planetary-analogs",
    title: "NASA Earthdata Search: ASTER GDEM & Extreme Arid Analogs",
    source: "NASA Earthdata Search",
    sourceUrl: "https://search.earthdata.nasa.gov",
    portal: "search.earthdata.nasa.gov",
    category: "Terrain / ML",
    missionApplication: "Calibrating rover traverse algorithms in Atacama & Antarctic Dry Valley analog testbeds",
    description: "Global digital elevation models and multispectral thermal radiometer data used by NASA Ames and JPL to benchmark planetary rover mobility, wheel slip, and autonomous route planning algorithms.",
    url: "https://search.earthdata.nasa.gov/search?q=ASTER+GDEM",
    badge: "Earth Analog DEM",
  },

  // 4. worldview.earthdata.nasa.gov
  {
    id: "worldview-global-dust-storm-sentinel",
    title: "NASA Worldview: Aerosol Optical Depth & Dust Event Monitoring",
    source: "NASA Worldview",
    sourceUrl: "https://worldview.earthdata.nasa.gov",
    portal: "worldview.earthdata.nasa.gov",
    category: "Radiation / Atmosphere",
    missionApplication: "Visualizing global dust dynamics, planetary optical depth, and solar panel dust obscuration",
    description: "Interactive real-time satellite imagery showing large-scale atmospheric aerosol transport, convective dust plumes, and storm growth mechanisms directly applicable to Martian planet-encircling dust storms.",
    url: "https://worldview.earthdata.nasa.gov",
    badge: "Interactive Satellite",
  },

  // 5. giovanni.gsfc.nasa.gov
  {
    id: "giovanni-atmospheric-dust-optical-depth",
    title: "NASA Giovanni: MERRA-2 Atmospheric Dust & Surface Flux Analysis",
    source: "NASA Giovanni (GSFC)",
    sourceUrl: "https://giovanni.gsfc.nasa.gov",
    portal: "giovanni.gsfc.nasa.gov",
    category: "Radiation / Atmosphere",
    missionApplication: "Atmospheric opacity (tau), solar extinction curves, and convective storm forecasting",
    description: "Web-based planetary atmosphere visualization suite developed by Goddard Space Flight Center for exploring time-series dust column mass, aerosol extinction profiles, and atmospheric boundary layers.",
    url: "https://giovanni.gsfc.nasa.gov/giovanni/",
    badge: "Dust & Aerosols",
  },

  // 6. power.larc.nasa.gov
  {
    id: "nasa-power-surface-solar-insolation",
    title: "NASA POWER: Surface Solar Energy & Meteorological Prediction",
    source: "NASA POWER (LaRC)",
    sourceUrl: "https://power.larc.nasa.gov",
    portal: "power.larc.nasa.gov",
    category: "Solar / Energy",
    missionApplication: "Habitat photovoltaic sizing, solar battery reserve margins, and seasonal insolation drops",
    description: "NASA Langley Prediction of Worldwide Energy Resources (POWER) solar irradiance dataset providing direct normal insolation, diffuse radiation, and temperature metrics for surface power generation budgets.",
    url: "https://power.larc.nasa.gov",
    badge: "Solar Photovoltaics",
  },

  // 7. firms.modaps.eosdis.nasa.gov
  {
    id: "nasa-firms-thermal-hotspot-monitoring",
    title: "NASA FIRMS: Thermal Anomaly & Active Heat Signature Tracking",
    source: "NASA FIRMS (EOSDIS)",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov",
    portal: "firms.modaps.eosdis.nasa.gov",
    category: "Thermal / Heat",
    missionApplication: "Surface habitat geothermal/thermal leak detection and volcanic province heat tracking",
    description: "Fire Information for Resource Management System (FIRMS) delivering high-resolution infrared thermal anomaly coordinates, radiant power measurements, and detection confidence ratings for planetary heat monitoring.",
    url: "https://firms.modaps.eosdis.nasa.gov",
    badge: "Thermal Anomaly",
  },

  // 8. sedac.ciesin.columbia.edu
  {
    id: "sedac-hazard-frequency-exposure-model",
    title: "NASA SEDAC: Global Hazard Frequency & Human Exposure Vulnerability",
    source: "NASA SEDAC (CIESIN Columbia)",
    sourceUrl: "https://sedac.ciesin.columbia.edu",
    portal: "sedac.ciesin.columbia.edu",
    category: "Human Exposure / Risk",
    missionApplication: "Multi-hazard contingency planning and crew survival risk weighting (ARES-01 Simulator)",
    description: "Socioeconomic Data and Applications Center spatial models analyzing cumulative risk exposure, habitat isolation thresholds, and survival contingency requirements under compound environmental hazards.",
    url: "https://sedac.ciesin.columbia.edu",
    badge: "Risk Modeling",
  },

  // 9. exoplanetarchive.ipac.caltech.edu
  {
    id: "nasa-exoplanet-archive-terrestrial-parameters",
    title: "NASA Exoplanet Archive: Comparative Terrestrial Planet Parameters",
    source: "NASA Exoplanet Archive (IPAC/Caltech)",
    sourceUrl: "https://exoplanetarchive.ipac.caltech.edu",
    portal: "exoplanetarchive.ipac.caltech.edu",
    category: "Comparative Planetology",
    missionApplication: "Comparative planetary gravity, atmospheric scale height, and habitable zone boundaries",
    description: "Authoritative database of astronomical and geophysical parameters for rocky planets, providing comparative orbital eccentricity ($e=0.0934$), solar constant ($589 W/m^2$), and planetary habitability metrics.",
    url: "https://exoplanetarchive.ipac.caltech.edu",
    badge: "Habitability Metrics",
  },

  // 10. images.nasa.gov
  {
    id: "nasa-images-perseverance-jezero-imagery",
    title: "NASA Image and Video Library: Mars 2020 Jezero Surface Telemetry",
    source: "NASA Images and Video Library",
    sourceUrl: "https://images.nasa.gov",
    portal: "images.nasa.gov",
    category: "Surface Imagery",
    missionApplication: "Ground-truth boulder density, wheel track odometry, and river delta strata inspection",
    description: "Public access repository of high-resolution Mastcam-Z stereo panoramas, SuperCam close-up spectroscopy targets, and Ingenuity aerial scouting photographs from Jezero Crater.",
    url: "https://images.nasa.gov/search-results?q=mars%20jezero%20perseverance",
    badge: "Rover Panoramas",
  },
];

export const pipelineLayers = [
  { key: "terrain", label: "Terrain Risk Demo", source: "Stored Jezero 128×128 DEM patch", effect: "Exploratory slope visualization and route comparisons" },
  { key: "thermal", label: "Thermal Environment & Night Shift", source: "Viking IRTM + NASA FIRMS Analogs", effect: "Thermal mass retention, habitat insulation, and nighttime heating cycles" },
  { key: "radiation", label: "Radiation Dosimetry & Atmospheric Tau", source: "Mars Odyssey MARIE + NASA Giovanni", effect: "GCR/SPE exposure limits, regolith shielding depth, and dust storm alerts" },
  { key: "minerals", label: "Mineralogy, Hydrated Clays & ISRU", source: "MRO CRISM + NASA Exoplanet Data", effect: "Water ice extraction feasibility, oxygen generation, and biosignature targets" },
  { key: "power", label: "Photovoltaic Power Budgets", source: "NASA POWER + Solar Ephemeris", effect: "Sol-by-sol kilowatt-hour generation and dust degradation margins" },
] as const;

export const NASA_SOURCE_PORTALS = [
  { name: "NASA Open Data", id: "data.nasa.gov", url: "https://data.nasa.gov", desc: "Official open repository for cataloged mission data" },
  { name: "Earthdata Search", id: "search.earthdata.nasa.gov", url: "https://search.earthdata.nasa.gov", desc: "Cross-disciplinary Earth & planetary analog search engine" },
  { name: "NASA Worldview", id: "worldview.earthdata.nasa.gov", url: "https://worldview.earthdata.nasa.gov", desc: "Interactive global environmental and aerosol event visualizer" },
  { name: "NASA Giovanni", id: "giovanni.gsfc.nasa.gov", url: "https://giovanni.gsfc.nasa.gov", desc: "Atmospheric, dust, and solar radiation analytical workbench" },
  { name: "NASA POWER", id: "power.larc.nasa.gov", url: "https://power.larc.nasa.gov", desc: "Surface solar irradiance & meteorological energy forecasting" },
  { name: "NASA FIRMS", id: "firms.modaps.eosdis.nasa.gov", url: "https://firms.modaps.eosdis.nasa.gov", desc: "High-resolution thermal anomaly and hotspot coordinates" },
  { name: "NASA SEDAC", id: "sedac.ciesin.columbia.edu", url: "https://sedac.ciesin.columbia.edu", desc: "Human exposure vulnerability and multi-hazard risk spatial data" },
  { name: "Exoplanet Archive", id: "exoplanetarchive.ipac.caltech.edu", url: "https://exoplanetarchive.ipac.caltech.edu", desc: "Planetary parameter databases and comparative habitability" },
  { name: "Planetary Data System", id: "pds.nasa.gov", url: "https://pds.nasa.gov", desc: "Primary archive of all NASA planetary missions and raw instrument PDS" },
  { name: "NASA Images & Video", id: "images.nasa.gov", url: "https://images.nasa.gov", desc: "High-resolution imagery archive for Mars rovers and orbiters" },
] as const;
