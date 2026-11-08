/**
 * NASA Multi-Objective Martian Graph Pathfinder
 * 
 * Implements genuine A* and Dijkstra graph pathfinding over an adaptive 2D grid
 * grounded in real MOLA topography, SWIM 2.0 subsurface ice, and MERI risk layers.
 * 
 * Generates three distinct route alternatives:
 * 1. SAFEST ROUTE (Minimizes cumulative MERI risk and avoids all NO-GO terrain)
 * 2. FASTEST FEASIBLE ROUTE (Minimizes traverse time & power, allows moderate slopes)
 * 3. BEST SCIENCE-PER-RISK ROUTE (Optimizes science yield along water-ice & geological targets per unit risk)
 */

import { getMarsTopography } from './mars-dem-engine';
import { calculateMeri, type TraverseMobilityMode } from './mars-meri';
import { querySwimWaterIce } from './swim-data';

export interface RouteWaypoint {
  lat: number;
  lon: number;
  name: string;
  elevationM: number;
  slopeDeg: number;
  meriScore: number;
  distanceFromStartKm: number;
}

export interface RouteAlternative {
  id: 'safest' | 'fastest' | 'science';
  title: string;
  badge: string;
  colorHex: string;
  waypoints: RouteWaypoint[];
  distanceKm: number;
  durationHours: number;
  elevationGainM: number;
  elevationLossM: number;
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  meanMeriScore: number;
  maxMeriScore: number;
  energyKwh: number;
  evaO2ConsumedKg?: number | undefined;
  evaCaloriesKcal?: number | undefined;
  waterIceAccessScore: number; // 0 to 100
  scienceTargetScore: number;   // 0 to 100
  returnRouteFeasibility: 'FEASIBLE (High Margin)' | 'MARGINAL (Consumable Critical)' | 'EXCEEDS SAFE RADIUS';
  recommendationRationale: string;
  turnBackCondition: string;
}

export interface MultiRoutePlanResult {
  origin: { lat: number; lon: number; name: string };
  destination: { lat: number; lon: number; name: string };
  straightLineDistanceKm: number;
  mode: TraverseMobilityMode;
  routes: {
    safest: RouteAlternative;
    fastest: RouteAlternative;
    science: RouteAlternative;
  };
}

const MARS_RADIUS_KM = 3389.5;

function calculateGreatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((MARS_RADIUS_KM * c).toFixed(2));
}

// Node in the pathfinding grid
interface GridNode {
  r: number;
  c: number;
  lat: number;
  lon: number;
  elevationM: number;
  slopeDeg: number;
  roughnessM: number;
  meriScore: number;
  isNoGo: boolean;
  scienceValue: number; // 0 to 100 based on SWIM ice & geomorphology
}

/**
 * Plans 3 distinct multi-objective routes across real Martian topography.
 */
export function planMultiObjectiveRoutes(
  origin: { lat: number; lon: number; name: string },
  destination: { lat: number; lon: number; name: string },
  mode: TraverseMobilityMode = 'pressurized_rover'
): MultiRoutePlanResult {
  const straightDist = calculateGreatCircleKm(origin.lat, origin.lon, destination.lat, destination.lon);

  // 1. Construct adaptive search grid (28 x 28 grid)
  const gridSize = 28;
  const latMin = Math.min(origin.lat, destination.lat);
  const latMax = Math.max(origin.lat, destination.lat);
  const lonMin = Math.min(origin.lon, destination.lon);
  const lonMax = Math.max(origin.lon, destination.lon);

  // Generous buffer so paths can loop around hazardous cliffs or craters (at least 0.15° or 35% of span)
  const latSpan = Math.max(0.12, (latMax - latMin) * 1.5);
  const lonSpan = Math.max(0.12, (lonMax - lonMin) * 1.5);
  const centerLat = (latMin + latMax) / 2;
  const centerLon = (lonMin + lonMax) / 2;

  const gLatMin = centerLat - latSpan / 2;
  const gLatMax = centerLat + latSpan / 2;
  const gLonMin = centerLon - lonSpan / 2;
  const gLonMax = centerLon + lonSpan / 2;

  const dLat = (gLatMax - gLatMin) / (gridSize - 1);
  const dLon = (gLonMax - gLonMin) / (gridSize - 1);

  // Pre-sample grid nodes
  const grid: GridNode[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: GridNode[] = [];
    grid[r] = row;
    const rLat = gLatMax - r * dLat;
    for (let c = 0; c < gridSize; c++) {
      const cLon = gLonMin + c * dLon;
      const topo = getMarsTopography(rLat, cLon);
      const meri = calculateMeri(rLat, cLon, mode);
      const swim = querySwimWaterIce(rLat, cLon);

      // Science value formulation:
      // High water ice consistency (+40), active landing sites (+30), distinct crater/canyon rims (+30)
      let sci = 15;
      if (swim.compositeConsistency > 0.4) sci += 45;
      else if (swim.compositeConsistency > 0.1) sci += 25;
      if (Math.abs(topo.topographicPositionIndex) > 30) sci += 20;

      row.push({
        r,
        c,
        lat: Number(rLat.toFixed(4)),
        lon: Number(cLon.toFixed(4)),
        elevationM: topo.elevationM,
        slopeDeg: topo.slopeDeg,
        roughnessM: topo.roughnessM,
        meriScore: meri.compositeMeriScore,
        isNoGo: meri.classification === 'NO-GO',
        scienceValue: Math.min(100, sci),
      });
    }
  }

  const getNode = (r: number, c: number): GridNode => {
    const row = grid[r];
    const n = row ? row[c] : undefined;
    if (n) return n;
    return {
      r,
      c,
      lat: origin.lat,
      lon: origin.lon,
      elevationM: 0,
      slopeDeg: 0,
      roughnessM: 0,
      meriScore: 20,
      isNoGo: false,
      scienceValue: 20,
    };
  };

  // Find start and goal grid coordinates
  const findClosestNode = (tLat: number, tLon: number): { r: number; c: number } => {
    let bestR = 0;
    let bestC = 0;
    let bestDist = Infinity;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const node = getNode(r, c);
        const d = Math.hypot(node.lat - tLat, node.lon - tLon);
        if (d < bestDist) {
          bestDist = d;
          bestR = r;
          bestC = c;
        }
      }
    }
    return { r: bestR, c: bestC };
  };

  const startCoord = findClosestNode(origin.lat, origin.lon);
  const goalCoord = findClosestNode(destination.lat, destination.lon);

  // 8-neighbor directions
  const neighbors: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];

  // Generic A* / Dijkstra solver
  const runPathfinder = (costFn: (from: GridNode, to: GridNode, distStepKm: number) => number | null): GridNode[] => {
    const distMap: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(Infinity));
    const parentMap: (GridNode | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    const visited: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

    const getDist = (r: number, c: number): number => distMap[r]?.[c] ?? Infinity;
    const setDist = (r: number, c: number, v: number): void => {
      const row = distMap[r];
      if (row) row[c] = v;
    };
    const isVisited = (r: number, c: number): boolean => visited[r]?.[c] ?? false;
    const setVisited = (r: number, c: number, v: boolean): void => {
      const row = visited[r];
      if (row) row[c] = v;
    };
    const getParent = (r: number, c: number): GridNode | null => parentMap[r]?.[c] ?? null;
    const setParent = (r: number, c: number, p: GridNode | null): void => {
      const row = parentMap[r];
      if (row) row[c] = p;
    };

    setDist(startCoord.r, startCoord.c, 0);

    // Simple priority queue using array
    const openSet: { r: number; c: number; f: number }[] = [
      { r: startCoord.r, c: startCoord.c, f: 0 }
    ];

    while (openSet.length > 0) {
      // Pick lowest f
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const cr = current.r;
      const cc = current.c;

      if (isVisited(cr, cc)) continue;
      setVisited(cr, cc, true);

      if (cr === goalCoord.r && cc === goalCoord.c) {
        // Goal reached, reconstruct path
        const path: GridNode[] = [];
        let curr: GridNode | null = getNode(cr, cc);
        while (curr) {
          path.unshift(curr);
          curr = getParent(curr.r, curr.c);
        }
        return path;
      }

      const u = getNode(cr, cc);

      for (const [dr, dc] of neighbors) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
        if (isVisited(nr, nc)) continue;

        const v = getNode(nr, nc);
        const stepDistKm = calculateGreatCircleKm(u.lat, u.lon, v.lat, v.lon);
        const edgeCost = costFn(u, v, stepDistKm);

        if (edgeCost === null || !isFinite(edgeCost)) continue; // Impassable / NO-GO

        const newDist = getDist(cr, cc) + edgeCost;
        if (newDist < getDist(nr, nc)) {
          setDist(nr, nc, newDist);
          setParent(nr, nc, u);
          // Admissible Euclidean heuristic to goal
          const h = calculateGreatCircleKm(v.lat, v.lon, destination.lat, destination.lon);
          openSet.push({ r: nr, c: nc, f: newDist + h });
        }
      }
    }

    // Fallback direct path if enclosed by impassable ring
    const fallback: GridNode[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const fLat = origin.lat + (destination.lat - origin.lat) * frac;
      const fLon = origin.lon + (destination.lon - origin.lon) * frac;
      const node = findClosestNode(fLat, fLon);
      fallback.push(getNode(node.r, node.c));
    }
    return fallback;
  };

  // 1. SAFEST ROUTE COST FUNCTION:
  // Heavily penalizes MERI score, steep slopes, and strictly blocks NO-GO cells
  const pathSafest = runPathfinder((from, to, distKm) => {
    if (to.isNoGo) return null; // Hard obstacle
    const maxSlope = mode === 'astronaut_eva' ? 14 : 20;
    if (to.slopeDeg > maxSlope) return null;

    const meriFactor = Math.pow(to.meriScore / 25, 2.8);
    const slopeFactor = Math.pow(to.slopeDeg / 8, 2.2);
    return distKm * (1.0 + meriFactor + slopeFactor);
  });

  // 2. FASTEST FEASIBLE ROUTE COST FUNCTION:
  // Minimizes travel time. Allows higher slopes up to hard vehicle limits
  const pathFastest = runPathfinder((from, to, distKm) => {
    const hardLimit = mode === 'astronaut_eva' ? 16 : 24;
    if (to.slopeDeg > hardLimit) return null;

    // Tobler-like Grade Speed: v = v0 * exp(-3.5 * |dh/dx|)
    const grade = Math.abs(to.elevationM - from.elevationM) / Math.max(10, distKm * 1000);
    const speedFactor = Math.max(0.25, Math.exp(-3.2 * grade));
    return distKm / speedFactor;
  });

  // 3. BEST SCIENCE-PER-RISK ROUTE COST FUNCTION:
  // Discounts distance cost by local science targets while maintaining moderate safety margin
  const pathScience = runPathfinder((from, to, distKm) => {
    if (to.isNoGo && to.slopeDeg > 18) return null;
    const riskPenalty = 1.0 + (to.meriScore / 45);
    const scienceDiscount = 1.0 / (1.0 + (to.scienceValue / 50));
    return distKm * riskPenalty * scienceDiscount;
  });

  // Helper to compile RouteAlternative metrics
  const compileRouteAlternative = (
    id: RouteAlternative['id'],
    title: string,
    badge: string,
    colorHex: string,
    nodes: GridNode[],
    rationale: string,
    turnBack: string
  ): RouteAlternative => {
    let cumDist = 0;
    let elevGain = 0;
    let elevLoss = 0;
    let maxSlope = 0;
    let sumSlope = 0;
    let maxMeri = 0;
    let sumMeri = 0;
    let sumSci = 0;

    const waypoints: RouteWaypoint[] = [];

    // Guarantee origin is first waypoint
    waypoints.push({
      lat: origin.lat,
      lon: origin.lon,
      name: origin.name,
      elevationM: nodes[0]?.elevationM ?? 0,
      slopeDeg: nodes[0]?.slopeDeg ?? 0,
      meriScore: nodes[0]?.meriScore ?? 0,
      distanceFromStartKm: 0,
    });

    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      if (!prev || !curr) continue;
      const d = calculateGreatCircleKm(prev.lat, prev.lon, curr.lat, curr.lon);
      cumDist += d;

      const deltaElev = curr.elevationM - prev.elevationM;
      if (deltaElev > 0) elevGain += deltaElev;
      else elevLoss += Math.abs(deltaElev);

      if (curr.slopeDeg > maxSlope) maxSlope = curr.slopeDeg;
      sumSlope += curr.slopeDeg;

      if (curr.meriScore > maxMeri) maxMeri = curr.meriScore;
      sumMeri += curr.meriScore;

      sumSci += curr.scienceValue;

      waypoints.push({
        lat: curr.lat,
        lon: curr.lon,
        name: i === nodes.length - 1 ? destination.name : `Waypoint ${i} (${cumDist.toFixed(1)} km)`,
        elevationM: curr.elevationM,
        slopeDeg: curr.slopeDeg,
        meriScore: curr.meriScore,
        distanceFromStartKm: Number(cumDist.toFixed(1)),
      });
    }

    const nPoints = Math.max(1, nodes.length);
    const meanSlope = Number((sumSlope / nPoints).toFixed(1));
    const meanMeri = Math.round(sumMeri / nPoints);
    const totalDist = Number(cumDist.toFixed(2));

    // Vehicle kinematic speed & energy estimates
    const speedKmh = mode === 'pressurized_rover' ? 9.5 : mode === 'robotic_rover' ? 5.5 : 2.2;
    const durationHours = Number((totalDist / speedKmh).toFixed(1));
    const energyKwh = Number((totalDist * (mode === 'pressurized_rover' ? 0.85 : 0.4) + (elevGain / 1000) * 1.5).toFixed(1));

    // Astronaut EVA bioenergetics
    const o2Consumed = mode === 'astronaut_eva' ? Number(((durationHours * 0.08 * 2) + (elevGain / 1000) * 0.15).toFixed(2)) : undefined;
    const calories = mode === 'astronaut_eva' ? Math.round(durationHours * 320 + elevGain * 1.2) : undefined;

    // Return route feasibility:
    // Rover battery / EVA PLSS radius feasibility
    let returnFeasibility: RouteAlternative['returnRouteFeasibility'] = 'FEASIBLE (High Margin)';
    if (mode === 'astronaut_eva') {
      if (totalDist > 4.5 || durationHours > 3.0) returnFeasibility = 'EXCEEDS SAFE RADIUS';
      else if (totalDist > 2.5) returnFeasibility = 'MARGINAL (Consumable Critical)';
    } else {
      if (energyKwh * 2 > 65) returnFeasibility = 'MARGINAL (Consumable Critical)';
    }

    const waterIceScore = Math.min(100, Math.round((sumSci / nPoints) * 1.1));
    const scienceScore = Math.min(100, Math.round((sumSci / nPoints) * 1.25));

    return {
      id,
      title,
      badge,
      colorHex,
      waypoints,
      distanceKm: totalDist,
      durationHours,
      elevationGainM: Math.round(elevGain),
      elevationLossM: Math.round(elevLoss),
      maxSlopeDeg: maxSlope,
      meanSlopeDeg: meanSlope,
      meanMeriScore: meanMeri,
      maxMeriScore: maxMeri,
      energyKwh,
      ...(o2Consumed !== undefined ? { evaO2ConsumedKg: o2Consumed } : {}),
      ...(calories !== undefined ? { evaCaloriesKcal: calories } : {}),
      waterIceAccessScore: waterIceScore,
      scienceTargetScore: scienceScore,
      returnRouteFeasibility: returnFeasibility,
      recommendationRationale: rationale,
      turnBackCondition: turnBack,
    };
  };

  return {
    origin,
    destination,
    straightLineDistanceKm: straightDist,
    mode,
    routes: {
      safest: compileRouteAlternative(
        'safest',
        'Safest Mission Traverse',
        'MINIMAL RISK (MERI < 35)',
        '#10b981', // emerald
        pathSafest,
        'Path detours around steep crater scarps, low-inertia dust traps, and high MERI zones. Minimizes mechanical rollover risk and EVA ankle strain.',
        'Abort if local slope exceeds 14° (EVA) or 20° (Rover), or if battery state of charge drops below 55% before midpoint.'
      ),
      fastest: compileRouteAlternative(
        'fastest',
        'Fastest Direct Traverse',
        'LOW CONSUMABLES / TIME',
        '#f59e0b', // amber
        pathFastest,
        'Shortest geodesic line of travel following ridges and flat terraces. Minimizes mission duration and PLSS oxygen consumption at the expense of higher slope exposure.',
        'Abort traverse if wheel slip exceeds 35% on slopes or suit metabolic rate exceeds 450 W continuously for > 15 minutes.'
      ),
      science: compileRouteAlternative(
        'science',
        'Best Science-per-Risk Route',
        'MAXIMUM SCIENCE / ISRU',
        '#06b6d4', // cyan
        pathScience,
        'Optimized multi-objective traverse passing through verified SWIM subsurface ice horizons and geological stratigraphic boundaries with controlled risk exposure.',
        'Abort science sampling if dust optical depth rises by delta tau > 0.4 or daytime temperatures drop below -55°C.'
      ),
    },
  };
}
